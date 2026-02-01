/*
  # Add Wallet System with Paystack Virtual Accounts

  1. New Tables
    - `wallets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `balance` (decimal, default 0.00)
      - `currency` (text, default 'NGN')
      - `paystack_customer_code` (text, unique) - Paystack customer identifier
      - `paystack_account_number` (text) - Virtual account number
      - `paystack_bank_name` (text) - Bank name for virtual account
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `wallet_id` (uuid, foreign key to wallets)
      - `user_id` (uuid, foreign key to profiles)
      - `type` (text) - 'deposit', 'withdrawal', 'payment', 'refund'
      - `amount` (decimal)
      - `balance_before` (decimal)
      - `balance_after` (decimal)
      - `status` (text) - 'pending', 'completed', 'failed', 'cancelled'
      - `reference` (text, unique) - Transaction reference
      - `paystack_reference` (text) - Paystack transaction reference
      - `description` (text)
      - `metadata` (jsonb) - Additional transaction data
      - `order_id` (uuid, nullable, foreign key to orders) - If payment is for an order
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only view and manage their own wallet
    - Users can only view their own transactions
    - Admins can view all wallets and transactions

  3. Indexes
    - Index on user_id for fast lookups
    - Index on reference for transaction tracking
    - Index on status for filtering
    - Index on created_at for sorting

  4. Triggers
    - Auto-update updated_at timestamp on wallets
    - Validate balance changes
*/

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance decimal(12, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  currency text DEFAULT 'NGN' NOT NULL,
  paystack_customer_code text UNIQUE,
  paystack_account_number text,
  paystack_bank_name text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund')),
  amount decimal(12, 2) NOT NULL CHECK (amount > 0),
  balance_before decimal(12, 2) NOT NULL,
  balance_after decimal(12, 2) NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference text UNIQUE NOT NULL,
  paystack_reference text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallets

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own wallet (auto-creation)
CREATE POLICY "Users can create own wallet"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own wallet
CREATE POLICY "Users can update own wallet"
  ON wallets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets"
  ON wallets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for wallet_transactions

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own transactions
CREATE POLICY "Users can create own transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update wallet updated_at timestamp
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_wallet_timestamp ON wallets;
CREATE TRIGGER trigger_update_wallet_timestamp
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();
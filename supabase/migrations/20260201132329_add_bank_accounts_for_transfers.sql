/*
  # Add Bank Accounts for Transfers

  1. New Tables
    - `bank_accounts`
      - `id` (uuid, primary key)
      - `bank_name` (text) - Name of the bank
      - `account_number` (text) - Account number
      - `account_name` (text) - Account holder name
      - `is_active` (boolean) - Whether account is active/shown
      - `display_order` (integer) - Order to display accounts
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `bank_accounts` table
    - Add policy for all authenticated users to read active bank accounts
    - Add policy for admins to manage bank accounts

  3. Initial Data
    - Insert two default bank accounts for admin to configure
*/

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read active bank accounts
CREATE POLICY "Authenticated users can view active bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy for admins to view all bank accounts
CREATE POLICY "Admins can view all bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins to insert bank accounts
CREATE POLICY "Admins can insert bank accounts"
  ON bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins to update bank accounts
CREATE POLICY "Admins can update bank accounts"
  ON bank_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admins to delete bank accounts
CREATE POLICY "Admins can delete bank accounts"
  ON bank_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default bank accounts
INSERT INTO bank_accounts (bank_name, account_number, account_name, is_active, display_order)
VALUES 
  ('First Bank of Nigeria', '1234567890', 'FoodDelivery Ltd', true, 1),
  ('GTBank', '0987654321', 'FoodDelivery Ltd', true, 2)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();

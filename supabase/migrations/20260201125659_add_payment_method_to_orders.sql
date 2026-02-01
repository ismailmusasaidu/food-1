/*
  # Add Payment Method to Orders

  1. Changes
    - Add `payment_method` column to orders table with type TEXT
    - Add `payment_status` column to track payment completion
    - Add `payment_reference` column to store transaction references (for Paystack, Transfer, etc.)
    - Set default payment_method to 'cash_on_delivery'
    - Set default payment_status to 'pending'

  2. Valid Payment Methods
    - cash_on_delivery
    - bank_transfer
    - wallet
    - paystack

  3. Valid Payment Statuses
    - pending
    - completed
    - failed
*/

-- Add payment_method column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash_on_delivery';
  END IF;
END $$;

-- Add payment_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Add payment_reference column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_reference'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_reference TEXT;
  END IF;
END $$;
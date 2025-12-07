/*
  # Add delivered_at column to orders table

  1. Changes
    - Add `delivered_at` column to track when an order was successfully delivered
    - This column is set when the rider marks the order as delivered
  
  2. Notes
    - Column is nullable since not all orders are delivered yet
    - Used by rider dashboard to track delivery completion
*/

-- Add delivered_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;
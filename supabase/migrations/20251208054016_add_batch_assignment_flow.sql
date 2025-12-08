/*
  # Add Batch Delivery Assignment Flow
  
  1. Changes to batch_deliveries table
    - Add `assigned_at` (timestamptz) - when the batch was assigned to the rider
    - Add `accepted_at` (timestamptz) - when the rider accepted the batch
    - Add `rejected_at` (timestamptz) - when the rider rejected the batch
    - Add `expires_at` (timestamptz) - when the assignment expires (10 minutes from assignment)
    - Update status check constraint to include 'assigned', 'accepted', 'rejected', 'expired'
    
  2. Purpose
    - Allow riders to accept or reject batch deliveries
    - Add countdown timer for assignment expiration
    - Track assignment lifecycle similar to individual orders
    
  3. Security
    - RLS policies remain unchanged
    - Riders can view and update their assigned batches
*/

-- Add new columns to batch_deliveries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batch_deliveries' AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE batch_deliveries ADD COLUMN assigned_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batch_deliveries' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE batch_deliveries ADD COLUMN accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batch_deliveries' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE batch_deliveries ADD COLUMN rejected_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'batch_deliveries' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE batch_deliveries ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Drop existing status check constraint
ALTER TABLE batch_deliveries 
DROP CONSTRAINT IF EXISTS batch_deliveries_status_check;

-- Add updated status check constraint with new statuses
ALTER TABLE batch_deliveries
ADD CONSTRAINT batch_deliveries_status_check 
CHECK (status = ANY (ARRAY['assigned'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));

-- Update existing batches with status 'pending' to 'assigned' and set expires_at
UPDATE batch_deliveries 
SET 
  status = 'assigned',
  expires_at = assigned_at + interval '10 minutes'
WHERE status = 'pending' 
  AND expires_at IS NULL;

-- Create function to auto-expire batch assignments
CREATE OR REPLACE FUNCTION expire_batch_assignments()
RETURNS void AS $$
BEGIN
  UPDATE batch_deliveries
  SET status = 'expired'
  WHERE status = 'assigned'
    AND expires_at < now()
    AND accepted_at IS NULL
    AND rejected_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_batch_deliveries_expires_at 
ON batch_deliveries(expires_at) 
WHERE status = 'assigned';

-- Add RLS policy for riders to update their batch assignments
CREATE POLICY "Riders can update their assigned batch status"
  ON batch_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
    AND status IN ('assigned', 'accepted', 'in_progress')
  )
  WITH CHECK (
    rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  );

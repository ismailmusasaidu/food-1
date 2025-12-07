/*
  # Auto-Expire Order Assignments

  ## Changes
  1. Update expired pending assignments to 'expired' status
  2. Create function to auto-expire assignments
  3. Create index for performance

  ## Notes
  - Cleans up expired assignments automatically
  - Prevents stale pending assignments from cluttering the database
*/

-- Update all expired pending assignments to expired status
UPDATE order_assignments
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at < NOW();

-- Create function to expire old assignments
CREATE OR REPLACE FUNCTION expire_old_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE order_assignments
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Create index for better performance on assignment queries
CREATE INDEX IF NOT EXISTS idx_order_assignments_rider_status_expires 
ON order_assignments(rider_id, status, expires_at);

-- Add comment
COMMENT ON FUNCTION expire_old_assignments IS 'Automatically marks expired pending assignments as expired';

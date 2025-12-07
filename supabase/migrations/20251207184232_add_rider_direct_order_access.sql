/*
  # Allow riders to view orders directly assigned to them

  1. Changes
    - Add RLS policy to allow riders to view orders where assigned_rider_id matches their rider profile
    - This covers cases where the order is directly assigned without going through order_assignments table

  2. Security
    - Riders can only view orders where assigned_rider_id matches their rider profile
    - Must verify rider_id through the riders table to ensure user owns the rider profile
*/

-- Allow riders to view orders directly assigned to them
CREATE POLICY "Riders can view directly assigned orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    assigned_rider_id IN (
      SELECT id
      FROM riders
      WHERE user_id = auth.uid()
    )
  );

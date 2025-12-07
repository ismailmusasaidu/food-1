/*
  # Allow riders to view assigned orders

  1. Changes
    - Add RLS policy to allow riders to view orders that are assigned to them
    - This is needed for the rider dashboard to display assignment details

  2. Security
    - Riders can only view orders where they have an active assignment
    - Must verify rider_id through the riders table to ensure user owns the rider profile
*/

-- Allow riders to view orders they are assigned to
CREATE POLICY "Riders can view assigned orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM order_assignments oa
      INNER JOIN riders r ON oa.rider_id = r.id
      WHERE oa.order_id = orders.id
        AND r.user_id = auth.uid()
    )
  );

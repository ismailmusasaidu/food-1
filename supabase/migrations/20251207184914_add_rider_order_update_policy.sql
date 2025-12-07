/*
  # Add Rider Order Update Policy

  1. Changes
    - Add UPDATE policy for riders to update orders they're assigned to
    - Allows riders to update delivery status fields and order status
  
  2. Security
    - Riders can only update orders where they are the assigned rider
    - Policy checks rider's user_id matches the assigned_rider_id via riders table
*/

CREATE POLICY "Riders can update assigned orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    assigned_rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  );

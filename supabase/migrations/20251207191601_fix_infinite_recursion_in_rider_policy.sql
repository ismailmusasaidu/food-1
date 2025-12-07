/*
  # Fix Infinite Recursion in Rider Update Policy

  ## Problem
  The WITH CHECK clause was querying the orders table, causing infinite recursion.

  ## Solution
  Simplify WITH CHECK to only validate that assigned_rider_id is either:
  - The rider's own ID
  - NULL (to allow clearing assignments)
  
  ## Security
  - Riders can only assign orders to themselves
  - Cannot assign orders to other riders
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Riders can update orders with accepted assignments" ON orders;

-- Create new policy without recursion
CREATE POLICY "Riders can update orders with accepted assignments"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if rider has an accepted assignment for this order
    EXISTS (
      SELECT 1 
      FROM order_assignments oa
      JOIN riders r ON oa.rider_id = r.id
      WHERE oa.order_id = orders.id
        AND r.user_id = auth.uid()
        AND oa.status = 'accepted'
    )
    -- OR if order is already assigned to this rider
    OR assigned_rider_id IN (
      SELECT id FROM riders WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Can only set assigned_rider_id to their own rider ID or leave it null
    assigned_rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
    OR assigned_rider_id IS NULL
  );

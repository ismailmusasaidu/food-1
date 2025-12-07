/*
  # Fix Rider Order Assignment Update Policy

  ## Problem
  Riders cannot update orders when accepting assignments because the RLS policy 
  requires assigned_rider_id to already be set, but it starts as null.

  ## Changes
  1. Drop the restrictive rider update policy
  2. Add new policy allowing riders to:
     - Update orders they have accepted assignments for
     - Update orders already assigned to them
  
  ## Security
  - Riders can only update orders with valid assignments
  - Prevents unauthorized order modifications
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Riders can update assigned orders" ON orders;

-- Create new policy that allows riders to update orders when they have an accepted assignment
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
    -- Can only set assigned_rider_id to their own rider ID or keep it unchanged
    (
      assigned_rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
      OR assigned_rider_id = (SELECT assigned_rider_id FROM orders WHERE id = orders.id)
    )
  );

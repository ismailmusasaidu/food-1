/*
  # Fix Admin Orders Policy Infinite Recursion

  ## Problem
  The admin policy on orders directly queries the profiles table, which triggers
  RLS checks that can cause infinite recursion.

  ## Solution
  Use the is_admin() SECURITY DEFINER function which bypasses RLS safely.

  ## Changes
  - Drop the problematic admin policy
  - Create new policy using is_admin() function
*/

-- Drop the problematic admin policy
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- Create new admin policy using the SECURITY DEFINER function
CREATE POLICY "Admins can manage all orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (is_admin());

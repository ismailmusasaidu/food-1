/*
  # Fix Bank Accounts RLS Policies

  1. Changes
    - Drop existing policies that may cause recursion
    - Create function to check if user is admin
    - Add new non-recursive policies for bank accounts

  2. Security
    - Admins can manage all bank accounts
    - Regular authenticated users can view active bank accounts
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view active bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can insert bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can update bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can delete bank accounts" ON bank_accounts;

-- Create function to check if current user is admin (if not exists)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policy for authenticated users to view active bank accounts
CREATE POLICY "Users can view active bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy for admins to view all bank accounts
CREATE POLICY "Admins can view all bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Policy for admins to insert bank accounts
CREATE POLICY "Admins can insert bank accounts"
  ON bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Policy for admins to update bank accounts
CREATE POLICY "Admins can update bank accounts"
  ON bank_accounts
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Policy for admins to delete bank accounts
CREATE POLICY "Admins can delete bank accounts"
  ON bank_accounts
  FOR DELETE
  TO authenticated
  USING (is_admin());

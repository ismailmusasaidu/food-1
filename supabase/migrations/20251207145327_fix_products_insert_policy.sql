/*
  # Fix Products Insert Policy
  
  1. Changes
    - Drop the existing "Vendors can manage own products" policy that uses FOR ALL
    - Create separate policies for INSERT, UPDATE, and DELETE operations
    - INSERT policy only uses WITH CHECK (not USING)
    - UPDATE policy uses both USING and WITH CHECK
    - DELETE policy only uses USING
  
  2. Security
    - Vendors can only insert products for their own vendor account
    - Vendors can only update their own products
    - Vendors can only delete their own products
*/

DROP POLICY IF EXISTS "Vendors can manage own products" ON products;

CREATE POLICY "Vendors can insert own products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can delete own products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can view own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );
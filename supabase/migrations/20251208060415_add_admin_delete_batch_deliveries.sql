/*
  # Add Admin Delete Policy for Batch Deliveries

  1. New Policies
    - Allow admins to delete batch deliveries
    - This enables route management cleanup by administrators
    
  2. Security
    - Only users with admin role can delete batch deliveries
    - Uses existing role checking mechanism
*/

-- Add DELETE policy for admins on batch_deliveries
CREATE POLICY "Admins can delete batch deliveries"
  ON batch_deliveries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

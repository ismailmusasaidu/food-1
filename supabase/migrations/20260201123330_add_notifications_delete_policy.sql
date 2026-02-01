/*
  # Add DELETE Policy for Notifications Table
  
  1. Changes
    - Add DELETE policy to allow users to delete their own notifications
    
  2. Security
    - Users can only delete their own notifications (user_id matches auth.uid())
    - This enables riders and other users to dismiss/clear notifications
*/

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

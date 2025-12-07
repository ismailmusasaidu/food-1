/*
  # Enable Realtime for Orders Table

  1. Changes
    - Add orders table to realtime publication
    - This allows riders to receive real-time updates when orders are assigned to them

  2. Purpose
    - Rider dashboard will automatically update when orders are assigned
    - Eliminates the issue of orders disappearing after acceptance
*/

ALTER PUBLICATION supabase_realtime ADD TABLE orders;

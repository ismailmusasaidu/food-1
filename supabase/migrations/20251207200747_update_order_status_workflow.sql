/*
  # Update Order Status Workflow

  1. Changes
    - Replace existing order statuses with new simplified workflow
    - Old statuses: pending, confirmed, preparing, ready_for_pickup, rider_assigned, rider_approaching, picked_up, in_transit, out_for_delivery, delivered, cancelled
    - New statuses: pending, confirmed, arrived_at_vendor, pickup_complete, arrived_at_customer, delivered, cancelled
  
  2. Security
    - No changes to RLS policies
    - Existing policies will continue to work with new status values
*/

-- Drop the existing enum type and recreate it with new values
ALTER TABLE orders 
  ALTER COLUMN status TYPE text;

DROP TYPE IF EXISTS order_status CASCADE;

CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'arrived_at_vendor',
  'pickup_complete',
  'arrived_at_customer',
  'delivered',
  'cancelled'
);

-- Convert the column back to the enum type
ALTER TABLE orders 
  ALTER COLUMN status TYPE order_status USING 
    CASE 
      WHEN status IN ('pending') THEN 'pending'::order_status
      WHEN status IN ('confirmed') THEN 'confirmed'::order_status
      WHEN status IN ('preparing', 'ready_for_pickup', 'rider_assigned') THEN 'arrived_at_vendor'::order_status
      WHEN status IN ('rider_approaching', 'picked_up') THEN 'pickup_complete'::order_status
      WHEN status IN ('in_transit', 'out_for_delivery') THEN 'arrived_at_customer'::order_status
      WHEN status IN ('delivered') THEN 'delivered'::order_status
      WHEN status IN ('cancelled') THEN 'cancelled'::order_status
      ELSE 'pending'::order_status
    END;

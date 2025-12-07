/*
  # Add in_transit status to order_status enum

  1. Changes
    - Add 'in_transit' status to order_status enum
    - This status represents when rider is actively delivering the order
  
  2. Status Flow
    - pending -> confirmed -> preparing -> rider_assigned -> rider_approaching -> picked_up -> in_transit -> out_for_delivery -> delivered
*/

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_transit' AFTER 'picked_up';

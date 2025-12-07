/*
  # Add picked_up status to order_status enum

  1. Changes
    - Add 'picked_up' status to order_status enum
    - This status represents when rider has picked up the order from vendor
  
  2. Status Flow
    - pending -> confirmed -> preparing -> rider_assigned -> rider_approaching -> picked_up -> out_for_delivery -> delivered
*/

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'picked_up' AFTER 'rider_approaching';

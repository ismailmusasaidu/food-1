/*
  # Add Batch Delivery Notifications

  1. Changes
    - Create trigger function to notify riders about batch deliveries
    - Create trigger on batch_deliveries table
    
  2. Security
    - Functions run with security definer privileges
*/

-- Function to notify rider when assigned a batch delivery
CREATE OR REPLACE FUNCTION notify_rider_on_batch_assignment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rider_user_id uuid;
  v_order_count int;
BEGIN
  -- Get rider's user_id
  SELECT user_id INTO v_rider_user_id
  FROM riders
  WHERE id = NEW.rider_id;

  -- Get number of orders in batch (will be 0 initially, but that's ok)
  SELECT COUNT(*) INTO v_order_count
  FROM batch_delivery_orders
  WHERE batch_id = NEW.id;

  -- Create notification for rider
  IF v_rider_user_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      read,
      created_at
    ) VALUES (
      v_rider_user_id,
      'batch_delivery',
      'New Batch Delivery Assigned',
      'You have been assigned a batch delivery for ' || NEW.meal_time || ' meal time.',
      jsonb_build_object(
        'batch_id', NEW.id,
        'meal_time', NEW.meal_time,
        'pickup_window_start', NEW.pickup_window_start,
        'pickup_window_end', NEW.pickup_window_end,
        'delivery_deadline', NEW.delivery_deadline,
        'order_count', v_order_count
      ),
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new batch deliveries
DROP TRIGGER IF EXISTS on_batch_delivery_created ON batch_deliveries;
CREATE TRIGGER on_batch_delivery_created
  AFTER INSERT ON batch_deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_rider_on_batch_assignment();
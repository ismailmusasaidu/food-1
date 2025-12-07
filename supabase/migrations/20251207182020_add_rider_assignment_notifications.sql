/*
  # Add Rider Assignment Notifications

  1. Changes
    - Create trigger function to automatically send notifications to riders when assigned
    - Create trigger on order_assignments table to send notifications on insert
    - Add function to clean up expired assignments
    
  2. Security
    - Functions run with security definer privileges to insert notifications
*/

-- Function to notify rider when assigned an order
CREATE OR REPLACE FUNCTION notify_rider_on_assignment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rider_user_id uuid;
  v_order_number text;
  v_delivery_address text;
BEGIN
  -- Get rider's user_id
  SELECT user_id INTO v_rider_user_id
  FROM riders
  WHERE id = NEW.rider_id;

  -- Get order details
  SELECT order_number, delivery_address INTO v_order_number, v_delivery_address
  FROM orders
  WHERE id = NEW.order_id;

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
      'order_assignment',
      'New Order Assignment',
      'You have been assigned order ' || v_order_number || '. Please accept within 10 minutes.',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'assignment_id', NEW.id,
        'order_number', v_order_number,
        'delivery_address', v_delivery_address,
        'expires_at', NEW.expires_at
      ),
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new order assignments
DROP TRIGGER IF EXISTS on_order_assignment_created ON order_assignments;
CREATE TRIGGER on_order_assignment_created
  AFTER INSERT ON order_assignments
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_rider_on_assignment();

-- Function to clean up expired assignments
CREATE OR REPLACE FUNCTION cleanup_expired_assignments()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update expired pending assignments to cancelled
  UPDATE order_assignments
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;
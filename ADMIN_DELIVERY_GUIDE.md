# Admin Delivery Assignment Guide

This guide explains how administrators can assign riders to deliveries using both on-demand and scheduled batch delivery methods.

## Overview

The admin dashboard now includes three new sections for managing delivery assignments:

1. **Assign Deliveries** - Main hub for assigning riders to orders
2. **View Routes** - Monitor and manage delivery routes
3. **Manage Riders** - View and approve riders

## Getting Started

1. Log in as an admin user
2. Navigate to the Admin tab
3. Click on "Assign Deliveries" to access the rider assignment system

---

## On-Demand Delivery Assignment

Use this for individual orders that need immediate delivery.

### How to Assign

1. **Click "Assign On-Demand Delivery"**
   - View all unassigned orders that are marked for delivery

2. **Select an Order**
   - Tap on any order card to select it
   - View order details including:
     - Order number and total amount
     - Restaurant/vendor location
     - Customer delivery address
     - Meal time preference (if any)

3. **Choose a Rider**
   - View all available riders with their:
     - Current status (Available, Busy, Offline)
     - Rating and completed deliveries
     - Phone number
   - Only riders with "Available" or "Busy" status are shown

4. **Confirm Assignment**
   - Tap "Assign Rider" button
   - The rider will receive a pending assignment notification
   - They have 10 minutes to accept or decline

### What Happens Next

- The rider sees the assignment in their "Pending Assignments" section
- They can accept or decline within 10 minutes
- If accepted, the order moves to their "Active Deliveries"
- If declined or expired, you'll need to reassign to another rider

---

## Scheduled Batch Delivery

Use this for grouping multiple orders by meal time for efficient delivery.

### When to Use Batch Delivery

- Multiple orders going to the same area
- Orders scheduled for specific meal times (Breakfast, Lunch, Dinner)
- Want to optimize delivery routes and efficiency

### How to Create a Batch

1. **Click "Create Batch Delivery"**

2. **Select Meal Time**
   - Choose: Breakfast, Lunch, or Dinner
   - This helps organize deliveries by time windows

3. **Select Multiple Orders**
   - Tap order cards to select them (they'll highlight)
   - Selected count shows at the top
   - You can select as many orders as needed

4. **Choose a Rider**
   - View available riders
   - Consider their current workload and location

5. **Create Batch**
   - Tap "Create Batch" button
   - System automatically:
     - Sets a pickup window (30-60 minutes from now)
     - Sets a delivery deadline (2 hours from now)
     - Assigns orders to the rider
     - Creates an optimized sequence

### Batch Delivery Details

**Pickup Window:**
- Start: 30 minutes from creation
- End: 60 minutes from creation

**Delivery Deadline:**
- 2 hours from creation
- Rider must complete all deliveries by this time

**Delivery Sequence:**
- Orders are numbered 1, 2, 3, etc.
- Rider follows this sequence for deliveries
- Can be optimized later for better routes

---

## Route Management

View and manage all active delivery routes.

### Accessing Routes

1. From admin dashboard, click "View Routes"
2. See all active batch deliveries

### Route Overview

For each batch, you'll see:
- **Meal Time Badge** - Breakfast/Lunch/Dinner
- **Status** - Pending, In Progress, Completed, Cancelled
- **Rider Name** - Assigned rider
- **Statistics:**
  - Total number of stops
  - Completed vs remaining deliveries
  - Time windows

### Detailed Route View

Tap on any batch to see:

1. **Batch Information**
   - Rider details and contact
   - Pickup window times
   - Delivery deadline
   - Progress bar showing completion

2. **Delivery Stops**
   - Numbered sequence (1, 2, 3...)
   - Order number
   - Restaurant pickup address
   - Customer delivery address
   - Order total
   - Delivery status (Pending/Delivered)

3. **Route Optimization**
   - For pending batches, tap "Optimize Route"
   - This will reorder stops for the most efficient path
   - (Note: Algorithm to be implemented)

---

## Rider Status Guide

### Available
- Rider is online and ready to accept deliveries
- Can be assigned orders immediately

### Busy
- Rider is currently on a delivery
- Can still be assigned for future deliveries
- May take longer to respond

### Offline
- Rider is not working
- Cannot be assigned deliveries
- Hidden from assignment options

---

## Best Practices

### On-Demand Assignments

✅ **DO:**
- Assign to available riders first
- Check rider ratings and experience
- Consider rider's current location (future feature)

❌ **DON'T:**
- Assign to offline riders
- Ignore order priority

### Batch Deliveries

✅ **DO:**
- Group orders by geographic area
- Use appropriate meal time windows
- Limit batches to 5-8 orders for manageability
- Consider order preparation times

❌ **DON'T:**
- Mix breakfast and dinner orders
- Create batches with too many stops (>10)
- Assign batches too close to meal time

### Route Management

✅ **DO:**
- Monitor batch progress regularly
- Check for delayed deliveries
- Optimize routes before riders start
- Communicate with riders if issues arise

❌ **DON'T:**
- Change routes mid-delivery
- Add orders to in-progress batches

---

## Notifications

### Admin Notifications
You'll be notified when:
- Rider accepts/declines assignment
- Assignment expires
- Delivery is completed
- Issues are reported

### Rider Notifications
Riders receive notifications for:
- New order assignments
- Assignment expiring soon (30 seconds left)
- Batch delivery scheduled
- Order status updates

---

## Troubleshooting

### Order Not Showing in Unassigned List

**Possible Reasons:**
- Order delivery_type is set to "pickup" (not "delivery")
- Order already has an assigned rider
- Order status is not pending/confirmed/preparing

**Solution:**
- Check order details in Order Management
- Ensure delivery_type is "delivery"
- Verify no rider is assigned

### Rider Not Appearing in List

**Possible Reasons:**
- Rider status is not "approved"
- Rider is offline
- Rider account is suspended

**Solution:**
- Go to Manage Riders
- Check rider approval status
- Contact rider to go online

### Assignment Not Received by Rider

**Possible Reasons:**
- Rider is offline
- Network connection issue
- Assignment expired

**Solution:**
- Check rider's online status
- Contact rider directly
- Create new assignment

---

## Database Tables

For reference, the system uses these tables:

### `order_assignments`
- Stores individual order assignments
- Tracks acceptance/rejection
- Has 2-minute expiration timer

### `batch_deliveries`
- Stores batch delivery information
- Links to rider
- Tracks meal time and time windows

### `batch_delivery_orders`
- Links orders to batches
- Defines delivery sequence
- Tracks individual delivery completion

### `orders`
- Has `assigned_rider_id` field
- Tracks which rider is handling delivery

---

## Future Enhancements

Planned features:
- Real-time map view with rider locations
- Automatic route optimization algorithm
- Distance-based assignment suggestions
- Rider workload balancing
- Earnings calculations per batch
- Customer ETA notifications
- Historical route analytics

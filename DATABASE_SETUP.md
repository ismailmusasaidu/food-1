# Database Setup Instructions

This document describes the database schema for the food delivery platform. The schema has been set up through migrations in the `supabase/migrations/` directory.

## Database Overview

The platform uses a multi-role system supporting:
- **Customers** - Browse and order food
- **Vendors** - Manage restaurants and menu items
- **Riders** - Handle deliveries with batch assignment support
- **Admins** - Platform management and oversight

## Core Tables

### User Management

#### profiles
User profiles with role-based access control.
- Supports multiple roles: customer, vendor, admin, rider
- Vendor approval workflow (vendor_status: pending, approved, rejected)
- Business information fields for vendor applications
- User suspension capabilities (is_suspended, suspended_at, suspended_by)

#### riders
Delivery rider profiles and verification.
- Rider approval workflow (status: pending, approved, rejected, suspended)
- Motorbike details and documentation (NIN, passport, license)
- Next of kin information
- Performance tracking (rating, deliveries, average delivery time)
- Current status (available, busy, offline)

#### rider_live_status
Real-time rider availability and location tracking.
- Current status and location
- Last active timestamp
- Used for assignment algorithms

### Business Management

#### categories
Product/food categories for organizing menu items.
- Display order and active status
- Icons for UI display

#### vendors
Restaurant/vendor business information.
- Business details (name, description, logo, address)
- Operating settings (hours, delivery radius, minimum order)
- Verification and approval status
- Performance metrics (rating, total sales)
- Cuisine types and preparation times
- Real-time availability (is_currently_open, is_accepting_orders)

#### vendor_settings
Extended vendor configuration.
- Store hours, payment methods
- Delivery settings
- Social media links
- Setup completion status

#### vendor_hours
Detailed operating hours per day of week.
- Day-specific opening/closing times
- Closed day tracking

### Products & Shopping

#### products
Menu items with detailed information.
- Pricing, stock, and availability
- Preparation time
- Dietary information (vegetarian, vegan, allergens)
- Spice level (0-5)
- Rating and review counts

#### product_images
Multiple images per product.
- Display order
- Primary image designation

#### carts
Shopping cart with real-time updates.
- One cart item per user-product combination
- Quantity tracking

### Orders & Delivery

#### orders
Customer orders with comprehensive tracking.
- Order statuses: pending, confirmed, arrived_at_vendor, pickup_complete, arrived_at_customer, delivered, cancelled
- Delivery types: pickup, delivery
- Meal time preferences: breakfast, lunch, dinner
- Pricing breakdown (subtotal, delivery fee, tax, total)
- Rider assignment tracking
- Timestamp tracking for each delivery stage
- Scheduled delivery support

#### order_items
Individual items within orders.
- Product reference with snapshot pricing
- Quantity and subtotal

#### order_assignments
Individual order assignments to riders.
- Assignment workflow (pending, accepted, expired, cancelled)
- Expiration timestamps
- Acceptance tracking

#### batch_deliveries
Batch delivery assignments for meal times.
- Meal time grouping (breakfast, lunch, dinner)
- Pickup and delivery windows
- Status tracking (assigned, accepted, rejected, expired, pending, in_progress, completed, cancelled)
- Multiple orders per batch

#### batch_delivery_orders
Links orders to batch deliveries.
- Delivery sequence within batch
- Individual delivery timestamps

#### rider_deliveries
Delivery tracking records.
- Pickup and delivery locations
- Status tracking (assigned, picked_up, in_transit, delivered, failed)
- Customer ratings
- Package count

#### rider_earnings
Rider payment tracking.
- Per-delivery earnings
- Payment status (pending, paid)
- Date tracking for payroll

#### delivery_issues
Delivery problem reporting.
- Issue types: customer_not_picking, address_not_found, refund_requested, other
- Resolution tracking
- Linked to specific orders and riders

### Reviews & Communication

#### reviews
Product reviews and ratings.
- 1-5 star rating
- Comment text
- Linked to orders for verified purchases
- Automatic product rating updates

#### notifications
In-app notifications for all users.
- Type, title, and message
- Additional data as JSON
- Read status tracking

## Order Status Flow

The order progresses through these statuses:

1. **pending** - Order created, awaiting vendor confirmation
2. **confirmed** - Vendor accepted order, preparing food
3. **arrived_at_vendor** - Rider arrived for pickup
4. **pickup_complete** - Rider picked up order
5. **arrived_at_customer** - Rider arrived at delivery location
6. **delivered** - Order successfully delivered
7. **cancelled** - Order cancelled (can happen at any stage)

## Delivery Types

### Pickup Orders
Customer picks up directly from vendor. No rider assignment needed.

### Delivery Orders
Two assignment methods:

1. **Individual Assignment** - Single order assigned to available rider
2. **Batch Assignment** - Multiple orders grouped by meal time (breakfast, lunch, dinner) assigned to one rider

## Security (Row Level Security)

All tables have RLS enabled with policies enforcing:

- **Customers** - Can only view and manage their own data (orders, cart, reviews)
- **Vendors** - Can only manage their own restaurant, products, and related orders
- **Riders** - Can only access assigned deliveries and their earnings
- **Admins** - Full access for platform management

## Real-time Features

The following tables have real-time subscriptions enabled:
- `orders` - Live order status updates
- `carts` - Real-time cart synchronization
- `notifications` - Instant notification delivery

## Getting Started

### For Development

1. The database schema is managed through migrations in `supabase/migrations/`
2. All migrations are automatically applied when you connect to the Supabase project
3. The database is already set up and ready to use

### Default Data

The following default categories are pre-loaded:
- Pizza, Burgers, Asian, Desserts, Beverages
- Groceries, Fresh Meat, Fresh Chicken, Fresh Fish
- Other (miscellaneous products)

### Creating Users

1. **Customer Account** - Register through the app (default role)
2. **Vendor Account** - Register via vendor registration flow, requires admin approval
3. **Rider Account** - Register via rider registration flow, requires admin approval and document verification
4. **Admin Account** - Must be manually assigned in the database or by another admin

### Vendor Approval Workflow

1. Vendor registers with business information
2. Profile has `vendor_status: 'pending'`
3. Admin reviews application in admin panel
4. Admin approves (`vendor_status: 'approved'`) or rejects with reason
5. Approved vendors can create vendor profile and add products

### Rider Approval Workflow

1. Rider registers with personal details, NIN, motorbike info, and documents
2. Rider has `status: 'pending'`
3. Admin reviews application and documents
4. Admin approves (`status: 'approved'`) or rejects
5. Approved riders can go online and accept deliveries

## Database Relationships

```
profiles (auth.users)
├── vendors (one-to-one for vendor role)
│   ├── products (one-to-many)
│   │   ├── product_images (one-to-many)
│   │   └── reviews (one-to-many)
│   ├── vendor_settings (one-to-one)
│   ├── vendor_hours (one-to-many)
│   └── orders as vendor (one-to-many)
├── riders (one-to-one for rider role)
│   ├── rider_live_status (one-to-one)
│   ├── order_assignments (one-to-many)
│   ├── batch_deliveries (one-to-many)
│   ├── rider_deliveries (one-to-many)
│   └── rider_earnings (one-to-many)
├── orders as customer (one-to-many)
│   ├── order_items (one-to-many)
│   └── reviews (one-to-many)
├── carts (one-to-many)
└── notifications (one-to-many)

categories
└── products (one-to-many)
```

## Performance Indexes

Indexes are created on frequently queried columns:
- Profile roles and status fields
- Product vendor and category foreign keys
- Order customer, vendor, rider, and status fields
- Cart user references
- Rider status and user references
- Notifications user references
- Assignment and delivery rider references

## Notes

- All timestamps use `timestamptz` for proper timezone handling
- Numeric fields for money use `numeric(10,2)` for precision
- JSONB fields store complex data (operating hours, motorbike details, etc.)
- Enums enforce valid values for roles, statuses, and types
- Foreign key constraints maintain referential integrity with CASCADE deletes where appropriate

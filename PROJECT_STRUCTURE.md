# Food Delivery Platform - Project Structure

## Overview

This is a comprehensive multi-role food delivery platform built with:
- **Frontend**: Expo (React Native) - Cross-platform mobile app
- **Backend**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth (email/password)

## Project Status

✅ **Database**: Fully configured with 20 tables across 53 migrations
✅ **Authentication**: Complete with role-based access
✅ **User Roles**: Customer, Vendor, Rider, Admin
✅ **Core Features**: Orders, Cart, Products, Reviews, Delivery tracking
✅ **Advanced Features**: Batch deliveries, Real-time updates, Notifications

## Architecture

### Frontend Structure (`/app`)

```
app/
├── (tabs)/              # Main tab navigation
│   ├── index.tsx       # Home (role-based)
│   ├── cart.tsx        # Shopping cart
│   ├── orders.tsx      # Order history
│   ├── profile.tsx     # User profile
│   ├── vendor.tsx      # Vendor dashboard
│   ├── rider.tsx       # Rider dashboard
│   └── admin.tsx       # Admin panel
├── auth/               # Authentication flows
│   ├── login.tsx
│   ├── register.tsx
│   ├── vendor-pending.tsx
│   ├── rider-register.tsx
│   └── rider-pending.tsx
├── restaurant/         # Restaurant pages
│   └── [id].tsx       # Restaurant menu view
├── rider/             # Rider-specific pages
│   ├── batch/[id].tsx  # Batch delivery details
│   └── delivery/[id].tsx # Individual delivery
├── checkout.tsx       # Checkout flow
├── order-tracking.tsx # Order status tracking
├── help-center.tsx    # Help & support
├── privacy-policy.tsx # Privacy policy
├── terms-of-service.tsx # Terms of service
└── _layout.tsx        # Root layout with auth provider
```

### Components (`/components`)

#### Core Components
- `CartIconWithBadge.tsx` - Cart with item count
- `OrderItemsList.tsx` - Order items display
- `ProductCard.tsx` - Product display card
- `ProductDetailModal.tsx` - Product details
- `ProductReviews.tsx` - Review list
- `RestaurantCard.tsx` - Restaurant display
- `ReviewForm.tsx` - Review submission

#### Home Components
- `home/CustomerHome.tsx` - Customer homepage
- `home/VendorHome.tsx` - Vendor dashboard
- `home/AdminHome.tsx` - Admin dashboard

#### Vendor Components
- `vendor/StoreSetup.tsx` - Initial store configuration
- `vendor/AddProduct.tsx` - Product creation
- `vendor/EditProduct.tsx` - Product editing
- `vendor/VendorOrderManagement.tsx` - Order management

#### Rider Components
- `rider/StatusToggle.tsx` - Online/offline toggle
- `rider/OrderAssignmentCard.tsx` - Individual order card
- `rider/BatchAssignmentCard.tsx` - Batch delivery card
- `rider/BatchDeliveryCard.tsx` - Active batch delivery
- `rider/NotificationsList.tsx` - Rider notifications

#### Admin Components
- `admin/UserManagement.tsx` - User administration
- `admin/VendorManagement.tsx` - Vendor approval
- `admin/RiderManagement.tsx` - Rider approval
- `admin/ProductManagement.tsx` - Product oversight
- `admin/OrderManagement.tsx` - Order monitoring
- `admin/RouteManager.tsx` - Delivery route planning
- `admin/RiderAssignmentManager.tsx` - Manual rider assignment
- `admin/ContentManagement.tsx` - Content management

### Database (`/supabase`)

#### Migrations (53 files)
Incremental schema changes tracking the evolution of:
- User roles and approval workflows
- Order status transitions
- Rider delivery system
- Batch delivery assignments
- RLS policy fixes and optimizations

#### Edge Functions
- `admin-orders/index.ts` - Admin order management API

### Configuration Files

- `.env` - Environment variables (Supabase credentials)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `app.json` - Expo configuration
- `expo-env.d.ts` - Expo type definitions

### Type Definitions (`/types`)

- `database.ts` - Complete TypeScript interfaces for all database tables

### Context & State (`/contexts`)

- `AuthContext.tsx` - Authentication state management

### Utilities (`/lib`)

- `supabase.ts` - Supabase client initialization
- `cartEvents.ts` - Cart event management

## Key Features

### Multi-Role System

1. **Customer**
   - Browse restaurants and products
   - Add items to cart
   - Place orders (pickup or delivery)
   - Track order status
   - Leave reviews

2. **Vendor**
   - Registration with business verification
   - Store setup and management
   - Product catalog management
   - Order fulfillment
   - Sales analytics

3. **Rider**
   - Registration with document verification
   - Online/offline status toggle
   - Individual order assignments
   - Batch delivery assignments (meal times)
   - Earnings tracking
   - Delivery issue reporting

4. **Admin**
   - User management (suspend/activate)
   - Vendor approval workflow
   - Rider approval workflow
   - Order monitoring
   - Content management
   - Manual rider assignments

### Order Flow

1. Customer adds items to cart
2. Proceeds to checkout
3. Selects delivery type (pickup/delivery)
4. Places order → Status: **pending**
5. Vendor confirms → Status: **confirmed**
6. *For delivery orders*:
   - Rider assigned (individual or batch)
   - Rider accepts assignment
   - Rider arrives at vendor → Status: **arrived_at_vendor**
   - Rider picks up order → Status: **pickup_complete**
   - Rider arrives at customer → Status: **arrived_at_customer**
7. Order delivered → Status: **delivered**

### Delivery System

#### Individual Assignment
- Single order assigned to an available rider
- 5-minute acceptance window
- Real-time status updates

#### Batch Assignment
- Multiple orders grouped by meal time (breakfast, lunch, dinner)
- One rider handles multiple deliveries in sequence
- Optimized pickup and delivery windows
- Increased rider efficiency

### Real-time Features

- Order status updates
- Cart synchronization across devices
- Instant notifications
- Rider location tracking
- Live vendor availability

## Database Schema Summary

### 20 Tables
1. `profiles` - User accounts
2. `categories` - Product categories
3. `vendors` - Restaurants/vendors
4. `vendor_settings` - Vendor configuration
5. `vendor_hours` - Operating hours
6. `products` - Menu items
7. `product_images` - Product photos
8. `carts` - Shopping carts
9. `orders` - Customer orders
10. `order_items` - Order line items
11. `reviews` - Product reviews
12. `riders` - Delivery riders
13. `rider_live_status` - Rider availability
14. `rider_deliveries` - Delivery records
15. `rider_earnings` - Payment tracking
16. `order_assignments` - Individual assignments
17. `batch_deliveries` - Batch assignments
18. `batch_delivery_orders` - Batch order links
19. `delivery_issues` - Problem reports
20. `notifications` - In-app notifications

### 4 Custom Enums
- `user_role`: customer, vendor, admin, rider
- `order_status`: pending, confirmed, arrived_at_vendor, pickup_complete, arrived_at_customer, delivered, cancelled
- `rider_status`: pending, approved, rejected, suspended
- `delivery_status`: assigned, picked_up, in_transit, delivered, failed

## Security

### Row Level Security (RLS)
All tables have RLS enabled with policies enforcing:
- Users can only access their own data
- Vendors can only manage their restaurants
- Riders can only see assigned deliveries
- Admins have oversight capabilities

### Authentication
- Email/password authentication via Supabase Auth
- Protected routes based on user role
- Session management with secure tokens

## Development

### Scripts
```bash
npm run dev          # Start Expo development server
npm run build:web    # Build for web
npm run lint         # Lint code
npm run typecheck    # TypeScript type checking
```

### Environment Variables
Required in `.env`:
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Documentation Files

- `README.md` - Project overview and setup
- `DATABASE_SETUP.md` - Complete database documentation
- `ADMIN_DELIVERY_GUIDE.md` - Admin delivery management guide
- `PROJECT_STRUCTURE.md` - This file

## Next Steps for Development

1. **Testing** - Add comprehensive unit and integration tests
2. **Payment Integration** - Add payment gateway (Stripe/PayPal)
3. **Push Notifications** - Implement native push notifications
4. **Maps Integration** - Add map view for delivery tracking
5. **Analytics** - Add business intelligence dashboards
6. **Performance** - Optimize queries and add caching
7. **Localization** - Add multi-language support

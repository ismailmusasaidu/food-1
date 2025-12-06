# Database Setup Instructions

This file contains the SQL you need to run in your Supabase SQL Editor to set up the database for your food delivery app.

## How to Run This SQL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste ALL the SQL below
6. Click "Run" or press Ctrl+Enter

## SQL Schema

```sql
-- Create enum types
CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  avatar_url text,
  role user_role DEFAULT 'customer' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  icon text,
  display_order integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" ON categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  business_name text UNIQUE NOT NULL,
  description text,
  logo_url text,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  rating decimal(3,2) DEFAULT 0 NOT NULL,
  total_sales integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active verified vendors" ON vendors FOR SELECT TO authenticated USING (is_active = true AND is_verified = true);
CREATE POLICY "Vendors can view own vendor profile" ON vendors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Vendors can update own vendor profile" ON vendors FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage vendors" ON vendors FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price decimal(10,2) NOT NULL,
  unit text DEFAULT 'piece' NOT NULL,
  stock_quantity integer DEFAULT 0 NOT NULL,
  is_available boolean DEFAULT true NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  rating decimal(3,2) DEFAULT 0 NOT NULL,
  total_reviews integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products" ON products FOR SELECT TO authenticated USING (is_available = true AND stock_quantity > 0);
CREATE POLICY "Vendors can manage own products" ON products FOR ALL TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all products" ON products FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, product_id)
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart" ON carts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  order_number text UNIQUE NOT NULL,
  status order_status DEFAULT 'pending' NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  delivery_fee decimal(10,2) DEFAULT 0 NOT NULL,
  tax decimal(10,2) DEFAULT 0 NOT NULL,
  total decimal(10,2) NOT NULL,
  delivery_address text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own orders" ON orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers can create orders" ON orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Vendors can view own orders" ON orders FOR SELECT TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));
CREATE POLICY "Vendors can update own orders" ON orders FOR UPDATE TO authenticated USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())) WITH CHECK (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));
CREATE POLICY "Admins can manage all orders" ON orders FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) NOT NULL,
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON order_items FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid() OR vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())));
CREATE POLICY "Customers can create order items" ON order_items FOR INSERT TO authenticated WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));
CREATE POLICY "Admins can manage all order items" ON order_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, user_id, order_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create reviews for purchased products" ON reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

-- Insert default categories
INSERT INTO categories (name, description, icon, display_order) VALUES
  ('Groceries', 'Essential grocery items and pantry staples', 'shopping-cart', 1),
  ('Fresh Meat', 'Premium quality fresh meat cuts', 'beef', 2),
  ('Fresh Chicken', 'Farm fresh chicken products', 'drumstick', 3),
  ('Fresh Fish', 'Ocean fresh fish and seafood', 'fish', 4),
  ('Other', 'Additional products and items', 'package', 5)
ON CONFLICT (name) DO NOTHING;
```

## After Running the SQL

The database is now set up! You can:

1. Register a new account in the app (defaults to 'customer' role)
2. To create admin or vendor accounts, update the role in the Supabase Table Editor:
   - Go to "Table Editor" > "profiles"
   - Find the user and change their "role" field

## Next Steps

To add sample data (restaurants and menu items), you'll need to:

1. Create a vendor profile in the profiles table with role='vendor'
2. Add a restaurant entry in the vendors table with:
   - Business information
   - Operating hours (opening/closing times)
   - Cuisine types
   - Average preparation time
   - Delivery radius
3. Add menu items in the products table linked to that restaurant

The app now includes:
- Restaurant registration with operating hours
- Menu items with preparation times
- Delivery radius settings
- Real-time availability tracking
- Food categories (Pizza, Burgers, Asian, etc.)

Enjoy your food delivery app!

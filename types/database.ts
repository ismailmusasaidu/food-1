export type UserRole = 'customer' | 'vendor' | 'admin' | 'rider';

export type VendorStatus = 'pending' | 'approved' | 'rejected';

export type RiderStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type DeliveryStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived_at_vendor'
  | 'pickup_complete'
  | 'arrived_at_customer'
  | 'delivered'
  | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  vendor_status: VendorStatus;
  business_name?: string;
  business_description?: string;
  business_address?: string;
  business_phone?: string;
  business_license?: string;
  rejection_reason?: string;
  is_suspended: boolean;
  suspended_at?: string;
  suspended_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  business_name: string;
  description?: string;
  logo_url?: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  total_sales: number;
  cuisine_type?: string;
  opening_time?: string;
  closing_time?: string;
  average_prep_time?: number;
  delivery_radius?: number;
  minimum_order?: number;
  is_accepting_orders?: boolean;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  average_preparation_time?: number;
  cuisine_types?: string[];
  is_currently_open?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  vendor_id: string;
  category_id: string;
  name: string;
  description?: string;
  image_url?: string;
  price: number;
  unit: string;
  stock_quantity: number;
  is_available: boolean;
  is_featured: boolean;
  rating: number;
  total_reviews: number;
  preparation_time?: number;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  spice_level?: number;
  allergens?: string[];
  is_available_now?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  vendor_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  delivery_address: string;
  delivery_type: 'pickup' | 'delivery';
  meal_time_preference?: 'breakfast' | 'lunch' | 'dinner';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_id?: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  nin: string;
  motorbike_details: {
    make?: string;
    model?: string;
    year?: number;
    plate_number?: string;
    color?: string;
  };
  passport_photo_url?: string;
  license_url?: string;
  next_of_kin: {
    name?: string;
    phone?: string;
    relationship?: string;
    address?: string;
  };
  status: RiderStatus;
  rating: number;
  total_deliveries: number;
  created_at: string;
  updated_at: string;
}

export interface RiderEarning {
  id: string;
  rider_id: string;
  order_id?: string;
  amount: number;
  date: string;
  status: 'pending' | 'paid';
  created_at: string;
}

export interface RiderDelivery {
  id: string;
  rider_id: string;
  order_id: string;
  pickup_location: string;
  delivery_location: string;
  pickup_time?: string;
  delivery_time?: string;
  status: DeliveryStatus;
  package_count: number;
  customer_rating?: number;
  notes?: string;
  created_at: string;
}

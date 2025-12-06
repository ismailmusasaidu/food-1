# Food Delivery App

A full-featured food delivery application built with React Native (Expo) and Supabase.

## Features

### For Customers
- Browse restaurants by cuisine type
- View menu items with preparation times
- Real-time restaurant operating status
- Add items to cart and place orders
- Track order status
- Rate and review menu items

### For Restaurant Owners (Vendors)
- Register your restaurant with operating hours
- Set cuisine types and delivery radius
- Manage menu items with preparation times
- Track orders in real-time
- Update availability and operating hours
- View sales and order history

### For Admins
- Approve new restaurant registrations
- Manage users and restaurants
- Monitor orders across all restaurants
- Content management
- User moderation

## Key Features
- **Operating Hours**: Restaurants can set opening and closing times
- **Preparation Time**: Each menu item has an estimated preparation time
- **Cuisine Types**: Filter restaurants by cuisine (Italian, Chinese, Mexican, etc.)
- **Delivery Radius**: Restaurants set their delivery coverage area
- **Real-time Updates**: Order status updates in real-time
- **Reviews & Ratings**: Customers can rate and review menu items

## Tech Stack
- React Native (Expo)
- Supabase (Database & Authentication)
- TypeScript
- React Navigation

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase:
   - Create a Supabase project
   - Run the SQL in `DATABASE_SETUP.md`
   - Update your `.env` file with Supabase credentials

3. Start the app:
   ```bash
   npm run dev
   ```

## Database Schema

The app includes tables for:
- Users/Profiles (with roles: customer, vendor, admin)
- Restaurants (vendors) with operating hours and settings
- Menu items (products) with preparation times
- Orders and order tracking
- Reviews and ratings
- Food categories

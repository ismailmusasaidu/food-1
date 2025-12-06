import { Tabs, router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Home, Package, Users, User, Bike } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CartIconWithBadge from '@/components/CartIconWithBadge';

export default function TabLayout() {
  const { session, loading, profile } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && (!session || !profile)) {
      router.replace('/auth/login');
    }
  }, [session, profile, loading]);

  if (loading || !session || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const isCustomer = profile.role === 'customer';
  const isVendor = profile.role === 'vendor';
  const isAdmin = profile.role === 'admin';
  const isRider = profile.role === 'rider';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ff8c00',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
          href: isRider ? null : '/(tabs)/',
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ size, color }) => <CartIconWithBadge size={size} color={color} />,
          href: isCustomer ? '/(tabs)/cart' : null,
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ size, color }) => <Package size={size} color={color} />,
          href: isCustomer ? '/(tabs)/orders' : null,
        }}
      />

      <Tabs.Screen
        name="vendor"
        options={{
          title: 'My Store',
          tabBarIcon: ({ size, color }) => <Package size={size} color={color} />,
          href: isVendor ? '/(tabs)/vendor' : null,
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
          href: isAdmin ? '/(tabs)/admin' : null,
        }}
      />

      <Tabs.Screen
        name="rider"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ size, color }) => <Bike size={size} color={color} />,
          href: isRider ? '/(tabs)/rider' : null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
});

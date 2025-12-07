import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Store, Package, DollarSign, TrendingUp, ShoppingBag } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect, router } from 'expo-router';

interface PlatformStats {
  totalUsers: number;
  totalCustomers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  platformRevenue: number;
  pendingOrders: number;
  activeProducts: number;
}

export default function AdminHome() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalCustomers: 0,
    totalVendors: 0,
    totalProducts: 0,
    totalOrders: 0,
    platformRevenue: 0,
    pendingOrders: 0,
    activeProducts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlatformStats();

    const productsChannel = supabase
      .channel('admin-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        () => {
          fetchPlatformStats();
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('admin-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchPlatformStats();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel('admin-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchPlatformStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPlatformStats();
    }, [])
  );

  const fetchPlatformStats = async () => {
    try {
      setLoading(true);

      const [profilesResult, productsResult, ordersResult] = await Promise.all([
        supabase.from('profiles').select('role'),
        supabase.from('products').select('is_available'),
        supabase.from('orders').select('status, total'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const profiles = profilesResult.data || [];
      const products = productsResult.data || [];
      const orders = ordersResult.data || [];

      const totalCustomers = profiles.filter((p) => p.role === 'customer').length;
      const totalVendors = profiles.filter((p) => p.role === 'vendor').length;
      const activeProducts = products.filter((p) => p.is_available).length;
      const pendingOrders = orders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed'
      ).length;

      const platformRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      setStats({
        totalUsers: profiles.length,
        totalCustomers,
        totalVendors,
        totalProducts: products.length,
        totalOrders: orders.length,
        platformRevenue,
        pendingOrders,
        activeProducts,
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.greeting}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Platform overview and statistics</Text>
      </View>

      <View style={styles.content}>
        <View>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPrimary]}>
              <View style={styles.statIconContainer}>
                <DollarSign size={28} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>₦{stats.platformRevenue.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Platform Revenue</Text>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconBlue]}>
                <Users size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconGreen]}>
                <Store size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{stats.totalVendors}</Text>
              <Text style={styles.statLabel}>Vendors</Text>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconPurple]}>
                <Package size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{stats.activeProducts}</Text>
              <Text style={styles.statLabel}>Active Products</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconOrange]}>
                <ShoppingBag size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>Pending Orders</Text>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.insightsCard}>
            <Text style={styles.sectionTitle}>Platform Insights</Text>

            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <TrendingUp size={20} color="#ff8c00" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Total Orders</Text>
                <Text style={styles.insightValue}>{stats.totalOrders}</Text>
              </View>
            </View>

            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <Users size={20} color="#ff8c00" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Customer Base</Text>
                <Text style={styles.insightValue}>{stats.totalCustomers}</Text>
              </View>
            </View>

            <View style={styles.insightRow}>
              <View style={styles.insightIconContainer}>
                <Package size={20} color="#ff8c00" />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightLabel}>Total Products</Text>
                <Text style={styles.insightValue}>{stats.totalProducts}</Text>
              </View>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push('/(tabs)/admin?screen=users');
              }}
            >
              <Users size={20} color="#ff8c00" />
              <Text style={styles.actionButtonText}>Manage Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push('/(tabs)/admin?screen=vendors');
              }}
            >
              <Store size={20} color="#ff8c00" />
              <Text style={styles.actionButtonText}>Manage Vendors</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push('/(tabs)/admin?screen=products');
              }}
            >
              <Package size={20} color="#ff8c00" />
              <Text style={styles.actionButtonText}>Manage Products</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  content: {
    padding: 16,
  },
  statsGrid: {
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  statCardPrimary: {
    backgroundColor: '#ff8c00',
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  iconGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  iconPurple: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  iconOrange: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  insightsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  quickActions: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 12,
  },
});

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
import { Package, DollarSign, ShoppingBag, TrendingUp, AlertCircle, Clock, XCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import VendorOrderManagement from '@/components/vendor/VendorOrderManagement';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
}

export default function VendorHome() {
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showOrders, setShowOrders] = useState(false);

  const fetchDashboardStats = async (isInitialLoad = false) => {
    if (!profile || !vendorId) return;

    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      console.log('Fetching stats for vendor ID:', vendorId);

      const [productsResult, ordersResult] = await Promise.all([
        supabase.from('products').select('*').eq('vendor_id', vendorId),
        supabase
          .from('orders')
          .select('*, order_items(product_id, quantity, unit_price)')
          .eq('vendor_id', vendorId),
      ]);

      if (productsResult.error) {
        console.error('Products error:', productsResult.error);
        throw productsResult.error;
      }
      if (ordersResult.error) {
        console.error('Orders error:', ordersResult.error);
        throw ordersResult.error;
      }

      const products = productsResult.data || [];
      const orders = ordersResult.data || [];

      console.log('Products found:', products.length);
      console.log('Orders found:', orders.length);

      const activeProducts = products.filter((p) => p.is_available).length;
      const lowStockProducts = products.filter((p) => p.stock_quantity < 10).length;

      const completedOrders = orders.filter((o) => o.status === 'delivered').length;
      const pendingOrders = orders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
      ).length;

      const totalRevenue = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);

      console.log('Stats calculated:', {
        totalProducts: products.length,
        activeProducts,
        pendingOrders,
        completedOrders,
        totalRevenue,
      });

      setStats({
        totalProducts: products.length,
        activeProducts,
        lowStockProducts,
        totalRevenue,
        pendingOrders,
        completedOrders,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const fetchVendorId = async () => {
      if (!profile) return;

      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', profile.id)
          .single();

        if (error) throw error;
        if (data) {
          console.log('Vendor ID found:', data.id);
          setVendorId(data.id);
        }
      } catch (error) {
        console.error('Error fetching vendor ID:', error);
      }
    };

    fetchVendorId();
  }, [profile]);

  useEffect(() => {
    if (!vendorId) return;

    fetchDashboardStats(true);

    const productsChannel = supabase
      .channel('vendor-products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          console.log('Products changed, refreshing stats...');
          fetchDashboardStats(false);
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('vendor-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          console.log('Orders changed, refreshing stats...');
          fetchDashboardStats(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [vendorId]);

  useFocusEffect(
    useCallback(() => {
      if (vendorId) {
        fetchDashboardStats();
      }
    }, [vendorId])
  );

  if (showOrders) {
    return <VendorOrderManagement onBack={() => setShowOrders(false)} />;
  }

  if (profile?.vendor_status === 'pending') {
    return (
      <View style={styles.statusContainer}>
        <View style={styles.statusIconContainer}>
          <Clock size={64} color="#f59e0b" />
        </View>
        <Text style={styles.statusTitle}>Application Under Review</Text>
        <Text style={styles.statusText}>
          Your vendor application is being reviewed by our admin team. You'll receive an email once
          your account is approved.
        </Text>
        <Text style={styles.statusWait}>This usually takes 24-48 hours</Text>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
        >
          <Text style={styles.statusButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (profile?.vendor_status === 'rejected') {
    return (
      <View style={styles.statusContainer}>
        <View style={[styles.statusIconContainer, styles.statusIconRejected]}>
          <XCircle size={64} color="#ef4444" />
        </View>
        <Text style={styles.statusTitle}>Application Rejected</Text>
        <Text style={styles.statusText}>
          Unfortunately, your vendor application was not approved.
        </Text>
        {profile.rejection_reason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionTitle}>Reason:</Text>
            <Text style={styles.rejectionText}>{profile.rejection_reason}</Text>
          </View>
        )}
        <Text style={styles.statusText}>Please contact support for more information.</Text>
        <TouchableOpacity
          style={styles.statusButton}
          onPress={async () => {
            await signOut();
            router.replace('/auth/login');
          }}
        >
          <Text style={styles.statusButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={styles.greeting}>Welcome back, {profile?.full_name}!</Text>
        <Text style={styles.subtitle}>Here's your store overview</Text>
      </View>

      <View style={styles.content}>
        <View>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardPrimary]}>
              <View style={styles.statIconContainer}>
                <DollarSign size={24} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>₦{(stats.totalRevenue || 0).toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconBlue]}>
                <ShoppingBag size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{String(stats.pendingOrders)}</Text>
              <Text style={styles.statLabel}>Pending Orders</Text>
            </View>
          </View>
        </View>

        <View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconGreen]}>
                <Package size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{String(stats.activeProducts)}</Text>
              <Text style={styles.statLabel}>Active Products</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconContainer, styles.iconPurple]}>
                <TrendingUp size={24} color="#ff8c00" />
              </View>
              <Text style={styles.statValue}>{String(stats.completedOrders)}</Text>
              <Text style={styles.statLabel}>Completed Orders</Text>
            </View>
          </View>
        </View>

        {stats.lowStockProducts > 0 && (
          <View>
            <View style={styles.alertCard}>
              <AlertCircle size={24} color="#f59e0b" />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Low Stock Alert</Text>
                <Text style={styles.alertText}>
                  {String(stats.lowStockProducts)} product(s) are running low on stock
                </Text>
              </View>
            </View>
          </View>
        )}

        <View>
          <View style={styles.quickActions}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/vendor')}>
              <Package size={20} color="#ff8c00" />
              <Text style={styles.actionButtonText}>Manage Products</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowOrders(true)}>
              <ShoppingBag size={20} color="#ff8c00" />
              <Text style={styles.actionButtonText}>View Orders</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Store Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Products</Text>
            <Text style={styles.summaryValue}>{String(stats.totalProducts)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Active Listings</Text>
            <Text style={styles.summaryValue}>{String(stats.activeProducts)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Low Stock Items</Text>
            <Text style={[styles.summaryValue, styles.warningText]}>
              {String(stats.lowStockProducts)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#e0f2fe',
    fontWeight: '500',
  },
  content: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardPrimary: {
    backgroundColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#78350f',
  },
  quickActions: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0369a1',
    marginLeft: 12,
  },
  summary: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  warningText: {
    color: '#f59e0b',
  },
  statusContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusIconRejected: {
    backgroundColor: '#fee2e2',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  statusWait: {
    fontSize: 14,
    color: '#f59e0b',
    fontStyle: 'italic',
    marginBottom: 24,
  },
  statusButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    paddingHorizontal: 56,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectionBox: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  rejectionText: {
    fontSize: 14,
    color: '#7f1d1d',
    lineHeight: 20,
  },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Users, ShoppingBag, DollarSign, TrendingUp, Package, FileText, Bike, Navigation, Map, Building2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import VendorManagement from '@/components/admin/VendorManagement';
import OrderManagement from '@/components/admin/OrderManagement';
import UserManagement from '@/components/admin/UserManagement';
import ProductManagement from '@/components/admin/ProductManagement';
import ContentManagement from '@/components/admin/ContentManagement';
import RiderManagement from '@/components/admin/RiderManagement';
import RiderAssignmentManager from '@/components/admin/RiderAssignmentManager';
import RouteManager from '@/components/admin/RouteManager';
import BankAccountManagement from '@/components/admin/BankAccountManagement';
import { useLocalSearchParams } from 'expo-router';

interface Stats {
  totalUsers: number;
  totalVendors: number;
  totalRiders: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
}

export default function AdminScreen() {
  const params = useLocalSearchParams();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalVendors: 0,
    totalRiders: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showVendorManagement, setShowVendorManagement] = useState(false);
  const [showOrderManagement, setShowOrderManagement] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showProductManagement, setShowProductManagement] = useState(false);
  const [showContentManagement, setShowContentManagement] = useState(false);
  const [showRiderManagement, setShowRiderManagement] = useState(false);
  const [showRiderAssignment, setShowRiderAssignment] = useState(false);
  const [showRouteManager, setShowRouteManager] = useState(false);
  const [showBankAccountManagement, setShowBankAccountManagement] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (params.screen === 'users') {
      setShowUserManagement(true);
      setShowVendorManagement(false);
      setShowRiderManagement(false);
      setShowOrderManagement(false);
      setShowProductManagement(false);
    } else if (params.screen === 'vendors') {
      setShowVendorManagement(true);
      setShowUserManagement(false);
      setShowRiderManagement(false);
      setShowOrderManagement(false);
      setShowProductManagement(false);
    } else if (params.screen === 'riders') {
      setShowRiderManagement(true);
      setShowUserManagement(false);
      setShowVendorManagement(false);
      setShowOrderManagement(false);
      setShowProductManagement(false);
    } else if (params.screen === 'products') {
      setShowProductManagement(true);
      setShowUserManagement(false);
      setShowVendorManagement(false);
      setShowRiderManagement(false);
      setShowOrderManagement(false);
    }
  }, [params.screen]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const [
        { count: usersCount },
        { count: vendorsCount },
        { count: ridersCount },
        { count: productsCount },
        { count: ordersCount },
        { data: ordersData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('riders').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total'),
      ]);

      const totalRevenue = (ordersData || []).reduce(
        (sum: number, order: any) => sum + Number(order.total),
        0
      );

      setStats({
        totalUsers: usersCount || 0,
        totalVendors: vendorsCount || 0,
        totalRiders: ridersCount || 0,
        totalProducts: productsCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    icon: Icon,
    title,
    value,
    color,
    index,
  }: {
    icon: any;
    title: string;
    value: string;
    color: string;
    index: number;
  }) => (
    <View style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={24} color={color} />
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  if (showUserManagement) {
    return <UserManagement onBack={() => setShowUserManagement(false)} />;
  }

  if (showVendorManagement) {
    return <VendorManagement onBack={() => setShowVendorManagement(false)} />;
  }

  if (showRiderManagement) {
    return <RiderManagement onBack={() => setShowRiderManagement(false)} />;
  }

  if (showProductManagement) {
    return <ProductManagement onBack={() => setShowProductManagement(false)} />;
  }

  if (showOrderManagement) {
    return <OrderManagement onBack={() => setShowOrderManagement(false)} />;
  }

  if (showContentManagement) {
    return <ContentManagement onBack={() => setShowContentManagement(false)} />;
  }

  if (showRiderAssignment) {
    return <RiderAssignmentManager onBack={() => setShowRiderAssignment(false)} />;
  }

  if (showRouteManager) {
    return <RouteManager onBack={() => setShowRouteManager(false)} />;
  }

  if (showBankAccountManagement) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowBankAccountManagement(false)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <BankAccountManagement />
        </View>
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Platform Overview</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard
            icon={Users}
            title="Total Users"
            value={stats.totalUsers.toString()}
            color="#ff8c00"
            index={0}
          />
          <StatCard
            icon={ShoppingBag}
            title="Vendors"
            value={stats.totalVendors.toString()}
            color="#ff8c00"
            index={1}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={Bike}
            title="Riders"
            value={stats.totalRiders.toString()}
            color="#ff8c00"
            index={2}
          />
          <StatCard
            icon={Package}
            title="Products"
            value={stats.totalProducts.toString()}
            color="#ff8c00"
            index={3}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={TrendingUp}
            title="Orders"
            value={stats.totalOrders.toString()}
            color="#f59e0b"
            index={4}
          />
          <View style={{ flex: 1 }} />
        </View>

        <View style={styles.revenueCard}>
          <View style={[styles.iconContainer, { backgroundColor: '#ff8c0020' }]}>
            <DollarSign size={32} color="#ff8c00" />
          </View>
          <View style={styles.revenueInfo}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={styles.revenueValue}>₦{stats.totalRevenue.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowUserManagement(true)}
          >
            <Users size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowVendorManagement(true)}
          >
            <ShoppingBag size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Vendors</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowRiderManagement(true)}
          >
            <Bike size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Riders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowProductManagement(true)}
          >
            <Package size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowOrderManagement(true)}
          >
            <TrendingUp size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowRiderAssignment(true)}
          >
            <Navigation size={20} color="#6b7280" />
            <Text style={styles.menuText}>Assign Deliveries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowRouteManager(true)}
          >
            <Map size={20} color="#6b7280" />
            <Text style={styles.menuText}>View Routes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowContentManagement(true)}
          >
            <FileText size={20} color="#6b7280" />
            <Text style={styles.menuText}>Manage Content</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowBankAccountManagement(true)}
          >
            <Building2 size={20} color="#6b7280" />
            <Text style={styles.menuText}>Bank Accounts</Text>
          </TouchableOpacity>
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
  },
  header: {
    backgroundColor: '#ff8c00',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#d1fae5',
    marginTop: 4,
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
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  revenueCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  revenueInfo: {
    flex: 1,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff8c00',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});

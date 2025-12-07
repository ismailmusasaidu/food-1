import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Package,
  DollarSign,
  Star,
  TrendingUp,
  Bell,
  AlertCircle,
  X,
  CheckCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import StatusToggle from '@/components/rider/StatusToggle';
import OrderAssignmentCard from '@/components/rider/OrderAssignmentCard';
import NotificationsList, { RiderNotification } from '@/components/rider/NotificationsList';
import BatchDeliveryCard from '@/components/rider/BatchDeliveryCard';

interface Rider {
  id: string;
  user_id: string;
  full_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating: number;
  total_deliveries: number;
  total_completed_deliveries: number;
  current_status: 'available' | 'busy' | 'offline';
}

export default function RiderDashboardScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riderProfile, setRiderProfile] = useState<Rider | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [batchDeliveries, setBatchDeliveries] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<RiderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchRiderData();
    }
  }, [profile]);

  // Setup realtime subscriptions once rider profile is loaded
  useEffect(() => {
    if (riderProfile) {
      console.log('Rider profile loaded, setting up subscriptions');
      const cleanup = setupRealtimeSubscriptions();
      return cleanup;
    }
  }, [riderProfile]);

  const setupRealtimeSubscriptions = () => {
    if (!riderProfile) {
      console.log('Cannot setup subscriptions: No rider profile');
      return;
    }

    console.log('Setting up realtime subscriptions for rider:', riderProfile.id);

    const assignmentsChannel = supabase
      .channel('rider_assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_assignments',
          filter: `rider_id=eq.${riderProfile.id}`,
        },
        (payload) => {
          console.log('Realtime assignment change detected:', payload);
          fetchPendingAssignments();
        }
      )
      .subscribe((status) => {
        console.log('Assignments subscription status:', status);
      });

    const notificationsChannel = supabase
      .channel('rider_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile?.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  };

  const fetchRiderData = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      const { data: rider, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (riderError) throw riderError;

      if (!rider) {
        router.replace('/auth/rider-register');
        return;
      }

      if (rider.status === 'pending') {
        router.replace('/auth/rider-pending');
        return;
      }

      setRiderProfile(rider);

      await Promise.all([
        fetchPendingAssignments(rider),
        fetchActiveOrders(rider),
        fetchBatchDeliveries(rider),
        fetchNotifications(),
        fetchEarnings(rider.id),
      ]);
    } catch (error: any) {
      console.error('Error fetching rider data:', error);
      setErrorMessage(error.message || 'Failed to load rider data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPendingAssignments = async (rider?: Rider) => {
    const riderData = rider || riderProfile;
    if (!riderData) {
      console.log('No rider data available for fetching assignments');
      return;
    }

    try {
      console.log('=== FETCHING PENDING ASSIGNMENTS ===');
      console.log('Rider ID:', riderData.id);
      console.log('Rider user_id:', riderData.user_id);
      const now = new Date().toISOString();
      console.log('Current time:', now);

      const { data, error } = await supabase
        .from('order_assignments')
        .select(`
          *,
          orders!inner (
            id,
            order_number,
            total,
            delivery_address,
            vendor_id,
            vendors!inner (
              id,
              business_name,
              address
            )
          )
        `)
        .eq('rider_id', riderData.id)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Assignment fetch error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }

      console.log('RAW RESPONSE FROM SUPABASE:');
      console.log('Number of results:', data?.length || 0);
      console.log('Full data:', JSON.stringify(data, null, 2));

      const assignmentsWithVendors = (data || []).map((assignment: any) => {
        const mapped = {
          ...assignment,
          order: {
            order_number: assignment.orders?.order_number || 'N/A',
            total: parseFloat(assignment.orders?.total || 0),
            delivery_address: assignment.orders?.delivery_address || 'N/A',
          },
          vendor: {
            name: assignment.orders?.vendors?.business_name || 'Unknown Vendor',
            address: assignment.orders?.vendors?.address || 'N/A',
          },
        };
        console.log('Mapped assignment:', JSON.stringify(mapped, null, 2));
        return mapped;
      });

      console.log('Total mapped assignments:', assignmentsWithVendors.length);
      setPendingAssignments(assignmentsWithVendors);
    } catch (error: any) {
      console.error('Error fetching assignments:', error);
      setErrorMessage('Failed to load assignments');
    }
  };

  const fetchActiveOrders = async (rider?: Rider) => {
    const riderData = rider || riderProfile;
    if (!riderData) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_rider_id', riderData.id)
        .in('status', ['confirmed', 'preparing', 'rider_assigned', 'rider_approaching', 'out_for_delivery'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActiveOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching active orders:', error);
    }
  };

  const fetchBatchDeliveries = async (rider?: Rider) => {
    const riderData = rider || riderProfile;
    if (!riderData) return;

    try {
      const { data, error } = await supabase
        .from('batch_deliveries')
        .select(`
          *,
          batch_delivery_orders (
            id,
            order_id,
            delivery_sequence,
            delivered_at,
            orders!inner (
              order_number,
              delivery_address,
              total
            )
          )
        `)
        .eq('rider_id', riderData.id)
        .in('status', ['pending', 'in_progress'])
        .order('pickup_window_start', { ascending: true });

      if (error) throw error;

      const batchesWithOrders = (data || []).map((batch: any) => ({
        ...batch,
        orders: batch.batch_delivery_orders.map((item: any) => ({
          ...item,
          order: item.orders,
        })),
      }));

      setBatchDeliveries(batchesWithOrders);
    } catch (error: any) {
      console.error('Error fetching batch deliveries:', error);
    }
  };

  const fetchNotifications = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.read).length);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchEarnings = async (riderId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];

      const { data: todayData } = await supabase
        .from('rider_earnings')
        .select('amount')
        .eq('rider_id', riderId)
        .gte('date', today);

      const { data: weekData } = await supabase
        .from('rider_earnings')
        .select('amount')
        .eq('rider_id', riderId)
        .gte('date', weekAgoStr);

      const todayTotal = (todayData || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const weekTotal = (weekData || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

      setTodayEarnings(todayTotal);
      setWeeklyEarnings(weekTotal);
    } catch (error: any) {
      console.error('Error fetching earnings:', error);
    }
  };

  const handleStatusChange = async (newStatus: 'available' | 'busy' | 'offline') => {
    if (!riderProfile) return;

    try {
      const { error: riderError } = await supabase
        .from('riders')
        .update({ current_status: newStatus })
        .eq('id', riderProfile.id);

      if (riderError) throw riderError;

      const { error: statusError } = await supabase.from('rider_live_status').upsert(
        {
          rider_id: riderProfile.id,
          status: newStatus,
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'rider_id' }
      );

      if (statusError) throw statusError;

      setRiderProfile({ ...riderProfile, current_status: newStatus });
      setSuccessMessage(`Status changed to ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      setErrorMessage(error.message || 'Failed to update status');
      throw error;
    }
  };

  const handleAcceptOrder = async (assignmentId: string) => {
    if (!riderProfile) {
      setErrorMessage('Rider profile not loaded');
      return;
    }

    try {
      console.log('Accepting assignment:', assignmentId);

      const assignment = pendingAssignments.find((a) => a.id === assignmentId);
      if (!assignment) {
        console.error('Assignment not found in pending list');
        setErrorMessage('Assignment not found');
        return;
      }

      console.log('Updating assignment status to accepted');
      const { error: assignmentError } = await supabase
        .from('order_assignments')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (assignmentError) {
        console.error('Assignment update error:', assignmentError);
        throw assignmentError;
      }

      console.log('Updating order with rider assignment');
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          assigned_rider_id: riderProfile.id,
        })
        .eq('id', assignment.order_id);

      if (orderError) {
        console.error('Order update error:', orderError);
        throw orderError;
      }

      console.log('Order accepted successfully');
      setSuccessMessage('Order accepted successfully');
      await fetchRiderData();
    } catch (error: any) {
      console.error('Error accepting order:', error);
      setErrorMessage(error.message || 'Failed to accept order');
    }
  };

  const handleRejectOrder = async (assignmentId: string) => {
    try {
      console.log('Rejecting assignment:', assignmentId);

      const { error } = await supabase
        .from('order_assignments')
        .update({ status: 'rejected' })
        .eq('id', assignmentId);

      if (error) {
        console.error('Rejection error:', error);
        throw error;
      }

      console.log('Assignment rejected successfully');
      setSuccessMessage('Order declined');
      await fetchPendingAssignments();
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      setErrorMessage(error.message || 'Failed to decline order');
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRiderData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!riderProfile) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome back!</Text>
          <Text style={styles.headerName}>{riderProfile.full_name}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => setShowNotifications(true)}
        >
          <Bell size={24} color="#ffffff" />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#ff8c00']} />
        }
      >
        <View style={styles.section}>
          <StatusToggle
            currentStatus={riderProfile.current_status}
            onStatusChange={handleStatusChange}
          />
        </View>

        {pendingAssignments.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertCircle size={20} color="#ff8c00" />
              <Text style={styles.sectionTitle}>New Order Assignments ({pendingAssignments.length})</Text>
            </View>
            {pendingAssignments.map((assignment) => {
              console.log('Rendering assignment card for:', assignment.id);
              console.log('Assignment data:', JSON.stringify(assignment, null, 2));
              return (
                <OrderAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onAccept={handleAcceptOrder}
                  onReject={handleRejectOrder}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.emptyMessage}>No pending assignments</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fff7ed' }]}>
              <DollarSign size={24} color="#ff8c00" />
            </View>
            <Text style={styles.statValue}>₦{todayEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#f0fdf4' }]}>
              <TrendingUp size={24} color="#10b981" />
            </View>
            <Text style={styles.statValue}>₦{weeklyEarnings.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Weekly Earnings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
              <Star size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>{riderProfile.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#e0e7ff' }]}>
              <Package size={24} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{riderProfile.total_completed_deliveries}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {batchDeliveries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scheduled Batch Deliveries</Text>
            {batchDeliveries.map((batch) => (
              <BatchDeliveryCard key={batch.id} batch={batch} />
            ))}
          </View>
        )}

        {activeOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Deliveries</Text>
            {activeOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/rider/delivery/${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>#{order.order_number}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderAddress} numberOfLines={2}>
                  {order.delivery_address}
                </Text>
                <Text style={styles.orderTotal}>₦{order.total.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowNotifications(false)}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <NotificationsList
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
          />
        </View>
      </Modal>

      <Modal
        visible={!!errorMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorMessage(null)}
      >
        <View style={styles.messageOverlay}>
          <View style={styles.messageContent}>
            <AlertCircle size={48} color="#ef4444" />
            <Text style={styles.messageTitle}>Error</Text>
            <Text style={styles.messageText}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.messageButton, { backgroundColor: '#ef4444' }]}
              onPress={() => setErrorMessage(null)}
            >
              <Text style={styles.messageButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!successMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessMessage(null)}
      >
        <View style={styles.messageOverlay}>
          <View style={styles.messageContent}>
            <CheckCircle size={48} color="#10b981" />
            <Text style={styles.messageTitle}>Success</Text>
            <Text style={styles.messageText}>{successMessage}</Text>
            <TouchableOpacity
              style={[styles.messageButton, { backgroundColor: '#10b981' }]}
              onPress={() => setSuccessMessage(null)}
            >
              <Text style={styles.messageButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    color: '#fff7ed',
    fontWeight: '600',
  },
  headerName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  statusBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'capitalize',
  },
  orderAddress: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ff8c00',
  },
  bottomSpacer: {
    height: 32,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  messageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  messageButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

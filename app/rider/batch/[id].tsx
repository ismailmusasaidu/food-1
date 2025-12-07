import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  CheckCircle,
  Clock,
  Package,
  AlertCircle,
  PlayCircle,
  X,
  Truck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface BatchDeliveryOrder {
  id: string;
  order_id: string;
  delivery_sequence: number;
  delivered_at: string | null;
  order: {
    id: string;
    order_number: string;
    delivery_address: string;
    total: number;
    customer_id: string;
    status: string;
  };
  customer: {
    full_name: string;
    phone: string;
  };
}

interface BatchDelivery {
  id: string;
  meal_time: 'breakfast' | 'lunch' | 'dinner';
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export default function BatchDeliveryDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [batch, setBatch] = useState<BatchDelivery | null>(null);
  const [orders, setOrders] = useState<BatchDeliveryOrder[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBatchDetails();
      subscribeToUpdates();
    }
  }, [id]);

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`batch-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_delivery_orders',
          filter: `batch_id=eq.${id}`,
        },
        () => {
          fetchBatchDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const { data: batchData, error: batchError } = await supabase
        .from('batch_deliveries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (batchError) throw batchError;
      if (!batchData) {
        setErrorMessage('Batch not found');
        return;
      }

      setBatch(batchData);

      const { data: ordersData, error: ordersError } = await supabase
        .from('batch_delivery_orders')
        .select(`
          *,
          orders!inner (
            id,
            order_number,
            delivery_address,
            total,
            customer_id,
            status
          )
        `)
        .eq('batch_id', id)
        .order('delivery_sequence', { ascending: true });

      if (ordersError) throw ordersError;

      const ordersWithCustomers = await Promise.all(
        (ordersData || []).map(async (orderItem: any) => {
          const { data: customer } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', orderItem.orders.customer_id)
            .maybeSingle();

          return {
            ...orderItem,
            order: orderItem.orders,
            customer: customer || { full_name: 'Unknown', phone: 'N/A' },
          };
        })
      );

      setOrders(ordersWithCustomers);
    } catch (error: any) {
      console.error('Error fetching batch details:', error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartBatch = async () => {
    if (!batch) return;

    try {
      setUpdating(true);

      const { error: batchError } = await supabase
        .from('batch_deliveries')
        .update({ status: 'in_progress' })
        .eq('id', batch.id);

      if (batchError) throw batchError;

      const orderIds = orders.map(o => o.order_id);
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ status: 'picked_up' })
        .in('id', orderIds);

      if (ordersError) throw ordersError;

      setSuccessMessage('Batch started! All orders marked as picked up');
      openBatchRoute();
      await fetchBatchDetails();
    } catch (error: any) {
      console.error('Error starting batch:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkInTransit = async (orderId: string) => {
    try {
      setUpdating(true);

      const { error } = await supabase
        .from('orders')
        .update({ status: 'in_transit' })
        .eq('id', orderId);

      if (error) throw error;

      setSuccessMessage('Order marked as in transit');
      await fetchBatchDetails();
    } catch (error: any) {
      console.error('Error marking in transit:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDelivered = async (batchOrderId: string, orderId: string) => {
    try {
      setUpdating(true);

      const { error: batchOrderError } = await supabase
        .from('batch_delivery_orders')
        .update({ delivered_at: new Date().toISOString() })
        .eq('id', batchOrderId);

      if (batchOrderError) throw batchOrderError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          customer_confirmation_method: 'in_app',
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      setSuccessMessage('Stop marked as delivered!');
      await fetchBatchDetails();

      const allDelivered = orders.every(
        (o) => o.id === batchOrderId || o.delivered_at
      );

      if (allDelivered && batch) {
        await supabase
          .from('batch_deliveries')
          .update({ status: 'completed' })
          .eq('id', batch.id);

        setSuccessMessage('Batch completed! Great job!');
        setTimeout(() => {
          router.back();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error marking delivered:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const openBatchRoute = () => {
    if (orders.length === 0) return;

    const addresses = orders.map((o) => o.order.delivery_address);
    const destinationQuery = addresses.join('|');

    const url = Platform.select({
      ios: `maps:?daddr=${encodeURIComponent(destinationQuery)}`,
      android: `geo:0,0?q=${encodeURIComponent(destinationQuery)}`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        addresses[0]
      )}`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const openSingleAddress = (address: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getMealTimeLabel = (mealTime: string) => {
    switch (mealTime) {
      case 'breakfast':
        return 'Breakfast';
      case 'lunch':
        return 'Lunch';
      case 'dinner':
        return 'Dinner';
      default:
        return mealTime;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!batch) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>Batch not found</Text>
      </View>
    );
  }

  const deliveredCount = orders.filter((o) => o.delivered_at).length;
  const isCompleted = batch.status === 'completed';
  const isPending = batch.status === 'pending';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Batch Delivery</Text>
          <Text style={styles.headerSubtitle}>{getMealTimeLabel(batch.meal_time)}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.timeCard}>
          <View style={styles.timeRow}>
            <Clock size={20} color="#ff8c00" />
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Pickup Window</Text>
              <Text style={styles.timeValue}>
                {formatTime(batch.pickup_window_start)} - {formatTime(batch.pickup_window_end)}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.timeRow}>
            <AlertCircle size={20} color="#ef4444" />
            <View style={styles.timeContent}>
              <Text style={styles.timeLabel}>Delivery Deadline</Text>
              <Text style={styles.timeValue}>{formatTime(batch.delivery_deadline)}</Text>
            </View>
          </View>
        </View>

        {!isCompleted && batch.status === 'in_progress' && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>Progress</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(deliveredCount / orders.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {deliveredCount} of {orders.length} stops delivered
            </Text>
          </View>
        )}

        <View style={styles.stopsSection}>
          <Text style={styles.sectionTitle}>
            Delivery Stops ({orders.length})
          </Text>

          {orders.map((orderItem, index) => (
            <View
              key={orderItem.id}
              style={[
                styles.stopCard,
                orderItem.delivered_at && styles.stopCardCompleted,
              ]}
            >
              <View style={styles.stopHeader}>
                <View style={styles.stopNumberContainer}>
                  {orderItem.delivered_at ? (
                    <CheckCircle size={24} color="#10b981" />
                  ) : (
                    <View style={styles.stopNumber}>
                      <Text style={styles.stopNumberText}>{index + 1}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.stopHeaderContent}>
                  <Text style={styles.stopOrderNumber}>#{orderItem.order.order_number}</Text>
                  <Text style={styles.stopCustomerName}>{orderItem.customer.full_name}</Text>
                </View>
                {orderItem.delivered_at ? (
                  <View style={styles.deliveredBadge}>
                    <Text style={styles.deliveredText}>Delivered</Text>
                  </View>
                ) : batch.status === 'in_progress' && (
                  <View style={[
                    styles.statusBadge,
                    orderItem.order.status === 'in_transit'
                      ? styles.transitStatusBadge
                      : styles.pickedUpStatusBadge
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      orderItem.order.status === 'in_transit'
                        ? styles.transitStatusText
                        : styles.pickedUpStatusText
                    ]}>
                      {orderItem.order.status === 'in_transit' ? 'In Transit' : 'Picked Up'}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.addressRow}
                onPress={() => openSingleAddress(orderItem.order.delivery_address)}
              >
                <MapPin size={16} color="#64748b" />
                <Text style={styles.addressText} numberOfLines={2}>
                  {orderItem.order.delivery_address}
                </Text>
                <Navigation size={16} color="#ff8c00" />
              </TouchableOpacity>

              <View style={styles.stopFooter}>
                <Text style={styles.stopTotal}>₦{orderItem.order.total.toFixed(2)}</Text>
                {!orderItem.delivered_at && batch.status === 'in_progress' && (
                  <View style={styles.stopActions}>
                    {orderItem.order.status === 'picked_up' && (
                      <TouchableOpacity
                        style={styles.transitButton}
                        onPress={() => handleMarkInTransit(orderItem.order.id)}
                        disabled={updating}
                      >
                        {updating ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Truck size={16} color="#ffffff" />
                            <Text style={styles.transitButtonText}>In Transit</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {(orderItem.order.status === 'in_transit' || orderItem.order.status === 'picked_up') && (
                      <TouchableOpacity
                        style={styles.deliverButton}
                        onPress={() => handleMarkDelivered(orderItem.id, orderItem.order.id)}
                        disabled={updating}
                      >
                        {updating ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <CheckCircle size={16} color="#ffffff" />
                            <Text style={styles.deliverButtonText}>Delivered</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {isPending && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartBatch}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <PlayCircle size={24} color="#ffffff" />
                  <Text style={styles.startButtonText}>Start Batch Delivery</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.startHint}>
              This will open navigation to help you deliver all stops in order
            </Text>
          </View>
        )}

        {isCompleted && (
          <View style={styles.completedCard}>
            <CheckCircle size={48} color="#10b981" />
            <Text style={styles.completedTitle}>Batch Completed!</Text>
            <Text style={styles.completedText}>All deliveries have been completed</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff7ed',
    marginTop: 4,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  timeCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeContent: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  progressCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  stopsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16,
  },
  stopCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  stopCardCompleted: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stopNumberContainer: {
    marginRight: 12,
  },
  stopNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopNumberText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  stopHeaderContent: {
    flex: 1,
  },
  stopOrderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  stopCustomerName: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  deliveredBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deliveredText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pickedUpStatusBadge: {
    backgroundColor: '#fff7ed',
  },
  transitStatusBadge: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pickedUpStatusText: {
    color: '#ff8c00',
  },
  transitStatusText: {
    color: '#3b82f6',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  stopFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  stopTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff8c00',
  },
  stopActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  transitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  transitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deliverButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ff8c00',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  startHint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  completedCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10b981',
    marginTop: 16,
  },
  completedText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
  bottomSpacer: {
    height: 32,
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

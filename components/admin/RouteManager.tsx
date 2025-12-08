import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  MapPin,
  Clock,
  Package,
  ArrowLeft,
  Navigation,
  CheckCircle,
  Calendar,
  Bike,
  Trash2,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface BatchDelivery {
  id: string;
  meal_time: string;
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_deadline: string;
  status: string;
  rider: {
    full_name: string;
    phone: string;
  };
  batch_delivery_orders: Array<{
    id: string;
    delivery_sequence: number;
    delivered_at: string | null;
    orders: {
      order_number: string;
      delivery_address: string;
      total: number;
      vendor: {
        business_name: string;
        address: string;
      };
    };
  }>;
}

interface RouteManagerProps {
  onBack: () => void;
}

export default function RouteManager({ onBack }: RouteManagerProps) {
  const [batches, setBatches] = useState<BatchDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchDelivery | null>(null);

  useEffect(() => {
    fetchBatches();

    const channel = supabase
      .channel('route-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_deliveries',
        },
        () => {
          fetchBatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('batch_deliveries')
        .select(`
          id,
          meal_time,
          pickup_window_start,
          pickup_window_end,
          delivery_deadline,
          status,
          rider:riders!inner(full_name, phone),
          batch_delivery_orders(
            id,
            delivery_sequence,
            delivered_at,
            orders!inner(
              order_number,
              delivery_address,
              total,
              vendor:vendors!inner(business_name, address)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeRoute = async (batchId: string) => {
    Alert.alert(
      'Optimize Route',
      'This would use a route optimization algorithm to reorder stops for the most efficient delivery path.',
      [{ text: 'OK' }]
    );
  };

  const deleteRoute = async (batchId: string) => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this batch delivery route? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('batch_deliveries')
                .delete()
                .eq('id', batchId);

              if (error) throw error;

              Alert.alert('Success', 'Route deleted successfully');
              setSelectedBatch(null);
              fetchBatches();
            } catch (error) {
              console.error('Error deleting route:', error);
              Alert.alert('Error', 'Failed to delete route');
            }
          },
        },
      ]
    );
  };

  const getMealTimeColor = (mealTime: string) => {
    switch (mealTime) {
      case 'breakfast':
        return '#f59e0b';
      case 'lunch':
        return '#10b981';
      case 'dinner':
        return '#8b5cf6';
      default:
        return '#64748b';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'in_progress':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#64748b';
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

  if (selectedBatch) {
    const deliveredCount = selectedBatch.batch_delivery_orders.filter(
      (o) => o.delivered_at
    ).length;
    const totalStops = selectedBatch.batch_delivery_orders.length;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setSelectedBatch(null)}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Route Details</Text>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.batchHeader}>
            <View style={styles.batchInfo}>
              <View
                style={[
                  styles.mealTimeBadge,
                  { backgroundColor: getMealTimeColor(selectedBatch.meal_time) },
                ]}
              >
                <Text style={styles.mealTimeText}>
                  {selectedBatch.meal_time.toUpperCase()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(selectedBatch.status) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(selectedBatch.status) },
                  ]}
                >
                  {selectedBatch.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.riderCard}>
              <Bike size={20} color="#ff8c00" />
              <View>
                <Text style={styles.riderName}>{selectedBatch.rider.full_name}</Text>
                <Text style={styles.riderPhone}>{selectedBatch.rider.phone}</Text>
              </View>
            </View>

            <View style={styles.timeInfo}>
              <View style={styles.timeRow}>
                <Clock size={16} color="#64748b" />
                <Text style={styles.timeLabel}>Pickup:</Text>
                <Text style={styles.timeValue}>
                  {formatTime(selectedBatch.pickup_window_start)} -{' '}
                  {formatTime(selectedBatch.pickup_window_end)}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <MapPin size={16} color="#64748b" />
                <Text style={styles.timeLabel}>Deadline:</Text>
                <Text style={styles.timeValue}>
                  {formatTime(selectedBatch.delivery_deadline)}
                </Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <Text style={styles.progressText}>
                {deliveredCount} of {totalStops} stops completed
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(deliveredCount / totalStops) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Delivery Stops</Text>
          {selectedBatch.batch_delivery_orders
            .sort((a, b) => a.delivery_sequence - b.delivery_sequence)
            .map((stop, index) => (
              <View key={stop.id} style={styles.stopCard}>
                <View style={styles.stopHeader}>
                  <View style={styles.stopNumber}>
                    <Text style={styles.stopNumberText}>{index + 1}</Text>
                  </View>
                  {stop.delivered_at && (
                    <View style={styles.deliveredBadge}>
                      <CheckCircle size={16} color="#10b981" />
                      <Text style={styles.deliveredText}>Delivered</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.orderNumber}>{stop.orders.order_number}</Text>

                <View style={styles.addressRow}>
                  <MapPin size={14} color="#6b7280" />
                  <Text style={styles.vendorAddress}>
                    From: {stop.orders.vendor.business_name}
                  </Text>
                </View>

                <View style={styles.addressRow}>
                  <MapPin size={14} color="#ff8c00" />
                  <Text style={styles.customerAddress}>
                    To: {stop.orders.delivery_address}
                  </Text>
                </View>

                <Text style={styles.orderTotal}>
                  ₦{Number(stop.orders.total).toFixed(2)}
                </Text>
              </View>
            ))}

          <View style={styles.actionButtons}>
            {selectedBatch.status === 'pending' && (
              <TouchableOpacity
                style={styles.optimizeButton}
                onPress={() => optimizeRoute(selectedBatch.id)}
              >
                <Navigation size={20} color="#fff" />
                <Text style={styles.optimizeButtonText}>Optimize Route</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteRoute(selectedBatch.id)}
            >
              <Trash2 size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Route</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Route Management</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff8c00" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Package size={24} color="#ff8c00" />
              <Text style={styles.statValue}>{batches.length}</Text>
              <Text style={styles.statLabel}>Active Batches</Text>
            </View>
            <View style={styles.statBox}>
              <Navigation size={24} color="#ff8c00" />
              <Text style={styles.statValue}>
                {batches.reduce(
                  (sum, b) => sum + b.batch_delivery_orders.length,
                  0
                )}
              </Text>
              <Text style={styles.statLabel}>Total Stops</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Batch Deliveries</Text>
          {batches.map((batch) => {
            const deliveredCount = batch.batch_delivery_orders.filter(
              (o) => o.delivered_at
            ).length;
            const totalStops = batch.batch_delivery_orders.length;

            return (
              <TouchableOpacity
                key={batch.id}
                style={styles.batchCard}
                onPress={() => setSelectedBatch(batch)}
              >
                <View style={styles.batchCardHeader}>
                  <View
                    style={[
                      styles.mealTimeBadge,
                      { backgroundColor: getMealTimeColor(batch.meal_time) },
                    ]}
                  >
                    <Text style={styles.mealTimeText}>
                      {batch.meal_time.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(batch.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(batch.status) },
                      ]}
                    >
                      {batch.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.riderNameCard}>{batch.rider.full_name}</Text>

                <View style={styles.batchStats}>
                  <View style={styles.batchStat}>
                    <Package size={16} color="#64748b" />
                    <Text style={styles.batchStatText}>
                      {totalStops} stops
                    </Text>
                  </View>
                  {batch.status === 'in_progress' && (
                    <View style={styles.batchStat}>
                      <CheckCircle size={16} color="#10b981" />
                      <Text style={styles.batchStatText}>
                        {deliveredCount}/{totalStops}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.timeRow}>
                  <Clock size={14} color="#64748b" />
                  <Text style={styles.batchTimeText}>
                    {formatTime(batch.pickup_window_start)} -{' '}
                    {formatTime(batch.delivery_deadline)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {batches.length === 0 && (
            <View style={styles.emptyState}>
              <Package size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No batch deliveries found</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ff8c00',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  batchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  batchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTimeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mealTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  riderNameCard: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  batchStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  batchStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchStatText: {
    fontSize: 14,
    color: '#6b7280',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchTimeText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
  batchHeader: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  batchInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  riderPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  timeInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  timeValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '700',
  },
  progressCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontWeight: 'bold',
    color: '#fff',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deliveredText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  vendorAddress: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  customerAddress: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff8c00',
    marginTop: 8,
  },
  actionButtons: {
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  optimizeButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  optimizeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import {
  Bike,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  XCircle,
  Search,
  Package,
  Calendar,
  ArrowLeft,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface Rider {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  current_status: 'available' | 'busy' | 'offline';
  rating: number;
  total_completed_deliveries: number;
}

interface Order {
  id: string;
  order_number: string;
  delivery_address: string;
  total: number;
  status: string;
  delivery_type: string;
  meal_time_preference: string | null;
  vendor: {
    business_name: string;
    address: string;
  };
}

interface RiderAssignmentManagerProps {
  onBack: () => void;
}

export default function RiderAssignmentManager({ onBack }: RiderAssignmentManagerProps) {
  const [view, setView] = useState<'main' | 'on-demand' | 'batch'>('main');
  const [riders, setRiders] = useState<Rider[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mealTime, setMealTime] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');

  useEffect(() => {
    fetchRiders();
    fetchUnassignedOrders();
  }, []);

  const fetchRiders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('riders')
        .select('id, user_id, full_name, phone, current_status, rating, total_completed_deliveries')
        .eq('status', 'approved')
        .order('current_status', { ascending: false });

      if (error) throw error;
      console.log('Fetched riders:', data);
      setRiders(data || []);
    } catch (error) {
      console.error('Error fetching riders:', error);
      Alert.alert('Error', 'Failed to load riders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          delivery_address,
          total,
          status,
          delivery_type,
          meal_time_preference,
          vendor:vendors!inner(business_name, address)
        `)
        .eq('delivery_type', 'delivery')
        .is('assigned_rider_id', null)
        .in('status', ['pending', 'confirmed'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const assignRiderToOrder = async () => {
    if (!selectedOrder || !selectedRider) {
      Alert.alert('Error', 'Please select both an order and a rider');
      return;
    }

    try {
      setAssigning(true);
      console.log('Assigning order:', selectedOrder.id, 'to rider:', selectedRider.id);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('order_assignments')
        .insert({
          order_id: selectedOrder.id,
          rider_id: selectedRider.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (assignmentError) {
        console.error('Assignment error:', assignmentError);
        throw assignmentError;
      }

      console.log('Assignment created:', assignmentData);

      // Notification is automatically created by database trigger
      // But we can add a manual notification as backup if needed

      Alert.alert(
        'Success',
        `Order ${selectedOrder.order_number} assigned to ${selectedRider.full_name}. The rider has 10 minutes to accept this assignment.`
      );

      setSelectedOrder(null);
      setSelectedRider(null);
      await fetchUnassignedOrders();
    } catch (error: any) {
      console.error('Error assigning rider:', error);
      Alert.alert('Error', error.message || 'Failed to assign rider. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const createBatchDelivery = async () => {
    if (!selectedRider || selectedOrders.length === 0) {
      Alert.alert('Error', 'Please select a rider and at least one order');
      return;
    }

    try {
      setAssigning(true);
      console.log('Creating batch delivery for rider:', selectedRider.id, 'with orders:', selectedOrders);

      const now = new Date();
      const pickupStart = new Date(now.getTime() + 30 * 60000);
      const pickupEnd = new Date(now.getTime() + 60 * 60000);
      const deliveryDeadline = new Date(now.getTime() + 120 * 60000);
      const expiresAt = new Date(now.getTime() + 10 * 60000);

      const { data: batch, error: batchError } = await supabase
        .from('batch_deliveries')
        .insert({
          rider_id: selectedRider.id,
          meal_time: mealTime,
          pickup_window_start: pickupStart.toISOString(),
          pickup_window_end: pickupEnd.toISOString(),
          delivery_deadline: deliveryDeadline.toISOString(),
          status: 'assigned',
          assigned_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (batchError) {
        console.error('Batch creation error:', batchError);
        throw batchError;
      }

      console.log('Batch created:', batch);

      const batchOrders = selectedOrders.map((orderId, index) => ({
        batch_id: batch.id,
        order_id: orderId,
        delivery_sequence: index + 1,
      }));

      const { error: ordersError } = await supabase
        .from('batch_delivery_orders')
        .insert(batchOrders);

      if (ordersError) {
        console.error('Batch orders insert error:', ordersError);
        throw ordersError;
      }

      console.log('Batch orders inserted');

      await supabase.from('notifications').insert({
        user_id: selectedRider.user_id,
        type: 'batch_assignment',
        title: 'New Batch Delivery Assignment',
        message: `You have been assigned a ${mealTime} batch with ${selectedOrders.length} deliveries. Accept within 10 minutes.`,
        data: {
          batch_id: batch.id,
          meal_time: mealTime,
          order_count: selectedOrders.length,
          expires_at: expiresAt.toISOString(),
        },
      });

      const { error: updateError } = await supabase
        .from('orders')
        .update({ assigned_rider_id: selectedRider.id })
        .in('id', selectedOrders);

      if (updateError) {
        console.error('Orders update error:', updateError);
        throw updateError;
      }

      console.log('Orders updated with assigned_rider_id');

      Alert.alert(
        'Success',
        `Batch delivery assigned to ${selectedRider.full_name} with ${selectedOrders.length} orders. The rider has 10 minutes to accept this assignment.`
      );
      setSelectedOrders([]);
      setSelectedRider(null);
      setView('main');
      await fetchUnassignedOrders();
    } catch (error: any) {
      console.error('Error creating batch:', error);
      Alert.alert('Error', error.message || 'Failed to create batch delivery. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#10b981';
      case 'busy':
        return '#f59e0b';
      case 'offline':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const renderRiderCard = (rider: Rider, onPress: () => void) => (
    <TouchableOpacity
      key={rider.id}
      style={[
        styles.riderCard,
        selectedRider?.id === rider.id && styles.selectedCard,
      ]}
      onPress={onPress}
    >
      <View style={styles.riderHeader}>
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{rider.full_name}</Text>
          <Text style={styles.riderPhone}>{rider.phone}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(rider.current_status) + '20' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(rider.current_status) },
            ]}
          >
            {rider.current_status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.riderStats}>
        <View style={styles.stat}>
          <Star size={16} color="#ff8c00" />
          <Text style={styles.statText}>{rider.rating.toFixed(1)}</Text>
        </View>
        <View style={styles.stat}>
          <CheckCircle size={16} color="#10b981" />
          <Text style={styles.statText}>{rider.total_completed_deliveries} deliveries</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderOrderCard = (order: Order, isSelectable: boolean = false) => {
    const isSelected = selectedOrders.includes(order.id);
    return (
      <TouchableOpacity
        key={order.id}
        style={[
          styles.orderCard,
          isSelectable && isSelected && styles.selectedCard,
          selectedOrder?.id === order.id && styles.selectedCard,
        ]}
        onPress={() => {
          if (isSelectable) {
            if (isSelected) {
              setSelectedOrders(selectedOrders.filter((id) => id !== order.id));
            } else {
              setSelectedOrders([...selectedOrders, order.id]);
            }
          } else {
            setSelectedOrder(order);
          }
        }}
      >
        <View style={styles.orderHeader}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.orderTotal}>₦{Number(order.total).toFixed(2)}</Text>
        </View>
        <View style={styles.orderInfo}>
          <MapPin size={14} color="#6b7280" />
          <Text style={styles.orderAddress} numberOfLines={1}>
            {order.vendor.business_name}
          </Text>
        </View>
        <View style={styles.orderInfo}>
          <MapPin size={14} color="#ff8c00" />
          <Text style={styles.orderAddress} numberOfLines={1}>
            {order.delivery_address}
          </Text>
        </View>
        {order.meal_time_preference && (
          <View style={styles.mealTimeBadge}>
            <Clock size={14} color="#ff8c00" />
            <Text style={styles.mealTimeText}>
              {order.meal_time_preference.toUpperCase()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (view === 'on-demand') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('main')} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>On-Demand Assignment</Text>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Select Order</Text>
          {orders.map((order) => renderOrderCard(order, false))}

          {selectedOrder && (
            <>
              <Text style={styles.sectionTitle}>Select Rider</Text>
              {riders
                .filter((r) => r.current_status !== 'offline')
                .map((rider) =>
                  renderRiderCard(rider, () => setSelectedRider(rider))
                )}

              <TouchableOpacity
                style={[
                  styles.assignButton,
                  (!selectedRider || assigning) && styles.disabledButton,
                ]}
                onPress={assignRiderToOrder}
                disabled={!selectedRider || assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#fff" />
                    <Text style={styles.assignButtonText}>Assign Rider</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (view === 'batch') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('main')} style={styles.backButton}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Create Batch Delivery</Text>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Meal Time</Text>
          <View style={styles.mealTimeSelector}>
            {(['breakfast', 'lunch', 'dinner'] as const).map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.mealTimeButton,
                  mealTime === time && styles.selectedMealTime,
                ]}
                onPress={() => setMealTime(time)}
              >
                <Text
                  style={[
                    styles.mealTimeButtonText,
                    mealTime === time && styles.selectedMealTimeText,
                  ]}
                >
                  {time.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>
            Select Orders ({selectedOrders.length} selected)
          </Text>
          {orders.map((order) => renderOrderCard(order, true))}

          {selectedOrders.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Select Rider</Text>
              {riders
                .filter((r) => r.current_status !== 'offline')
                .map((rider) =>
                  renderRiderCard(rider, () => setSelectedRider(rider))
                )}

              <TouchableOpacity
                style={[
                  styles.assignButton,
                  (!selectedRider || assigning) && styles.disabledButton,
                ]}
                onPress={createBatchDelivery}
                disabled={!selectedRider || assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Package size={20} color="#fff" />
                    <Text style={styles.assignButtonText}>Create Batch</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
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
        <Text style={styles.title}>Rider Assignment</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Bike size={24} color="#ff8c00" />
            <Text style={styles.statValue}>{riders.length}</Text>
            <Text style={styles.statLabel}>Total Riders</Text>
          </View>
          <View style={styles.statBox}>
            <Package size={24} color="#ff8c00" />
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>Pending Orders</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setView('on-demand')}
        >
          <Bike size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Assign On-Demand Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => setView('batch')}
        >
          <Calendar size={20} color="#ff8c00" />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
            Create Batch Delivery
          </Text>
        </TouchableOpacity>
      </View>
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
  actionButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ff8c00',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#ff8c00',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 20,
  },
  riderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#ff8c00',
    backgroundColor: '#fff7ed',
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  riderPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
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
  riderStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff8c00',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  orderAddress: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  mealTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  mealTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff8c00',
  },
  assignButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  assignButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mealTimeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  mealTimeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  selectedMealTime: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  mealTimeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  selectedMealTimeText: {
    color: '#fff',
  },
});

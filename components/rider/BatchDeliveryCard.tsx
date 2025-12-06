import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Clock, Package, ChevronRight, CheckCircle } from 'lucide-react-native';
import { router } from 'expo-router';

interface BatchDeliveryOrder {
  id: string;
  order_id: string;
  delivery_sequence: number;
  delivered_at: string | null;
  order: {
    order_number: string;
    delivery_address: string;
    total: number;
  };
}

interface BatchDelivery {
  id: string;
  meal_time: 'breakfast' | 'lunch' | 'dinner';
  pickup_window_start: string;
  pickup_window_end: string;
  delivery_deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  orders: BatchDeliveryOrder[];
}

interface BatchDeliveryCardProps {
  batch: BatchDelivery;
}

export default function BatchDeliveryCard({ batch }: BatchDeliveryCardProps) {
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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

  const deliveredCount = batch.orders.filter((o) => o.delivered_at).length;
  const totalOrders = batch.orders.length;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/rider/batch/${batch.id}`)}
    >
      <View style={styles.header}>
        <View style={[styles.mealTimeBadge, { backgroundColor: getMealTimeColor(batch.meal_time) }]}>
          <Text style={styles.mealTimeText}>{getMealTimeLabel(batch.meal_time)}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(batch.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(batch.status) }]}>
            {batch.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.timeInfo}>
        <View style={styles.timeRow}>
          <Clock size={16} color="#64748b" />
          <Text style={styles.timeLabel}>Pickup Window:</Text>
          <Text style={styles.timeValue}>
            {formatTime(batch.pickup_window_start)} - {formatTime(batch.pickup_window_end)}
          </Text>
        </View>
        <View style={styles.timeRow}>
          <MapPin size={16} color="#64748b" />
          <Text style={styles.timeLabel}>Delivery By:</Text>
          <Text style={styles.timeValue}>{formatTime(batch.delivery_deadline)}</Text>
        </View>
      </View>

      <View style={styles.ordersInfo}>
        <View style={styles.ordersRow}>
          <Package size={20} color="#ff8c00" />
          <Text style={styles.ordersText}>
            {totalOrders} {totalOrders === 1 ? 'Stop' : 'Stops'}
          </Text>
        </View>
        {batch.status === 'in_progress' && (
          <View style={styles.progressInfo}>
            <CheckCircle size={16} color="#10b981" />
            <Text style={styles.progressText}>
              {deliveredCount} of {totalOrders} delivered
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.totalEarnings}>
          Total: ₦
          {batch.orders.reduce((sum, o) => sum + o.order.total, 0).toFixed(2)}
        </Text>
        <View style={styles.arrowContainer}>
          <ChevronRight size={20} color="#ff8c00" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
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
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
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
  timeInfo: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  ordersInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ordersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ordersText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalEarnings: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ff8c00',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

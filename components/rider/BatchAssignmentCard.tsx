import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react-native';

interface BatchAssignmentCardProps {
  assignment: {
    id: string;
    meal_time: string;
    pickup_window_start: string;
    pickup_window_end: string;
    expires_at: string;
    batch_delivery_orders: Array<{
      id: string;
      orders: {
        order_number: string;
        delivery_address: string;
        total: number;
        vendors: {
          business_name: string;
          address: string;
        };
      };
    }>;
  };
  onAccept: (batchId: string) => void;
  onReject: (batchId: string) => void;
}

export default function BatchAssignmentCard({
  assignment,
  onAccept,
  onReject,
}: BatchAssignmentCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiresAt = new Date(assignment.expires_at).getTime();
      const remaining = Math.max(0, expiresAt - now);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        return;
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [assignment.expires_at]);

  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept(assignment.id);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await onReject(assignment.id);
    } finally {
      setRejecting(false);
    }
  };

  const orderCount = assignment.batch_delivery_orders.length;
  const totalEarnings = assignment.batch_delivery_orders.reduce(
    (sum, item) => sum + parseFloat(item.orders.total.toString()),
    0
  );

  const pickupVendor = assignment.batch_delivery_orders[0]?.orders?.vendors;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View
          style={[
            styles.mealBadge,
            { backgroundColor: getMealTimeColor(assignment.meal_time) },
          ]}
        >
          <Calendar size={16} color="#ffffff" />
          <Text style={styles.mealText}>{getMealTimeLabel(assignment.meal_time)}</Text>
        </View>

        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor:
                timeRemaining < 180000 ? '#fee2e2' : '#fef3c7',
            },
          ]}
        >
          <Clock
            size={16}
            color={timeRemaining < 180000 ? '#ef4444' : '#f59e0b'}
          />
          <Text
            style={[
              styles.timerText,
              {
                color: timeRemaining < 180000 ? '#ef4444' : '#f59e0b',
              },
            ]}
          >
            {formatTimeRemaining()}
          </Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Package size={20} color="#ff8c00" />
          <Text style={styles.infoText}>
            {orderCount} {orderCount === 1 ? 'Delivery' : 'Deliveries'}
          </Text>
        </View>

        {pickupVendor && (
          <View style={styles.infoRow}>
            <MapPin size={20} color="#10b981" />
            <View style={styles.addressContainer}>
              <Text style={styles.vendorName}>{pickupVendor.business_name}</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {pickupVendor.address}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.timeWindow}>
          <Clock size={16} color="#64748b" />
          <Text style={styles.timeWindowText}>
            Pickup: {formatTime(assignment.pickup_window_start)} -{' '}
            {formatTime(assignment.pickup_window_end)}
          </Text>
        </View>
      </View>

      <View style={styles.earningsContainer}>
        <Text style={styles.earningsLabel}>Total Value</Text>
        <Text style={styles.earningsAmount}>₦{totalEarnings.toFixed(2)}</Text>
      </View>

      {timeRemaining > 0 ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
            disabled={rejecting || accepting}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <XCircle size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
            disabled={accepting || rejecting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <CheckCircle size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.expiredBanner}>
          <AlertCircle size={20} color="#ef4444" />
          <Text style={styles.expiredText}>Assignment Expired</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8c00',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mealText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoSection: {
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  addressContainer: {
    flex: 1,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    color: '#64748b',
  },
  timeWindow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  timeWindowText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  earningsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 8,
  },
  expiredText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
});

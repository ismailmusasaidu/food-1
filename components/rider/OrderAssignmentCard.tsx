import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MapPin, Navigation, Clock, CheckCircle, XCircle, Package } from 'lucide-react-native';

interface OrderAssignment {
  id: string;
  order_id: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  order: {
    order_number: string;
    total: number;
    delivery_address: string;
    customer_name?: string;
    items_count?: number;
  };
  vendor: {
    name: string;
    address: string;
  };
}

interface OrderAssignmentCardProps {
  assignment: OrderAssignment;
  onAccept: (assignmentId: string) => Promise<void>;
  onReject: (assignmentId: string) => Promise<void>;
}

export default function OrderAssignmentCard({
  assignment,
  onAccept,
  onReject,
}: OrderAssignmentCardProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    console.log('OrderAssignmentCard mounted with:', {
      id: assignment.id,
      order_number: assignment.order?.order_number,
      vendor_name: assignment.vendor?.name,
      expires_at: assignment.expires_at,
    });
  }, []);

  useEffect(() => {
    const calculateTimeLeft = () => {
      try {
        const expiresAt = new Date(assignment.expires_at).getTime();
        const now = Date.now();
        const diff = Math.max(0, expiresAt - now);
        setTimeLeft(Math.floor(diff / 1000));
      } catch (error) {
        console.error('Error calculating time left:', error);
        setTimeLeft(0);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [assignment.expires_at]);

  const formatTimeLeft = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleAccept = async () => {
    if (accepting || rejecting) return;
    try {
      setAccepting(true);
      await onAccept(assignment.id);
    } catch (error) {
      console.error('Error accepting order:', error);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (accepting || rejecting) return;
    try {
      setRejecting(true);
      await onReject(assignment.id);
    } catch (error) {
      console.error('Error rejecting order:', error);
    } finally {
      setRejecting(false);
    }
  };

  const isExpired = timeLeft === 0;
  const isUrgent = timeLeft <= 30;

  if (!assignment || !assignment.order || !assignment.vendor) {
    console.error('Invalid assignment data:', assignment);
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error loading assignment</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isExpired && styles.expiredContainer]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Package size={20} color="#ff8c00" />
          <Text style={styles.orderNumber}>#{assignment.order.order_number}</Text>
        </View>
        <View
          style={[
            styles.timerBadge,
            isExpired && styles.expiredBadge,
            isUrgent && !isExpired && styles.urgentBadge,
          ]}
        >
          <Clock size={14} color={isExpired ? '#ef4444' : isUrgent ? '#f59e0b' : '#64748b'} />
          <Text
            style={[
              styles.timerText,
              isExpired && styles.expiredText,
              isUrgent && !isExpired && styles.urgentText,
            ]}
          >
            {isExpired ? 'Expired' : formatTimeLeft()}
          </Text>
        </View>
      </View>

      {assignment.order.customer_name && (
        <Text style={styles.customerName}>{assignment.order.customer_name}</Text>
      )}

      <View style={styles.locationSection}>
        <View style={styles.locationRow}>
          <MapPin size={16} color="#64748b" />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>Pickup from</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {assignment.vendor.name}
            </Text>
            <Text style={styles.locationAddress} numberOfLines={1}>
              {assignment.vendor.address}
            </Text>
          </View>
        </View>

        <View style={styles.locationDivider} />

        <View style={styles.locationRow}>
          <Navigation size={16} color="#64748b" />
          <View style={styles.locationContent}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {assignment.order.delivery_address}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderInfo}>
        {assignment.order.items_count && (
          <Text style={styles.itemsCount}>{assignment.order.items_count} item(s)</Text>
        )}
        <Text style={styles.orderTotal}>₦{assignment.order.total.toFixed(2)}</Text>
      </View>

      {!isExpired && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={accepting || rejecting}
          >
            {rejecting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <XCircle size={20} color="#ef4444" />
                <Text style={styles.rejectText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
            disabled={accepting || rejecting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <CheckCircle size={20} color="#ffffff" />
                <Text style={styles.acceptText}>Accept Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isExpired && (
        <View style={styles.expiredMessage}>
          <Text style={styles.expiredMessageText}>This assignment has expired</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  expiredContainer: {
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  urgentBadge: {
    backgroundColor: '#fef3c7',
  },
  expiredBadge: {
    backgroundColor: '#fee2e2',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  urgentText: {
    color: '#f59e0b',
  },
  expiredText: {
    color: '#ef4444',
  },
  customerName: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  locationSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    color: '#64748b',
  },
  locationDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemsCount: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff8c00',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    flex: 2,
  },
  rejectButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  rejectText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  expiredMessage: {
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  expiredMessageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    padding: 16,
  },
});

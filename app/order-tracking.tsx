import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Package,
  Truck,
  MapPin,
  Phone,
  Calendar,
  XCircle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/types/database';
import OrderItemsList from '@/components/OrderItemsList';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: {
    name: string;
    image_url: string;
  };
}

interface OrderWithItems extends Order {
  items: OrderItem[];
  vendor: {
    business_name: string;
    address: string;
  };
}

const statusIcons: Record<OrderStatus, any> = {
  pending: Clock,
  confirmed: CheckCircle,
  arrived_at_vendor: MapPin,
  pickup_complete: Package,
  arrived_at_customer: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  arrived_at_vendor: '#3b82f6',
  pickup_complete: '#8b5cf6',
  arrived_at_customer: '#ff8c00',
  delivered: '#059669',
  cancelled: '#ef4444',
};

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  arrived_at_vendor: 'Arrived at Vendor',
  pickup_complete: 'Pickup Complete',
  arrived_at_customer: 'Arrived at Customer',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusSteps: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'arrived_at_vendor', label: 'Arrived at Vendor', icon: MapPin },
  { status: 'pickup_complete', label: 'Pickup Complete', icon: Package },
  { status: 'arrived_at_customer', label: 'Arrived at Customer', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();

      // Set up real-time subscription
      const channel = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            if (payload.new) {
              setOrder((prev) => (prev ? { ...prev, ...payload.new } : null));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          order_items (
            id,
            quantity,
            unit_price,
            subtotal,
            products (
              name,
              image_url
            )
          )
        `
        )
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (!data) {
        setOrder(null);
        return;
      }

      // Fetch vendor info separately
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('business_name, address')
        .eq('user_id', data.vendor_id)
        .maybeSingle();

      const formattedOrder: OrderWithItems = {
        ...data,
        items: (data.order_items || []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          product: {
            name: item.products?.name || 'Unknown Product',
            image_url: item.products?.image_url || '',
          },
        })),
        vendor: {
          business_name: vendorData?.business_name || 'Unknown Vendor',
          address: vendorData?.address || 'N/A',
        },
      };

      setOrder(formattedOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatStepTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStepTimestamp = (status: OrderStatus): string | null => {
    if (!order) return null;
    const timestamps: Record<string, string | null> = {
      'pending': order.created_at,
      'confirmed': (order as any).confirmed_at || null,
      'arrived_at_vendor': (order as any).rider_arrived_at_vendor_at || null,
      'pickup_complete': (order as any).pickup_confirmed_at || null,
      'arrived_at_customer': (order as any).rider_arrived_at_customer_at || null,
      'delivered': (order as any).delivered_at || null,
    };
    return timestamps[status];
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    if (order.status === 'cancelled') return -1;
    return statusSteps.findIndex((step) => step.status === order.status);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = order.status === 'cancelled';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusHeaderTitle}>Current Status</Text>
          </View>
          <View style={styles.currentStatusContainer}>
            <View
              style={[
                styles.currentStatusIconContainer,
                { backgroundColor: statusColors[order.status] },
              ]}
            >
              {(() => {
                const StatusIcon = statusIcons[order.status];
                return <StatusIcon size={32} color="#ffffff" />;
              })()}
            </View>
            <Text style={[styles.currentStatusText, { color: statusColors[order.status] }]}>
              {statusLabels[order.status]}
            </Text>
          </View>
        </View>

        {!isCancelled && (
          <View style={styles.trackingContainer}>
            {statusSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <View
                  key={step.status}
                  style={styles.stepContainer}
                >
                  <View style={styles.stepIndicator}>
                    <View
                      style={[
                        styles.stepIconContainer,
                        isCompleted && styles.stepIconCompleted,
                        isCurrent && styles.stepIconCurrent,
                      ]}
                    >
                      <StepIcon
                        size={20}
                        color={isCompleted ? '#ffffff' : '#94a3b8'}
                      />
                    </View>
                    {index < statusSteps.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          isCompleted && styles.stepLineCompleted,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCompleted && styles.stepLabelCompleted,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {isCompleted && getStepTimestamp(step.status) && (
                      <Text style={styles.stepTime}>
                        {formatStepTime(getStepTimestamp(step.status))}
                      </Text>
                    )}
                    {isCurrent && (
                      <Text style={styles.currentStepBadge}>Current Status</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Delivery Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Type</Text>
              <Text style={styles.infoValue}>
                {order.delivery_type === 'delivery' ? 'Home Delivery' : 'Pickup'}
              </Text>
            </View>
            {order.meal_time_preference && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Meal Time</Text>
                <Text style={[styles.infoValue, styles.mealTimeText]}>
                  {order.meal_time_preference.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{order.delivery_address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Vendor Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Store Name</Text>
              <Text style={styles.infoValue}>{order.vendor.business_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Store Address</Text>
              <Text style={styles.infoValue}>{order.vendor.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Package size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Order Items</Text>
          </View>
          <View style={styles.cardContent}>
            <OrderItemsList orderId={order.id} orderStatus={order.status} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Date</Text>
              <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subtotal</Text>
              <Text style={styles.infoValue}>₦{order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Fee</Text>
              <Text style={styles.infoValue}>₦{order.delivery_fee.toFixed(2)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tax</Text>
              <Text style={styles.infoValue}>₦{order.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{order.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {order.notes && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Order Notes</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  },
  errorText: {
    fontSize: 18,
    color: '#6b7280',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 20,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  statusHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statusHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  currentStatusContainer: {
    alignItems: 'center',
    padding: 24,
  },
  currentStatusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  currentStatusText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  orderNumber: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  cancelledBanner: {
    backgroundColor: '#fee2e2',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  cancelledText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  trackingContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 16,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  stepIconCompleted: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  stepIconCurrent: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  stepLine: {
    width: 3,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#ff8c00',
  },
  stepContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 32,
  },
  stepLabel: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#1e293b',
  },
  stepLabelCurrent: {
    color: '#ff8c00',
    fontWeight: '800',
  },
  stepTime: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  currentStepBadge: {
    marginTop: 6,
    fontSize: 12,
    color: '#ff8c00',
    fontWeight: '700',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  cardContent: {
    padding: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  mealTimeText: {
    color: '#ff8c00',
    fontWeight: '800',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ff8c00',
  },
  orderItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    color: '#ff8c00',
    fontWeight: '700',
  },
  notesText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});

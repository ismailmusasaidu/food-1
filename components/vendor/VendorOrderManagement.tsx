import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Package, Clock, CheckCircle, Truck, XCircle, Edit3, X, ArrowLeft, ShoppingBag, Search, UserCheck, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

const statusIcons: Record<OrderStatus, any> = {
  pending: Clock,
  confirmed: CheckCircle,
  preparing: Package,
  ready_for_pickup: ShoppingBag,
  rider_assigned: UserCheck,
  rider_approaching: Navigation,
  out_for_delivery: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusColors: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  preparing: '#ff8c00',
  ready_for_pickup: '#ff8c00',
  rider_assigned: '#3b82f6',
  rider_approaching: '#8b5cf6',
  out_for_delivery: '#ff8c00',
  delivered: '#059669',
  cancelled: '#ef4444',
};

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Order Confirmed' },
  { value: 'preparing', label: 'Vendor Preparing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'rider_assigned', label: 'Rider Assigned' },
  { value: 'rider_approaching', label: 'Rider Approaching' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Order Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface OrderWithCustomer extends Order {
  customer: {
    full_name: string;
    email: string;
    phone: string | null;
  };
}

interface VendorOrderManagementProps {
  onBack?: () => void;
}

export default function VendorOrderManagement({ onBack }: VendorOrderManagementProps) {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile) {
      fetchVendorId();
    }
  }, [profile]);

  useEffect(() => {
    if (vendorId) {
      fetchOrders();

      const channel = supabase
        .channel('vendor-orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `vendor_id=eq.${vendorId}`,
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [vendorId]);

  const fetchVendorId = async () => {
    if (!profile) return;

    // vendor_id in orders references profile.id, not vendors.id
    setVendorId(profile.id);
  };

  const fetchOrders = async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          customer:profiles!orders_customer_id_fkey (
            full_name,
            email,
            phone
          )
        `
        )
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        setOrders([]);
        return;
      }

      const formattedOrders: OrderWithCustomer[] = data.map((order: any) => ({
        ...order,
        customer: order.customer || { full_name: 'Unknown', email: 'N/A', phone: null },
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      setShowStatusModal(false);
      setSelectedOrder(null);

      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const orderId = order.id.toLowerCase();
    const customerName = order.customer.full_name.toLowerCase();
    const customerEmail = order.customer.email.toLowerCase();
    const status = order.status.toLowerCase().replace('_', ' ');
    const total = order.total.toString();
    const deliveryType = (order.delivery_type || '').toLowerCase();

    return (
      orderId.includes(query) ||
      customerName.includes(query) ||
      customerEmail.includes(query) ||
      status.includes(query) ||
      total.includes(query) ||
      deliveryType.includes(query)
    );
  });

  const renderOrderItem = ({ item }: { item: OrderWithCustomer }) => {
    const StatusIcon = statusIcons[item.status];
    const statusColor = statusColors[item.status];

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => setSelectedOrder(item)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
            <Text style={styles.customerName}>{item.customer.full_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <StatusIcon size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.orderRow}>
            <Text style={styles.label}>Total:</Text>
            <Text style={styles.value}>₦{parseFloat(item.total.toString()).toFixed(2)}</Text>
          </View>
          <View style={styles.orderRow}>
            <Text style={styles.label}>Delivery:</Text>
            <Text style={styles.value}>{item.delivery_type || 'N/A'}</Text>
          </View>
          {(item as any).meal_time_preference && (
            <View style={styles.orderRow}>
              <Text style={styles.label}>Meal Time:</Text>
              <Text style={[styles.value, { color: '#ff8c00', fontWeight: '700' }]}>
                {((item as any).meal_time_preference as string).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.orderRow}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={(e) => {
            e.stopPropagation();
            setSelectedOrder(item);
            setShowStatusModal(true);
          }}
        >
          <Edit3 size={16} color="#ff8c00" />
          <Text style={styles.updateButtonText}>Update Status</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#1f2937" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>My Orders</Text>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder="Search by order ID, customer, status, or total..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearButton}
          >
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Search size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No orders match your search</Text>
          <TouchableOpacity
            style={styles.clearSearchButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearSearchText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowStatusModal(false);
          setSelectedOrder(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order Status</Text>
              <TouchableOpacity onPress={() => {
                setShowStatusModal(false);
                setSelectedOrder(null);
              }}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statusList}>
              {statusOptions.map((option) => {
                const StatusIcon = statusIcons[option.value];
                const isSelected = selectedOrder?.status === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.statusOption, isSelected && styles.statusOptionSelected]}
                    onPress={() => {
                      if (selectedOrder) {
                        updateOrderStatus(selectedOrder.id, option.value);
                      }
                    }}
                    disabled={updatingStatus}
                  >
                    <View style={styles.statusOptionContent}>
                      <StatusIcon size={20} color={statusColors[option.value]} />
                      <Text style={styles.statusOptionText}>{option.label}</Text>
                    </View>
                    {isSelected && <CheckCircle size={20} color="#ff8c00" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {updatingStatus && (
              <View style={styles.updatingOverlay}>
                <ActivityIndicator size="large" color="#ff8c00" />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedOrder && !showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.detailsContent}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Order Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order ID:</Text>
                    <Text style={styles.detailValue}>#{selectedOrder.id.slice(0, 8)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColors[selectedOrder.status] + '20' },
                      ]}
                    >
                      {(() => {
                        const StatusIcon = statusIcons[selectedOrder.status];
                        return <StatusIcon size={16} color={statusColors[selectedOrder.status]} />;
                      })()}
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusColors[selectedOrder.status] },
                        ]}
                      >
                        {selectedOrder.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date:</Text>
                    <Text style={styles.detailValue}>{formatDate(selectedOrder.created_at)}</Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Customer Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer.full_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.customer.email}</Text>
                  </View>
                  {selectedOrder.customer.phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone:</Text>
                      <Text style={styles.detailValue}>{selectedOrder.customer.phone}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Delivery Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type:</Text>
                    <Text style={styles.detailValue}>{selectedOrder.delivery_type || 'N/A'}</Text>
                  </View>
                  {(selectedOrder as any).meal_time_preference && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Meal Time:</Text>
                      <Text style={[styles.detailValue, styles.mealTimeValue]}>
                        {((selectedOrder as any).meal_time_preference as string).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {selectedOrder.delivery_address && selectedOrder.delivery_address !== 'N/A' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Delivery Info:</Text>
                      <Text style={[styles.detailValue, { lineHeight: 20 }]}>{selectedOrder.delivery_address}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Payment</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total:</Text>
                    <Text style={[styles.detailValue, styles.totalAmount]}>
                      ₦{parseFloat(selectedOrder.total.toString()).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearSearchButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#ff8c00',
    borderRadius: 8,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    marginTop: 16,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderDetails: {
    gap: 8,
    marginBottom: 12,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 8,
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff8c00',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  detailsModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusList: {
    padding: 20,
  },
  statusOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  statusOptionSelected: {
    borderColor: '#ff8c00',
    backgroundColor: '#eff6ff',
  },
  statusOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    maxWidth: '60%',
    textAlign: 'right',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ff8c00',
  },
  mealTimeValue: {
    fontWeight: '700',
    color: '#ff8c00',
  },
});

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
  Alert,
} from 'react-native';
import { Package, Clock, CheckCircle, Truck, XCircle, Edit3, X, ArrowLeft, ShoppingBag, Search, Trash2, UserCheck, Navigation } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/types/database';

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
    phone?: string;
  };
  vendor: {
    business_name: string;
  };
}

interface OrderManagementProps {
  onBack?: () => void;
}

export default function OrderManagement({ onBack }: OrderManagementProps) {
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithCustomer | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingOrder, setDeletingOrder] = useState(false);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-orders`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch orders');
      }

      const data = await response.json();

      const formattedOrders: OrderWithCustomer[] = data.map((order: any) => ({
        ...order,
        customer: order.customer || { full_name: 'Unknown', email: 'N/A', phone: null },
        vendor: order.vendor || { business_name: 'Unknown', store_name: 'Unknown' },
      }));

      setOrders(formattedOrders);
      setFilteredOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const filtered = orders.filter((order) =>
        order.order_number.toLowerCase().includes(query.toLowerCase()) ||
        order.id.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredOrders(filtered);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      setDeletingOrder(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-orders?id=${orderId}`;
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete order');
      }

      setShowStatusModal(false);
      setSelectedOrder(null);

      await fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      Alert.alert('Error', 'Failed to delete order');
    } finally {
      setDeletingOrder(false);
    }
  };

  const confirmDelete = (order: OrderWithCustomer) => {
    Alert.alert(
      'Delete Order',
      `Are you sure you want to delete order #${order.order_number}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteOrder(order.id),
        },
      ]
    );
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-orders?id=${orderId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          updated_at: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: OrderStatus) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Order Management</Text>
            <Text style={styles.subtitle}>{orders.length} total orders</Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order ID or number..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const StatusIcon = statusIcons[item.status];
          const statusColor = statusColors[item.status];

          return (
            <View>
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>Order #{item.order_number}</Text>
                    <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedOrder(item);
                      setShowStatusModal(true);
                    }}
                    style={styles.editButton}
                  >
                    <Edit3 size={18} color="#ff8c00" />
                  </TouchableOpacity>
                </View>

                <View style={styles.customerInfo}>
                  <Text style={styles.infoLabel}>Customer</Text>
                  <Text style={styles.infoValue}>{item.customer.full_name}</Text>
                  <Text style={styles.infoEmail}>{item.customer.email}</Text>
                  {item.customer.phone && (
                    <Text style={styles.infoPhone}>{item.customer.phone}</Text>
                  )}
                </View>

                <View style={styles.vendorInfo}>
                  <Text style={styles.infoLabel}>Vendor</Text>
                  <Text style={styles.infoValue}>{item.vendor.business_name}</Text>
                </View>

                <View style={styles.deliveryInfo}>
                  <Text style={styles.infoLabel}>Delivery Type</Text>
                  <Text style={styles.deliveryType}>
                    {item.delivery_type === 'pickup' ? 'Pickup' : 'Delivery'}
                  </Text>
                  {(item as any).meal_time_preference && (
                    <Text style={styles.mealTimePreference}>
                      Meal Time: {((item as any).meal_time_preference as string).toUpperCase()}
                    </Text>
                  )}
                  {item.delivery_type === 'delivery' && item.delivery_address && (
                    <Text style={styles.deliveryAddress}>{item.delivery_address}</Text>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <StatusIcon size={16} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                  <Text style={styles.totalAmount}>₦{item.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order Status</Text>
              <TouchableOpacity
                onPress={() => setShowStatusModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {selectedOrder && (
                <>
                  <Text style={styles.modalOrderNumber}>
                    Order #{selectedOrder.order_number}
                  </Text>
                  <Text style={styles.modalCustomer}>{selectedOrder.customer.full_name}</Text>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      setShowStatusModal(false);
                      setTimeout(() => confirmDelete(selectedOrder), 300);
                    }}
                    disabled={deletingOrder || updatingStatus}
                  >
                    <Trash2 size={20} color="#ef4444" />
                    <Text style={styles.deleteButtonText}>Delete Order</Text>
                  </TouchableOpacity>

                  <View style={styles.statusOptions}>
                    {statusOptions.map((option) => {
                      const OptionIcon = statusIcons[option.value];
                      const optionColor = statusColors[option.value];
                      const isSelected = selectedOrder.status === option.value;

                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.statusOption,
                            isSelected && styles.statusOptionSelected,
                            { borderColor: optionColor + '40' },
                          ]}
                          onPress={() => updateOrderStatus(selectedOrder.id, option.value)}
                          disabled={updatingStatus}
                        >
                          <OptionIcon size={20} color={optionColor} />
                          <Text style={[styles.statusOptionText, { color: optionColor }]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <View style={[styles.selectedIndicator, { backgroundColor: optionColor }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {updatingStatus && (
                    <View style={styles.updatingContainer}>
                      <ActivityIndicator size="small" color="#ff8c00" />
                      <Text style={styles.updatingText}>Updating status...</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  searchIcon: {
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  list: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  orderDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
  },
  customerInfo: {
    marginBottom: 12,
  },
  vendorInfo: {
    marginBottom: 12,
  },
  deliveryInfo: {
    marginBottom: 12,
  },
  deliveryType: {
    fontSize: 14,
    color: '#ff8c00',
    fontWeight: '700',
  },
  deliveryAddress: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  mealTimePreference: {
    fontSize: 12,
    color: '#ff8c00',
    fontWeight: '800',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '700',
  },
  infoEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  infoPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ff8c00',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    flexShrink: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  modalOrderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff8c00',
    marginBottom: 4,
  },
  modalCustomer: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
  statusOptions: {
    gap: 10,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    position: 'relative',
  },
  statusOptionSelected: {
    backgroundColor: '#f8fafc',
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  updatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    gap: 8,
  },
  updatingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
});

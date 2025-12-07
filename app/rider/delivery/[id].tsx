import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Phone,
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Store,
  User,
  X,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  total: number;
  delivery_address: string;
  customer_id: string;
  vendor_id: string;
  assigned_rider_id: string;
  rider_arrived_at_vendor_at: string | null;
  pickup_confirmed_at: string | null;
  rider_arrived_at_customer_at: string | null;
  delivered_at: string | null;
  customer_confirmation_method: string | null;
  notes?: string;
  vendors?: {
    user_id: string;
    business_name: string;
    address: string;
  };
}

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [issueDescription, setIssueDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
      subscribeToUpdates();
    }
  }, [id]);

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        () => {
          fetchOrderDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          vendors!inner (
            user_id,
            business_name,
            address
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (orderError) throw orderError;

      if (!orderData) {
        setErrorMessage('Order not found');
        return;
      }

      setOrder(orderData);

      const { data: customer } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', orderData.customer_id)
        .maybeSingle();

      setCustomerInfo(customer || { full_name: 'Unknown', phone: 'N/A' });

      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('business_phone')
        .eq('id', orderData.vendors?.user_id)
        .maybeSingle();

      setVendorInfo({
        business_name: orderData.vendors?.business_name || 'Unknown Vendor',
        business_address: orderData.vendors?.address || 'N/A',
        business_phone: vendorProfile?.business_phone || null,
      });
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArrivedAtVendor = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update({
          rider_arrived_at_vendor_at: new Date().toISOString(),
          status: 'arrived_at_vendor',
        })
        .eq('id', order.id);

      if (error) throw error;

      if (order.vendors?.user_id) {
        await supabase.from('notifications').insert({
          user_id: order.vendors.user_id,
          type: 'rider_arrived',
          title: 'Rider Arrived',
          message: `Rider has arrived to pick up order #${order.order_number}`,
          data: { order_id: order.id },
          read: false,
        });
      }

      setSuccessMessage('Vendor notified of your arrival');
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error updating arrival:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handlePickupComplete = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update({
          pickup_confirmed_at: new Date().toISOString(),
          status: 'pickup_complete',
        })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        type: 'order_picked_up',
        title: 'Order Picked Up',
        message: `Your order #${order.order_number} is on the way!`,
        data: { order_id: order.id },
        read: false,
      });

      setSuccessMessage('Pickup confirmed! Navigate to customer');
      openMapsNavigation(order.delivery_address);
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error confirming pickup:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleArrivedAtCustomer = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update({
          rider_arrived_at_customer_at: new Date().toISOString(),
          status: 'arrived_at_customer',
        })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        type: 'rider_arrived',
        title: 'Rider Arrived',
        message: `Your delivery has arrived for order #${order.order_number}`,
        data: { order_id: order.id },
        read: false,
      });

      setSuccessMessage('Customer notified of your arrival');
      await fetchOrderDetails();
    } catch (error: any) {
      console.error('Error updating arrival:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelivered = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update({
          delivered_at: new Date().toISOString(),
          status: 'delivered',
          customer_confirmation_method: 'in_app',
        })
        .eq('id', order.id);

      if (error) throw error;

      if (order.assigned_rider_id) {
        await supabase.from('rider_earnings').insert({
          rider_id: order.assigned_rider_id,
          order_id: order.id,
          amount: (order.total * 0.1).toString(),
          date: new Date().toISOString().split('T')[0],
          status: 'pending',
        });
      }

      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        type: 'order_delivered',
        title: 'Order Delivered',
        message: `Order #${order.order_number} has been delivered successfully!`,
        data: { order_id: order.id },
        read: false,
      });

      setSuccessMessage('Delivery completed! Great job!');
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      console.error('Error completing delivery:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReportIssue = async () => {
    if (!order || !issueType) return;

    try {
      setUpdating(true);

      if (!order.assigned_rider_id) throw new Error('Rider not found');

      await supabase.from('delivery_issues').insert({
        order_id: order.id,
        rider_id: order.assigned_rider_id,
        issue_type: issueType,
        description: issueDescription || null,
        resolved: false,
      });

      const { data: adminProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (adminProfiles) {
        await Promise.all(
          adminProfiles.map((admin) =>
            supabase.from('notifications').insert({
              user_id: admin.id,
              type: 'delivery_issue',
              title: 'Delivery Issue Reported',
              message: `Issue with order #${order.order_number}: ${issueType.replace('_', ' ')}`,
              data: { order_id: order.id, issue_type: issueType },
              read: false,
            })
          )
        );
      }

      setSuccessMessage('Issue reported to admin');
      setShowIssueModal(false);
      setIssueType('');
      setIssueDescription('');
    } catch (error: any) {
      console.error('Error reporting issue:', error);
      setErrorMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    if (phoneNumber && phoneNumber !== 'N/A') {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      setErrorMessage('Phone number not available');
    }
  };

  const openMapsNavigation = (address: string) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}`,
      android: `geo:0,0?q=${encodeURIComponent(address)}`,
      web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    });

    if (url) {
      Linking.openURL(url);
    }
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
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const canArrivedAtVendor = !order.rider_arrived_at_vendor_at;
  const canPickupComplete = order.rider_arrived_at_vendor_at && !order.pickup_confirmed_at;
  const canArrivedAtCustomer = order.pickup_confirmed_at && !order.rider_arrived_at_customer_at;
  const canDelivered = order.rider_arrived_at_customer_at && !order.delivered_at;
  const isDelivered = !!order.delivered_at;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Delivery Details</Text>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Delivery Progress</Text>
          <View style={styles.progressSteps}>
            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  order.rider_arrived_at_vendor_at && styles.progressDotCompleted,
                ]}
              >
                {order.rider_arrived_at_vendor_at ? (
                  <CheckCircle size={20} color="#10b981" />
                ) : (
                  <Clock size={20} color="#94a3b8" />
                )}
              </View>
              <Text style={styles.progressLabel}>Arrived at Vendor</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  order.pickup_confirmed_at && styles.progressDotCompleted,
                ]}
              >
                {order.pickup_confirmed_at ? (
                  <CheckCircle size={20} color="#10b981" />
                ) : (
                  <Package size={20} color="#94a3b8" />
                )}
              </View>
              <Text style={styles.progressLabel}>Pickup Complete</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  order.rider_arrived_at_customer_at && styles.progressDotCompleted,
                ]}
              >
                {order.rider_arrived_at_customer_at ? (
                  <CheckCircle size={20} color="#10b981" />
                ) : (
                  <Navigation size={20} color="#94a3b8" />
                )}
              </View>
              <Text style={styles.progressLabel}>Arrived at Customer</Text>
            </View>

            <View style={styles.progressLine} />

            <View style={styles.progressStep}>
              <View
                style={[styles.progressDot, order.delivered_at && styles.progressDotCompleted]}
              >
                {order.delivered_at ? (
                  <CheckCircle size={20} color="#10b981" />
                ) : (
                  <User size={20} color="#94a3b8" />
                )}
              </View>
              <Text style={styles.progressLabel}>Delivered</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Store size={20} color="#ff8c00" />
            <Text style={styles.cardTitle}>Vendor Information</Text>
          </View>
          <Text style={styles.infoValue}>
            {vendorInfo?.business_name || vendorInfo?.full_name}
          </Text>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => openMapsNavigation(vendorInfo?.business_address || '')}
          >
            <MapPin size={16} color="#64748b" />
            <Text style={styles.locationText}>{vendorInfo?.business_address}</Text>
            <Navigation size={16} color="#ff8c00" />
          </TouchableOpacity>
          {vendorInfo?.business_phone && (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => handleCall(vendorInfo.business_phone)}
            >
              <Phone size={20} color="#ff8c00" />
              <Text style={styles.phoneText}>{vendorInfo.business_phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <User size={20} color="#10b981" />
            <Text style={styles.cardTitle}>Customer Information</Text>
          </View>
          <Text style={styles.infoValue}>{customerInfo?.full_name}</Text>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => openMapsNavigation(order.delivery_address)}
          >
            <MapPin size={16} color="#64748b" />
            <Text style={styles.locationText}>{order.delivery_address}</Text>
            <Navigation size={16} color="#10b981" />
          </TouchableOpacity>
          {customerInfo?.phone && (
            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => handleCall(customerInfo.phone)}
            >
              <Phone size={20} color="#10b981" />
              <Text style={styles.phoneText}>{customerInfo.phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order Total</Text>
            <Text style={styles.orderTotal}>₦{order.total.toFixed(2)}</Text>
          </View>
          {order.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Special Instructions:</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          )}
        </View>

        {!isDelivered && (
          <View style={styles.actionsCard}>
            {canArrivedAtVendor && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleArrivedAtVendor}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Store size={20} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Arrived at Vendor</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {canPickupComplete && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handlePickupComplete}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Package size={20} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Pickup Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {canArrivedAtCustomer && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleArrivedAtCustomer}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Navigation size={20} color="#ffffff" />
                    <Text style={styles.actionButtonText}>Arrived at Customer</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {canDelivered && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.successButton]}
                  onPress={handleDelivered}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <CheckCircle size={20} color="#ffffff" />
                      <Text style={styles.actionButtonText}>Mark as Delivered</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={() => setShowIssueModal(true)}
                  disabled={updating}
                >
                  <AlertCircle size={20} color="#ef4444" />
                  <Text style={styles.dangerButtonText}>Report Issue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {isDelivered && (
          <View style={styles.completedCard}>
            <CheckCircle size={48} color="#10b981" />
            <Text style={styles.completedTitle}>Delivery Completed!</Text>
            <Text style={styles.completedText}>Great job on this delivery</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={showIssueModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report Delivery Issue</Text>
            <TouchableOpacity onPress={() => setShowIssueModal(false)}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalLabel}>Select Issue Type</Text>

            <TouchableOpacity
              style={[
                styles.issueOption,
                issueType === 'customer_not_picking' && styles.issueOptionSelected,
              ]}
              onPress={() => setIssueType('customer_not_picking')}
            >
              <Text
                style={[
                  styles.issueOptionText,
                  issueType === 'customer_not_picking' && styles.issueOptionTextSelected,
                ]}
              >
                Customer Not Picking Up
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.issueOption,
                issueType === 'address_not_found' && styles.issueOptionSelected,
              ]}
              onPress={() => setIssueType('address_not_found')}
            >
              <Text
                style={[
                  styles.issueOptionText,
                  issueType === 'address_not_found' && styles.issueOptionTextSelected,
                ]}
              >
                Address Not Found
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.issueOption,
                issueType === 'refund_requested' && styles.issueOptionSelected,
              ]}
              onPress={() => setIssueType('refund_requested')}
            >
              <Text
                style={[
                  styles.issueOptionText,
                  issueType === 'refund_requested' && styles.issueOptionTextSelected,
                ]}
              >
                Refund Requested
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.issueOption, issueType === 'other' && styles.issueOptionSelected]}
              onPress={() => setIssueType('other')}
            >
              <Text
                style={[
                  styles.issueOptionText,
                  issueType === 'other' && styles.issueOptionTextSelected,
                ]}
              >
                Other Issue
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Describe the issue..."
              multiline
              numberOfLines={4}
              value={issueDescription}
              onChangeText={setIssueDescription}
            />

            <TouchableOpacity
              style={[styles.submitButton, !issueType && styles.submitButtonDisabled]}
              onPress={handleReportIssue}
              disabled={!issueType || updating}
            >
              {updating ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Issue Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  orderNumber: {
    fontSize: 14,
    color: '#fff7ed',
    marginTop: 4,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
    marginBottom: 20,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressDotCompleted: {
    backgroundColor: '#f0fdf4',
  },
  progressLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  progressLine: {
    height: 2,
    flex: 0.5,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
    marginBottom: 32,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  infoValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '700',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
  },
  phoneText: {
    fontSize: 16,
    color: '#ff8c00',
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ff8c00',
  },
  notesContainer: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
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
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#ff8c00',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  dangerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
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
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
    marginTop: 8,
  },
  issueOption: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#f8fafc',
  },
  issueOptionSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  issueOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  issueOptionTextSelected: {
    color: '#ff8c00',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
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

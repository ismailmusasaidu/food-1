import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Truck, MapPin, CreditCard, ChevronLeft, CheckCircle, Clock, Calendar, Sun, Utensils, Moon, Wallet, Building2, DollarSign, Copy } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

interface CartItemWithProduct {
  id: string;
  quantity: number;
  product_id: string;
  product: {
    id: string;
    name: string;
    price: number;
    unit: string;
    vendor_id: string;
  };
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  display_order: number;
}

const DELIVERY_FEE = 5.0;

export default function CheckoutScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [mealTimePreference, setMealTimePreference] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'bank_transfer' | 'wallet' | 'paystack'>('cash_on_delivery');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [fontsLoaded] = useFonts({
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  useEffect(() => {
    fetchCartItems();
    fetchBankAccounts();
  }, []);

  const fetchCartItems = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('carts')
        .select(
          `
          id,
          quantity,
          product_id,
          products (
            id,
            name,
            price,
            unit,
            vendor_id
          )
        `
        )
        .eq('user_id', profile.id);

      if (error) throw error;

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        product_id: item.product_id,
        product: item.products,
      }));

      setCartItems(formattedData);
    } catch (error) {
      console.error('Error fetching cart:', error);
      Alert.alert('Error', 'Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied', `${label} copied to clipboard`);
      } catch (error) {
        Alert.alert('Error', 'Failed to copy to clipboard');
      }
    } else {
      Alert.alert('Info', `${label}: ${text}`);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryFee = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
    return subtotal + deliveryFee;
  };

  const handlePlaceOrder = async () => {
    if (!profile) return;

    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert('Missing Address', 'Please provide a delivery address');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryName.trim()) {
      Alert.alert('Missing Name', 'Please provide a delivery name');
      return;
    }

    if (deliveryType === 'delivery' && !deliveryPhone.trim()) {
      Alert.alert('Missing Phone', 'Please provide a delivery phone number');
      return;
    }

    if (scheduleType === 'scheduled' && !scheduledDate.trim()) {
      Alert.alert('Missing Date', 'Please select a delivery date');
      return;
    }

    if (scheduleType === 'scheduled' && !scheduledTime.trim()) {
      Alert.alert('Missing Time', 'Please select a delivery time');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty');
      return;
    }

    try {
      setSubmitting(true);

      const vendorId = cartItems[0].product.vendor_id;
      const orderNumber = `ORD-${Date.now()}`;
      const subtotal = calculateSubtotal();
      const deliveryFee = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
      const total = subtotal + deliveryFee;

      let scheduledDeliveryTime = null;
      if (scheduleType === 'scheduled' && scheduledDate && scheduledTime) {
        scheduledDeliveryTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: profile.id,
          vendor_id: vendorId,
          order_number: orderNumber,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          total: total,
          delivery_type: deliveryType,
          delivery_address: deliveryType === 'delivery' ? `${deliveryName}\n${deliveryPhone}\n${deliveryAddress}` : 'N/A',
          status: 'pending',
          is_scheduled: scheduleType === 'scheduled',
          scheduled_delivery_time: scheduledDeliveryTime,
          meal_time_preference: mealTimePreference,
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
        subtotal: item.product.price * item.quantity,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      if (paymentMethod === 'wallet') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wallet-payment`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                order_id: orderData.id,
                amount: total,
                description: `Payment for order #${orderNumber}`,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Wallet payment failed');
          }

          const result = await response.json();
          console.log('Wallet payment successful:', result);
        } catch (walletError: any) {
          console.error('Wallet payment error:', walletError);
          await supabase
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderData.id);

          Alert.alert('Payment Failed', walletError.message || 'Failed to process wallet payment');
          return;
        }
      }

      if (paymentMethod === 'paystack') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No session');

          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/paystack-initialize`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount: total,
                email: profile.email,
                order_id: orderData.id,
                order_number: orderNumber,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to initialize payment');
          }

          const result = await response.json();

          const canOpen = await Linking.canOpenURL(result.authorization_url);
          if (canOpen) {
            await Linking.openURL(result.authorization_url);
          } else {
            throw new Error('Cannot open payment URL');
          }

          if (Platform.OS === 'web') {
            alert('You will be redirected to complete payment. Please complete the payment and return to the app.');
          }

          return;
        } catch (paystackError: any) {
          console.error('Paystack payment error:', paystackError);
          await supabase
            .from('orders')
            .update({ payment_status: 'failed' })
            .eq('id', orderData.id);

          Alert.alert('Payment Failed', paystackError.message || 'Failed to initialize payment');
          return;
        }
      }

      const { error: deleteError } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', profile.id);

      if (deleteError) throw deleteError;

      setOrderNumber(orderNumber);
      setOrderPlaced(true);
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (orderPlaced) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Order Placed!</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.successContent}>
          <View style={styles.successIconContainer}>
            <View style={styles.successIconCircle}>
              <CheckCircle size={64} color="#ff8c00" strokeWidth={2} />
            </View>
          </View>

          <Text style={styles.successTitle}>Order Confirmed!</Text>
          <Text style={styles.successMessage}>
            Your order has been placed successfully
          </Text>

          <View style={styles.orderDetailsCard}>
            <Text style={styles.orderDetailsTitle}>Order Details</Text>

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Order Number</Text>
              <Text style={styles.orderDetailValue}>#{orderNumber}</Text>
            </View>

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Delivery Type</Text>
              <Text style={styles.orderDetailValue}>
                {deliveryType === 'delivery' ? 'Home Delivery' : 'Pickup'}
              </Text>
            </View>

            {mealTimePreference && (
              <View style={styles.orderDetailRow}>
                <Text style={styles.orderDetailLabel}>Meal Time</Text>
                <Text style={styles.orderDetailValue}>
                  {mealTimePreference.toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Schedule</Text>
              <Text style={styles.orderDetailValue}>
                {scheduleType === 'scheduled'
                  ? `${scheduledDate} at ${scheduledTime}`
                  : 'Immediate'
                }
              </Text>
            </View>

            {deliveryType === 'delivery' && (
              <View style={styles.orderDetailRow}>
                <Text style={styles.orderDetailLabel}>Delivery Address</Text>
                <Text style={[styles.orderDetailValue, styles.addressText]}>
                  {deliveryAddress}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Total Amount</Text>
              <Text style={styles.orderTotalValue}>₦{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          {paymentMethod === 'bank_transfer' && (
            <View style={styles.bankTransferReminder}>
              <View style={styles.bankTransferReminderHeader}>
                <Building2 size={20} color="#ff8c00" />
                <Text style={styles.bankTransferReminderTitle}>Payment Reminder</Text>
              </View>
              <Text style={styles.bankTransferReminderText}>
                Please include your Order ID <Text style={styles.orderIdHighlight}>#{orderNumber}</Text> in the transfer details/narration when making the bank transfer. This helps us verify your payment quickly.
              </Text>
            </View>
          )}

          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>What's Next?</Text>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={styles.timelineIcon}>
                  <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Order Confirmed</Text>
                <Text style={styles.timelineItemTime}>Just now</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Clock size={20} color="#94a3b8" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Vendor Confirmation</Text>
                <Text style={styles.timelineItemTime}>Within 1 hour</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Package size={20} color="#94a3b8" />
                </View>
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Preparing Order</Text>
                <Text style={styles.timelineItemTime}>1-2 hours</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconContainer}>
                <View style={[styles.timelineIcon, styles.timelineIconPending]}>
                  <Truck size={20} color="#94a3b8" />
                </View>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>
                  {deliveryType === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
                </Text>
                <Text style={styles.timelineItemTime}>2-4 hours</Text>
              </View>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)/orders')}
            >
              <Text style={styles.primaryButtonText}>View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) + 20 }]}>
        <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>

          <TouchableOpacity
            style={[styles.optionCard, deliveryType === 'pickup' && styles.optionCardActive]}
            onPress={() => setDeliveryType('pickup')}
          >
            <View style={styles.optionIcon}>
              <Package size={24} color={deliveryType === 'pickup' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Pickup</Text>
              <Text style={styles.optionDescription}>Pick up from the vendor</Text>
            </View>
            {deliveryType === 'pickup' && <View style={styles.selectedDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, deliveryType === 'delivery' && styles.optionCardActive]}
            onPress={() => setDeliveryType('delivery')}
          >
            <View style={styles.optionIcon}>
              <Truck size={24} color={deliveryType === 'delivery' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Delivery</Text>
              <Text style={styles.optionDescription}>Delivered to your address</Text>
            </View>
            {deliveryType === 'delivery' && <View style={styles.selectedDot} />}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>

          <TouchableOpacity
            style={[styles.optionCard, scheduleType === 'immediate' && styles.optionCardActive]}
            onPress={() => setScheduleType('immediate')}
          >
            <View style={styles.optionIcon}>
              <Clock size={24} color={scheduleType === 'immediate' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Immediate</Text>
              <Text style={styles.optionDescription}>
                {deliveryType === 'delivery' ? 'Deliver as soon as possible' : 'Pick up as soon as ready'}
              </Text>
            </View>
            {scheduleType === 'immediate' && <View style={styles.selectedDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, scheduleType === 'scheduled' && styles.optionCardActive]}
            onPress={() => setScheduleType('scheduled')}
          >
            <View style={styles.optionIcon}>
              <Calendar size={24} color={scheduleType === 'scheduled' ? '#ff8c00' : '#64748b'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Schedule</Text>
              <Text style={styles.optionDescription}>Choose a specific date and time</Text>
            </View>
            {scheduleType === 'scheduled' && <View style={styles.selectedDot} />}
          </TouchableOpacity>
        </View>

        {scheduleType === 'scheduled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Date & Time</Text>

            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeInputWrapper}>
                <Calendar size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={scheduledDate}
                  onChangeText={setScheduledDate}
                />
              </View>

              <View style={styles.dateTimeInputWrapper}>
                <Clock size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.dateTimeInput}
                  placeholder="HH:MM (24h)"
                  placeholderTextColor="#9ca3af"
                  value={scheduledTime}
                  onChangeText={setScheduledTime}
                />
              </View>
            </View>

            <Text style={styles.helperText}>
              Format: Date (2024-12-25), Time (14:30)
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meal Time Preference (Optional)</Text>
          <Text style={styles.helperText} style={{ marginBottom: 12 }}>
            Select if you want this delivered at a specific meal time
          </Text>

          <View style={styles.mealTimeGrid}>
            <TouchableOpacity
              style={[
                styles.mealTimeOption,
                mealTimePreference === 'breakfast' && styles.mealTimeOptionActive,
              ]}
              onPress={() => setMealTimePreference(mealTimePreference === 'breakfast' ? null : 'breakfast')}
            >
              <Sun size={20} color={mealTimePreference === 'breakfast' ? '#ffffff' : '#ff8c00'} />
              <Text
                style={[
                  styles.mealTimeOptionText,
                  mealTimePreference === 'breakfast' && styles.mealTimeOptionTextActive,
                ]}
              >
                BREAKFAST
              </Text>
              <Text
                style={[
                  styles.mealTimeOptionTime,
                  mealTimePreference === 'breakfast' && styles.mealTimeOptionTimeActive,
                ]}
              >
                Before 8 am
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mealTimeOption,
                mealTimePreference === 'lunch' && styles.mealTimeOptionActive,
              ]}
              onPress={() => setMealTimePreference(mealTimePreference === 'lunch' ? null : 'lunch')}
            >
              <Utensils size={20} color={mealTimePreference === 'lunch' ? '#ffffff' : '#ff8c00'} />
              <Text
                style={[
                  styles.mealTimeOptionText,
                  mealTimePreference === 'lunch' && styles.mealTimeOptionTextActive,
                ]}
              >
                LUNCH
              </Text>
              <Text
                style={[
                  styles.mealTimeOptionTime,
                  mealTimePreference === 'lunch' && styles.mealTimeOptionTimeActive,
                ]}
              >
                Before 12 pm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mealTimeOption,
                mealTimePreference === 'dinner' && styles.mealTimeOptionActive,
              ]}
              onPress={() => setMealTimePreference(mealTimePreference === 'dinner' ? null : 'dinner')}
            >
              <Moon size={20} color={mealTimePreference === 'dinner' ? '#ffffff' : '#ff8c00'} />
              <Text
                style={[
                  styles.mealTimeOptionText,
                  mealTimePreference === 'dinner' && styles.mealTimeOptionTextActive,
                ]}
              >
                DINNER
              </Text>
              <Text
                style={[
                  styles.mealTimeOptionTime,
                  mealTimePreference === 'dinner' && styles.mealTimeOptionTimeActive,
                ]}
              >
                Before 7 pm
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {deliveryType === 'delivery' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#9ca3af"
              value={deliveryName}
              onChangeText={setDeliveryName}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#9ca3af"
              value={deliveryPhone}
              onChangeText={setDeliveryPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.addressInputContainer}>
              <MapPin size={20} color="#6b7280" style={styles.addressIcon} />
              <TextInput
                style={styles.addressInput}
                placeholder="Enter your delivery address"
                placeholderTextColor="#9ca3af"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <Text style={styles.helperText} style={{ marginBottom: 14 }}>
            Choose how you'd like to pay for your order
          </Text>

          <TouchableOpacity
            style={[styles.paymentCard, paymentMethod === 'cash_on_delivery' && styles.paymentCardActive]}
            onPress={() => setPaymentMethod('cash_on_delivery')}
          >
            <View style={[styles.paymentIcon, paymentMethod === 'cash_on_delivery' && styles.paymentIconActive]}>
              <DollarSign size={24} color={paymentMethod === 'cash_on_delivery' ? '#ffffff' : '#ff8c00'} />
            </View>
            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>Cash On Delivery</Text>
              <Text style={styles.paymentDescription}>Pay with cash when your order arrives</Text>
            </View>
            {paymentMethod === 'cash_on_delivery' && (
              <View style={styles.paymentCheckmark}>
                <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentCard, paymentMethod === 'bank_transfer' && styles.paymentCardActive]}
            onPress={() => setPaymentMethod('bank_transfer')}
          >
            <View style={[styles.paymentIcon, paymentMethod === 'bank_transfer' && styles.paymentIconActive]}>
              <Building2 size={24} color={paymentMethod === 'bank_transfer' ? '#ffffff' : '#ff8c00'} />
            </View>
            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>Bank Transfer</Text>
              <Text style={styles.paymentDescription}>Transfer to our bank account</Text>
            </View>
            {paymentMethod === 'bank_transfer' && (
              <View style={styles.paymentCheckmark}>
                <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
              </View>
            )}
          </TouchableOpacity>

          {paymentMethod === 'bank_transfer' && bankAccounts.length > 0 && (
            <View style={styles.bankAccountsContainer}>
              <Text style={styles.bankAccountsTitle}>Transfer to any of these accounts</Text>
              {bankAccounts.map((account) => (
                <View key={account.id} style={styles.bankAccountCard}>
                  <Text style={styles.bankAccountName}>{account.bank_name}</Text>

                  <View style={styles.bankDetailRow}>
                    <View style={styles.bankDetailContent}>
                      <Text style={styles.bankDetailLabel}>Account Number</Text>
                      <Text style={styles.bankDetailValue}>{account.account_number}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(account.account_number, 'Account number')}
                    >
                      <Copy size={16} color="#ff8c00" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.bankDetailRow}>
                    <View style={styles.bankDetailContent}>
                      <Text style={styles.bankDetailLabel}>Account Name</Text>
                      <Text style={styles.bankDetailValue}>{account.account_name}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(account.account_name, 'Account name')}
                    >
                      <Copy size={16} color="#ff8c00" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.bankTransferNote}>
                <Text style={styles.bankTransferNoteText}>
                  ⚠️ Important: After placing your order, you will receive an Order ID. Please include this Order ID in your transfer details/narration when making the payment. Transfer the exact amount and your order will be confirmed after payment verification.
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.paymentCard, paymentMethod === 'wallet' && styles.paymentCardActive]}
            onPress={() => setPaymentMethod('wallet')}
          >
            <View style={[styles.paymentIcon, paymentMethod === 'wallet' && styles.paymentIconActive]}>
              <Wallet size={24} color={paymentMethod === 'wallet' ? '#ffffff' : '#ff8c00'} />
            </View>
            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>Wallet</Text>
              <Text style={styles.paymentDescription}>Pay from your wallet balance</Text>
            </View>
            {paymentMethod === 'wallet' && (
              <View style={styles.paymentCheckmark}>
                <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentCard, paymentMethod === 'paystack' && styles.paymentCardActive]}
            onPress={() => setPaymentMethod('paystack')}
          >
            <View style={[styles.paymentIcon, paymentMethod === 'paystack' && styles.paymentIconActive]}>
              <CreditCard size={24} color={paymentMethod === 'paystack' ? '#ffffff' : '#ff8c00'} />
            </View>
            <View style={styles.paymentContent}>
              <Text style={styles.paymentTitle}>Online Payment</Text>
              <Text style={styles.paymentDescription}>Pay securely with card via Paystack</Text>
            </View>
            {paymentMethod === 'paystack' && (
              <View style={styles.paymentCheckmark}>
                <CheckCircle size={20} color="#ff8c00" fill="#ff8c00" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.summaryRow}>
                <Text style={styles.summaryText}>
                  {item.product.name} x{item.quantity}
                </Text>
                <Text style={styles.summaryPrice}>
                  ₦{(item.product.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₦{calculateSubtotal().toFixed(2)}</Text>
            </View>

            {deliveryType === 'delivery' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>₦{DELIVERY_FEE.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          style={[styles.placeOrderButton, submitting && styles.buttonDisabled]}
          onPress={handlePlaceOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <CreditCard size={20} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.placeOrderButtonText}>Place Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    color: '#6b7280',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.5,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: 'Poppins-Bold',
    color: '#1e293b',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCardActive: {
    borderColor: '#ff8c00',
    backgroundColor: '#f0f9ff',
    shadowColor: '#ff8c00',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1f2937',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6b7280',
  },
  selectedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 2.5,
    borderColor: '#ff8c00',
    marginBottom: 16,
    fontWeight: '600',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  addressInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2.5,
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  addressIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  addressInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    minHeight: 80,
    textAlignVertical: 'top',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6b7280',
    flex: 1,
  },
  summaryPrice: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1f2937',
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 24,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ff8c00',
    letterSpacing: 0.5,
  },
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  placeOrderButton: {
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  placeOrderButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  successContent: {
    padding: 20,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  successTitle: {
    fontSize: 32,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  successMessage: {
    fontSize: 17,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  orderDetailsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  orderDetailsTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  orderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  },
  orderDetailLabel: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
    flex: 1,
  },
  orderDetailValue: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#1e293b',
    textAlign: 'right',
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  orderTotalValue: {
    fontSize: 24,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ff8c00',
    letterSpacing: 0.5,
  },
  timelineCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  timelineTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconPending: {
    backgroundColor: '#f1f5f9',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
    marginBottom: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 20,
  },
  timelineItemTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  timelineItemTime: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#94a3b8',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#ff8c00',
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
  dateTimeContainer: {
    gap: 12,
  },
  dateTimeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2.5,
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  dateTimeInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  mealTimeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mealTimeOption: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  mealTimeOptionActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  mealTimeOptionText: {
    fontSize: 11,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    letterSpacing: 0.3,
  },
  mealTimeOptionTextActive: {
    color: '#ffffff',
  },
  mealTimeOptionTime: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  mealTimeOptionTimeActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  paymentCardActive: {
    borderColor: '#ff8c00',
    backgroundColor: '#fff7ed',
    shadowColor: '#ff8c00',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  paymentIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffedd5',
  },
  paymentIconActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentContent: {
    flex: 1,
    marginLeft: 14,
  },
  paymentTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#1e293b',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  paymentDescription: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    lineHeight: 18,
  },
  paymentCheckmark: {
    marginLeft: 8,
  },
  bankAccountsContainer: {
    marginTop: 16,
    gap: 12,
  },
  bankAccountsTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  bankAccountCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankAccountName: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#ff8c00',
    marginBottom: 12,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bankDetailContent: {
    flex: 1,
  },
  bankDetailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
    marginBottom: 4,
  },
  bankDetailValue: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#1e293b',
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff8c00',
  },
  bankTransferNote: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  bankTransferNoteText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#92400e',
    lineHeight: 20,
  },
  bankTransferReminder: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#ff8c00',
  },
  bankTransferReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  bankTransferReminderTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ff8c00',
  },
  bankTransferReminderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    lineHeight: 20,
  },
  orderIdHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: '#ff8c00',
    fontSize: 15,
  },
});

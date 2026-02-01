import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { X, Star, ShoppingCart, Plus, Minus, MapPin } from 'lucide-react-native';
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
import { Product } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/cartEvents';
import ProductReviews from './ProductReviews';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

interface VendorInfo {
  business_name: string;
  city: string;
  state: string;
  rating: number;
}

interface ProductImage {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
}

export default function ProductDetailModal({
  visible,
  product,
  onClose,
}: ProductDetailModalProps) {
  const { profile } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(product);
  const flatListRef = useRef<FlatList>(null);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [fontsLoaded] = useFonts({
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  const fetchVendorInfo = async () => {
    if (!product) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('business_name, city, state, rating')
        .eq('user_id', product.vendor_id)
        .maybeSingle();

      if (error) throw error;
      setVendorInfo(data);
    } catch (error) {
      console.error('Error fetching vendor:', error);
    }
  };

  const fetchProductImages = async () => {
    if (!product) return;

    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');

      if (error) throw error;
      if (data && data.length > 0) {
        setImages(data);
      } else {
        setImages([{
          id: 'default',
          image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
          display_order: 0,
          is_primary: true,
        }]);
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
      setImages([{
        id: 'default',
        image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
        display_order: 0,
        is_primary: true,
      }]);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentImageIndex(index);

    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }

    if (images.length > 1) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          return nextIndex;
        });
      }, 3000);
    }
  };

  const addToCart = async () => {
    if (!profile || !product) return;

    try {
      setLoading(true);

      // Check if item already exists in cart
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingItem) {
        // Update existing item by adding to the quantity
        const { error } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Insert new item
        const { error } = await supabase
          .from('carts')
          .insert({
            user_id: profile.id,
            product_id: product.id,
            quantity: quantity,
          });

        if (error) throw error;
      }

      // Emit cart event to update badge
      cartEvents.emit();
      onClose();
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && product) {
      setCurrentProduct(product);
      setCurrentImageIndex(0);
      fetchVendorInfo();
      fetchProductImages();

      // Subscribe to real-time product updates for rating changes
      const subscription = supabase
        .channel(`product_${product.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'products',
            filter: `id=eq.${product.id}`,
          },
          (payload) => {
            setCurrentProduct(payload.new as Product);
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } else if (!visible) {
      setVendorInfo(null);
      setImages([]);
      setQuantity(1);
      setCurrentProduct(null);
    }
  }, [visible, product]);

  useEffect(() => {
    if (!visible || images.length <= 1) return;

    const startAutoPlay = () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentImageIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % images.length;
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
          return nextIndex;
        });
      }, 3000);
    };

    startAutoPlay();

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [visible, images.length]);

  if (!fontsLoaded || !currentProduct) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.imageContainer}>
              <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                )}
              />
              {images.length > 1 && (
                <View style={styles.pagination}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.paginationDot,
                        index === currentImageIndex && styles.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.imageOverlay}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <X size={20} color="#ffffff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.productHeader}>
                <View style={styles.productTitleRow}>
                  <Text style={styles.productName}>{currentProduct.name}</Text>
                  <View style={styles.stockBadge}>
                    <View style={styles.stockDot} />
                    <Text style={styles.stockText}>{String(currentProduct.stock_quantity)} left</Text>
                  </View>
                </View>

                <View style={styles.ratingRow}>
                  <View style={styles.ratingContainer}>
                    <Star size={16} color="#fbbf24" fill="#fbbf24" />
                    <Text style={styles.rating}>{(currentProduct.rating || 0).toFixed(1)}</Text>
                  </View>
                  <Text style={styles.reviewCount}>{String(currentProduct.total_reviews || 0)} reviews</Text>
                </View>
              </View>

              <View style={styles.priceSection}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>Price</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₦{(currentProduct.price || 0).toFixed(2)}</Text>
                    <Text style={styles.unit}>/ {currentProduct.unit}</Text>
                  </View>
                </View>
              </View>

              {currentProduct.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About this product</Text>
                  <Text style={styles.description}>{currentProduct.description}</Text>
                </View>
              )}

              {vendorInfo && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sold by</Text>
                  <View style={styles.vendorCard}>
                    <View style={styles.vendorHeader}>
                      <View style={styles.vendorAvatar}>
                        <Text style={styles.vendorAvatarText}>
                          {vendorInfo.business_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.vendorDetails}>
                        <Text style={styles.vendorName}>{vendorInfo.business_name}</Text>
                        <View style={styles.locationRow}>
                          <MapPin size={12} color="#6b7280" />
                          <Text style={styles.location}>
                            {vendorInfo.city}, {vendorInfo.state}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.vendorRatingBadge}>
                        <Star size={12} color="#fbbf24" fill="#fbbf24" />
                        <Text style={styles.vendorRatingText}>
                          {(vendorInfo.rating || 0).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Reviews</Text>
                <ProductReviews
                  productId={currentProduct.id}
                  averageRating={currentProduct.rating}
                  totalReviews={currentProduct.total_reviews}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity === 1 && styles.quantityButtonDisabled]}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity === 1}
                    >
                      <Minus size={18} color={quantity === 1 ? '#d1d5db' : '#6b7280'} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <View style={styles.quantityDisplay}>
                      <Text style={styles.quantity}>{String(quantity)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.quantityButton, quantity >= currentProduct.stock_quantity && styles.quantityButtonDisabled]}
                      onPress={() => setQuantity(Math.min(currentProduct.stock_quantity, quantity + 1))}
                      disabled={quantity >= currentProduct.stock_quantity}
                    >
                      <Plus size={18} color={quantity >= currentProduct.stock_quantity ? '#d1d5db' : '#6b7280'} strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subtotalContainer}>
                    <Text style={styles.subtotalLabel}>Subtotal</Text>
                    <Text style={styles.subtotalAmount}>
                      ₦{((currentProduct.price || 0) * quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.bottomSpacing} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.addButton, loading && styles.addButtonDisabled]}
              onPress={addToCart}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <ShoppingCart size={20} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.addButtonText}>Add to Cart</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 380,
    backgroundColor: '#f3f4f6',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: 380,
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#ffffff',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    padding: 10,
  },
  contentContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  productHeader: {
    marginBottom: 20,
  },
  productTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  productName: {
    flex: 1,
    fontSize: 26,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    lineHeight: 32,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff8c00',
  },
  stockText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#047857',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#92400e',
  },
  reviewCount: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6b7280',
  },
  priceSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  priceContainer: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 36,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ff8c00',
    letterSpacing: -1,
  },
  unit: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#4b5563',
    lineHeight: 24,
  },
  vendorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatarText: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#ffffff',
  },
  vendorDetails: {
    flex: 1,
    gap: 4,
  },
  vendorName: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6b7280',
  },
  vendorRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  vendorRatingText: {
    fontSize: 13,
    fontFamily: 'Poppins-Bold',
    color: '#92400e',
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityDisplay: {
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quantity: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
  },
  subtotalContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  subtotalLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtotalAmount: {
    fontSize: 24,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ff8c00',
    letterSpacing: -0.5,
  },
  bottomSpacing: {
    height: 24,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.5,
  },
});

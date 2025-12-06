import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Star, MapPin } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Product, Vendor } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { cartEvents } from '@/lib/cartEvents';
import ProductDetailModal from '@/components/ProductDetailModal';
import ProductCard from '@/components/ProductCard';
import CartIconWithBadge from '@/components/CartIconWithBadge';

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      fetchVendorAndProducts();
    }
  }, [id]);

  const fetchVendorAndProducts = async () => {
    try {
      setLoading(true);

      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (vendorError) throw vendorError;
      setVendor(vendorData);

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', id)
        .eq('is_available', true)
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching restaurant details:', error);
    } finally {
      setLoading(false);
    }
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeProductDetail = () => {
    setModalVisible(false);
    setSelectedProduct(null);
  };

  const addToCart = async (productId: string, e?: any) => {
    if (e) {
      e.stopPropagation();
    }
    if (!profile) return;

    try {
      const { data: existingItem } = await supabase
        .from('carts')
        .select('id, quantity')
        .eq('user_id', profile.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('carts')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('carts')
          .insert({
            user_id: profile.id,
            product_id: productId,
            quantity: 1,
          });

        if (error) throw error;
      }

      cartEvents.emit();
    } catch (error: any) {
      console.error('Error adding to cart:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Restaurant not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)/cart')} style={styles.cartButton}>
          <CartIconWithBadge size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.vendorHeader}>
          {vendor.logo_url ? (
            <Image source={{ uri: vendor.logo_url }} style={styles.vendorLogo} />
          ) : (
            <View style={[styles.vendorLogo, styles.vendorLogoPlaceholder]}>
              <Text style={styles.vendorLogoText}>{vendor.business_name[0]}</Text>
            </View>
          )}

          <Text style={styles.vendorName}>{vendor.business_name}</Text>

          {vendor.description && (
            <Text style={styles.vendorDescription}>{vendor.description}</Text>
          )}

          <View style={styles.vendorMeta}>
            <View style={styles.metaItem}>
              <Star size={16} color="#fbbf24" fill="#fbbf24" />
              <Text style={styles.metaText}>{vendor.rating.toFixed(1)}</Text>
            </View>

            {vendor.average_preparation_time && (
              <View style={styles.metaItem}>
                <Clock size={16} color="#64748b" />
                <Text style={styles.metaText}>{vendor.average_preparation_time} min</Text>
              </View>
            )}

            {vendor.address && (
              <View style={styles.metaItem}>
                <MapPin size={16} color="#64748b" />
                <Text style={styles.metaText}>{vendor.city}</Text>
              </View>
            )}
          </View>

          {vendor.cuisine_types && vendor.cuisine_types.length > 0 && (
            <View style={styles.cuisineContainer}>
              {vendor.cuisine_types.map((cuisine, index) => (
                <View key={index} style={styles.cuisineTag}>
                  <Text style={styles.cuisineText}>{cuisine}</Text>
                </View>
              ))}
            </View>
          )}

          {vendor.minimum_order && vendor.minimum_order > 0 && (
            <Text style={styles.minOrderText}>
              Minimum order: ${vendor.minimum_order.toFixed(2)}
            </Text>
          )}

          {!vendor.is_accepting_orders && (
            <View style={styles.closedBanner}>
              <Text style={styles.closedText}>Currently not accepting orders</Text>
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Menu</Text>

          {products.length === 0 ? (
            <Text style={styles.emptyText}>No menu items available</Text>
          ) : (
            <View style={styles.productsGrid}>
              {products.map((item, index) => (
                <View key={item.id} style={styles.productWrapper}>
                  <TouchableOpacity
                    style={styles.productItem}
                    onPress={() => openProductDetail(item)}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.productImage} />
                    ) : (
                      <View style={[styles.productImage, styles.productImagePlaceholder]}>
                        <Text style={styles.productImageText}>{item.name[0]}</Text>
                      </View>
                    )}

                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{item.name}</Text>

                      {item.description && (
                        <Text style={styles.productDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}

                      <View style={styles.productFooter}>
                        <View>
                          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                          {item.preparation_time && (
                            <View style={styles.prepTimeContainer}>
                              <Clock size={12} color="#64748b" />
                              <Text style={styles.prepTimeText}>{item.preparation_time} min</Text>
                            </View>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            addToCart(item.id, e);
                          }}
                        >
                          <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                      </View>

                      {item.rating > 0 && (
                        <View style={styles.ratingContainer}>
                          <Star size={12} color="#fbbf24" fill="#fbbf24" />
                          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                          {item.total_reviews > 0 && (
                            <Text style={styles.reviewCount}>({item.total_reviews})</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ProductDetailModal
        visible={modalVisible}
        product={selectedProduct}
        onClose={closeProductDetail}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
  },
  vendorHeader: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  vendorLogo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  vendorLogoPlaceholder: {
    backgroundColor: '#ff8c00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorLogoText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#ffffff',
  },
  vendorName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  vendorDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  vendorMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  cuisineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  cuisineTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  cuisineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff8c00',
  },
  minOrderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 8,
  },
  closedBanner: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  closedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
    textAlign: 'center',
  },
  menuSection: {
    padding: 20,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 40,
  },
  productsGrid: {
    gap: 16,
  },
  productWrapper: {
    marginBottom: 16,
  },
  productItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f1f5f9',
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  productImageText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#94a3b8',
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ff8c00',
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  prepTimeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  reviewCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Plus, Package, Edit, Trash2, Search, X, Filter, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Vendor } from '@/types/database';
import StoreSetup from '@/components/vendor/StoreSetup';
import AddProduct from '@/components/vendor/AddProduct';
import EditProduct from '@/components/vendor/EditProduct';

export default function VendorScreen() {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loadingVendorData, setLoadingVendorData] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'recent'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (profile) {
      checkSetupStatus();
    }
  }, [profile]);

  const checkSetupStatus = async () => {
    if (!profile) return;

    try {
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (vendorData) {
        const { data: settingsData } = await supabase
          .from('vendor_settings')
          .select('is_setup_complete')
          .eq('vendor_id', vendorData.id)
          .maybeSingle();

        if (settingsData?.is_setup_complete) {
          setIsSetupComplete(true);
          fetchVendorInfo();
          fetchProducts();
        }
      }
    } catch (error) {
      console.error('Error checking setup status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorInfo = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setVendor(data);
    } catch (error) {
      console.error('Error fetching vendor info:', error);
    }
  };

  const fetchProducts = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSetupComplete = async () => {
    setIsSetupComplete(true);
    setLoadingVendorData(true);
    await fetchVendorInfo();
    await fetchProducts();
    setLoadingVendorData(false);
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      console.log('Attempting to delete product:', productId);

      const { data: orderItems, error: orderCheckError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .limit(1);

      if (orderCheckError) {
        console.error('Error checking order items:', orderCheckError);
        throw orderCheckError;
      }

      if (orderItems && orderItems.length > 0) {
        console.log('Product has order items, cannot delete');
        Alert.alert(
          'Cannot Delete Product',
          'This product cannot be deleted because it has been included in customer orders. You can mark it as inactive instead.',
          [{ text: 'OK' }]
        );
        return;
      }

      const { count: cartCount } = await supabase
        .from('carts')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId);

      const warningMessage = cartCount && cartCount > 0
        ? `This product is in ${cartCount} customer cart(s). Deleting it will remove it from their carts. Are you sure?`
        : 'Are you sure you want to delete this product? This action cannot be undone.';

      console.log('About to show delete confirmation alert for product:', productId);
      console.log('Cart count:', cartCount);
      console.log('Warning message:', warningMessage);

      Alert.alert(
        'Delete Product',
        warningMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => console.log('Delete cancelled by user'),
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              console.log('DELETE BUTTON PRESSED - Starting deletion process...');
              try {
                console.log('Inside try block for product:', productId);

                console.log('Deleting product images...');
                const { error: imagesError } = await supabase
                  .from('product_images')
                  .delete()
                  .eq('product_id', productId);

                if (imagesError) {
                  console.error('Error deleting product images:', imagesError);
                }

                console.log('Deleting product...');
                const { data: deleteData, error: deleteError } = await supabase
                  .from('products')
                  .delete()
                  .eq('id', productId);

                console.log('Delete response data:', deleteData);
                console.log('Delete response error:', deleteError);

                if (deleteError) {
                  console.error('Full delete error details:', JSON.stringify(deleteError, null, 2));
                  console.error('Error code:', deleteError.code);
                  console.error('Error message:', deleteError.message);
                  console.error('Error details:', deleteError.details);
                  console.error('Error hint:', deleteError.hint);
                  throw deleteError;
                }

                console.log('Product deleted successfully');
                Alert.alert('Success', 'Product deleted successfully');
                fetchProducts();
              } catch (error: any) {
                console.error('Error in deletion process:', error);
                Alert.alert('Error', error.message || 'Failed to delete product');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error checking product dependencies:', error);
      Alert.alert('Error', error.message || 'Failed to check product dependencies');
    }
  };

  if (loading || loadingVendorData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!isSetupComplete) {
    return <StoreSetup onComplete={handleSetupComplete} />;
  }

  if (showAddProduct) {
    return (
      <AddProduct
        onBack={() => setShowAddProduct(false)}
        onSuccess={() => {
          setShowAddProduct(false);
          fetchProducts();
        }}
      />
    );
  }

  if (editingProduct) {
    return (
      <EditProduct
        product={editingProduct}
        onBack={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null);
          fetchProducts();
        }}
      />
    );
  }

  if (!vendor) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Store</Text>
          <Text style={styles.subtitle}>Loading...</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Package size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>Loading store information...</Text>
        </View>
      </View>
    );
  }

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.price.toString().includes(searchQuery);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && product.is_available) ||
        (filterStatus === 'inactive' && !product.is_available);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.price - b.price;
        case 'stock':
          return b.stock_quantity - a.stock_quantity;
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{vendor.business_name}</Text>
        <Text style={styles.subtitle}>{products.length} Products</Text>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddProduct(true)}
      >
        <Plus size={20} color="#ffffff" />
        <Text style={styles.addButtonText}>Add New Product</Text>
      </TouchableOpacity>

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Search by name, description, or price..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
            blurOnSubmit={true}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color="#ff8c00" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterStatus === 'all' && styles.filterChipActive,
                ]}
                onPress={() => setFilterStatus('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterStatus === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All ({products.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterStatus === 'active' && styles.filterChipActive,
                ]}
                onPress={() => setFilterStatus('active')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterStatus === 'active' && styles.filterChipTextActive,
                  ]}
                >
                  Active ({products.filter(p => p.is_available).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  filterStatus === 'inactive' && styles.filterChipActive,
                ]}
                onPress={() => setFilterStatus('inactive')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterStatus === 'inactive' && styles.filterChipTextActive,
                  ]}
                >
                  Inactive ({products.filter(p => !p.is_available).length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  sortBy === 'recent' && styles.filterChipActive,
                ]}
                onPress={() => setSortBy('recent')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortBy === 'recent' && styles.filterChipTextActive,
                  ]}
                >
                  Recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  sortBy === 'name' && styles.filterChipActive,
                ]}
                onPress={() => setSortBy('name')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortBy === 'name' && styles.filterChipTextActive,
                  ]}
                >
                  Name
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  sortBy === 'price' && styles.filterChipActive,
                ]}
                onPress={() => setSortBy('price')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortBy === 'price' && styles.filterChipTextActive,
                  ]}
                >
                  Price
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  sortBy === 'stock' && styles.filterChipActive,
                ]}
                onPress={() => setSortBy('stock')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortBy === 'stock' && styles.filterChipTextActive,
                  ]}
                >
                  Stock
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {(searchQuery.length > 0 || filterStatus !== 'all' || sortBy !== 'recent') && (
        <View style={styles.searchResults}>
          <Text style={styles.searchResultsText}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}
            {searchQuery && ` for "${searchQuery}"`}
          </Text>
          {(filterStatus !== 'all' || sortBy !== 'recent') && (
            <TouchableOpacity
              onPress={() => {
                setFilterStatus('all');
                setSortBy('recent');
                setSearchQuery('');
              }}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Package size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>
              {searchQuery.length > 0
                ? `No products found matching "${searchQuery}"`
                : 'No products yet. Add your first product!'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
            <View style={styles.productCard}>
              <Image
                source={{
                  uri: item.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
                }}
                style={styles.productImage}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>₦{item.price.toFixed(2)}</Text>
                <View style={styles.stockInfo}>
                  <Text
                    style={[
                      styles.stockText,
                      item.stock_quantity > 10 ? styles.inStock : styles.lowStock,
                    ]}
                  >
                    {item.stock_quantity} in stock
                  </Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      item.is_available ? styles.available : styles.unavailable,
                    ]}
                  >
                    {item.is_available ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setEditingProduct(item)}
                >
                  <Edit size={20} color="#ff8c00" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteProduct(item.id)}
                >
                  <Trash2 size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ff8c00',
    padding: 20,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#d1fae5',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
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
  filterButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filtersPanel: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  filterChipActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  searchResults: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchResultsText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  resetButtonText: {
    fontSize: 13,
    color: '#ff8c00',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff8c00',
  },
  stockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inStock: {
    color: '#ff8c00',
  },
  lowStock: {
    color: '#f59e0b',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  available: {
    backgroundColor: '#ffe8cc',
    color: '#cc7000',
  },
  unavailable: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  actions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
});

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Star, ShoppingCart, Clock } from 'lucide-react-native';
import { Product, ProductImage } from '@/types/database';
import { supabase } from '@/lib/supabase';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart: (e: any) => void;
}

export default function ProductCard({ product, onPress, onAddToCart }: ProductCardProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchProductImages();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (images.length > 1) {
      startAutoSlide();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [images]);

  const fetchProductImages = async () => {
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order');

      if (error) {
        console.error('Error fetching product images:', error);
        return;
      }
      if (data && data.length > 0) {
        setImages(data);
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
    }
  };

  const startAutoSlide = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 2000);
  };

  const displayImages = images.length > 0 ? images : [{
    id: 'default',
    image_url: product.image_url || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
    display_order: 0,
    is_primary: true,
    product_id: product.id,
    created_at: ''
  }];

  const isValidImageUrl = (url: string) => {
    if (!url) return false;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    if (url.includes('supabase.co/storage')) {
      return true;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasValidExtension = validExtensions.some(ext =>
      url.toLowerCase().includes(ext)
    );
    return hasValidExtension;
  };

  const currentImageUrl = displayImages[currentImageIndex]?.image_url;
  const isValidUrl = isValidImageUrl(currentImageUrl);

  if (!isValidUrl) {
    console.warn(`Invalid image URL for ${product.name}:`, currentImageUrl);
  }

  return (
    <View style={styles.productCard}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <View style={styles.imageContainer}>
          {imageError || !isValidUrl ? (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderText}>Invalid Image URL</Text>
              <Text style={styles.placeholderSubtext}>Please use direct image links</Text>
            </View>
          ) : (
            <Image
              source={{ uri: currentImageUrl }}
              style={styles.productImage}
              onError={(e) => {
                console.error('Image load error:', e.nativeEvent.error);
                setImageError(true);
              }}
            />
          )}

          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentImageIndex === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.metaContainer}>
            <View style={styles.ratingContainer}>
              <Star size={14} color="#fbbf24" fill="#fbbf24" />
              <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
            </View>
            {product.preparation_time && (
              <View style={styles.prepTimeContainer}>
                <Clock size={12} color="#64748b" />
                <Text style={styles.prepTime}>{product.preparation_time} min</Text>
              </View>
            )}
          </View>
          <View style={styles.productFooter}>
            <View>
              <Text style={styles.price}>₦{product.price.toFixed(2)}</Text>
              <Text style={styles.unit}>per {product.unit}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddToCart}
            >
              <ShoppingCart size={18} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 6,
    overflow: 'hidden',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  imageSlider: {
    flexDirection: 'row',
    width: '100%',
    height: 180,
  },
  productImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e2e8f0',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  placeholderSubtext: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  productInfo: {
    padding: 14,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    height: 38,
    letterSpacing: 0.2,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rating: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 4,
    fontWeight: '700',
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  prepTime: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ff8c00',
    letterSpacing: 0.3,
  },
  unit: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
});

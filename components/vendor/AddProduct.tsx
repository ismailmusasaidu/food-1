import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface ImageItem {
  id: string;
  uri: string;
  isUrl: boolean;
  isPrimary: boolean;
}

interface AddProductProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function AddProduct({ onBack, onSuccess }: AddProductProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    price: '',
    unit: 'serving',
    stock_quantity: '',
    preparation_time: '15',
  });

  useEffect(() => {
    fetchCategories();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera roll permissions are required to upload images.');
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, category_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        const newImages: ImageItem[] = result.assets.map((asset) => ({
          id: Math.random().toString(36).substr(2, 9),
          uri: asset.uri,
          isUrl: false,
          isPrimary: images.length === 0,
        }));
        setImages([...images, ...newImages]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const addImageFromUrl = () => {
    const url = imageUrl.trim();

    if (!url) {
      Alert.alert('Error', 'Please enter a valid image URL');
      return;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const hasValidExtension = validExtensions.some(ext =>
      url.toLowerCase().includes(ext)
    );

    if (!hasValidExtension) {
      Alert.alert(
        'Invalid Image URL',
        'Please use a direct image URL ending with .jpg, .png, .jpeg, etc.\n\nExample from Pexels:\nhttps://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg\n\nNote: Do not use webpage URLs from Pixabay, Google Photos, or image hosting pages.'
      );
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'Image URL must start with http:// or https://');
      return;
    }

    const newImage: ImageItem = {
      id: Math.random().toString(36).substr(2, 9),
      uri: url,
      isUrl: true,
      isPrimary: images.length === 0,
    };

    setImages([...images, newImage]);
    setImageUrl('');
    setShowUrlInput(false);
  };

  const removeImage = (id: string) => {
    const filteredImages = images.filter((img) => img.id !== id);
    if (filteredImages.length > 0 && images.find((img) => img.id === id)?.isPrimary) {
      filteredImages[0].isPrimary = true;
    }
    setImages(filteredImages);
  };

  const setPrimaryImage = (id: string) => {
    setImages(
      images.map((img) => ({
        ...img,
        isPrimary: img.id === id,
      }))
    );
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter menu item name');
      return false;
    }
    if (!formData.category_id) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
      Alert.alert('Error', 'Please enter a valid stock quantity');
      return false;
    }
    if (!formData.preparation_time || parseInt(formData.preparation_time) <= 0) {
      Alert.alert('Error', 'Please enter a valid preparation time');
      return false;
    }
    return true;
  };

  const uploadImageToStorage = async (uri: string, productId: string, index: number): Promise<string | null> => {
    try {
      let fileData: Blob | ArrayBuffer;
      let contentType = 'image/jpeg';
      let fileExt = 'jpg';

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileData = blob;
        contentType = blob.type || 'image/jpeg';

        if (blob.type) {
          const mimeToExt: { [key: string]: string } = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
          };
          fileExt = mimeToExt[blob.type] || 'jpg';
        }
      } else {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = arrayBuffer;

        if (uri.toLowerCase().includes('.png')) {
          contentType = 'image/png';
          fileExt = 'png';
        } else if (uri.toLowerCase().includes('.gif')) {
          contentType = 'image/gif';
          fileExt = 'gif';
        } else if (uri.toLowerCase().includes('.webp')) {
          contentType = 'image/webp';
          fileExt = 'webp';
        }
      }

      const fileName = `${productId}_${index}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, fileData, {
          contentType: contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        if (uploadError.message.includes('Bucket not found')) {
          Alert.alert(
            'Storage Setup Required',
            'Please create a storage bucket named "product-images" in your Supabase dashboard first. For now, use "Add image URL" button with web image URLs like those from Pexels.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Upload Error', uploadError.message);
        }
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      console.log('Uploaded image URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Error', 'Failed to upload image. Please try again.');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!profile) return;

    try {
      setLoading(true);

      // vendor_id in products table references profiles.id, not vendors.id
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          vendor_id: profile.id,
          category_id: formData.category_id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          image_url: null,
          price: parseFloat(formData.price),
          unit: formData.unit,
          stock_quantity: parseInt(formData.stock_quantity),
          preparation_time: parseInt(formData.preparation_time),
          is_available: true,
          is_available_now: true,
          is_featured: false,
        })
        .select()
        .single();

      if (productError) throw productError;

      if (images.length > 0) {
        const uploadedImages = await Promise.all(
          images.map(async (img, index) => {
            let finalUrl: string | null = null;

            if (img.isUrl) {
              finalUrl = img.uri;
            } else {
              finalUrl = await uploadImageToStorage(img.uri, product.id, index);
            }

            return finalUrl ? {
              product_id: product.id,
              image_url: finalUrl,
              display_order: index,
              is_primary: img.isPrimary,
            } : null;
          })
        );

        const validImages = uploadedImages.filter((img): img is NonNullable<typeof img> => img !== null);

        if (validImages.length === 0) {
          await supabase.from('products').delete().eq('id', product.id);
          Alert.alert(
            'Upload Failed',
            'Failed to upload images. Please use "Add image URL" with web image URLs instead.'
          );
          return;
        }

        const { error: imagesError } = await supabase
          .from('product_images')
          .insert(validImages);

        if (imagesError) throw imagesError;

        const primaryImage = validImages.find((img) => img.is_primary);
        if (primaryImage) {
          await supabase
            .from('products')
            .update({ image_url: primaryImage.image_url })
            .eq('id', product.id);
        }
      }

      Alert.alert('Success', 'Menu item added successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Menu Item</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Item Images</Text>
          <Text style={styles.sectionSubtitle}>
            Add up to multiple images. First image will be the primary image.
          </Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Use direct image URLs from Pexels or other sources. URLs must end with .jpg, .png, .jpeg, etc.
            </Text>
            <Text style={styles.infoExample}>
              Example: https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg
            </Text>
          </View>

          <View style={styles.imagesGrid}>
            {images.map((image, index) => (
              <View key={image.id} style={styles.imageCard}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                {image.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(image.id)}
                >
                  <X size={16} color="#ffffff" />
                </TouchableOpacity>
                {!image.isPrimary && (
                  <TouchableOpacity
                    style={styles.setPrimaryButton}
                    onPress={() => setPrimaryImage(image.id)}
                  >
                    <Text style={styles.setPrimaryText}>Set as primary</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
              <Upload size={24} color="#ff8c00" />
              <Text style={styles.addImageText}>Upload from device</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addImageButton}
              onPress={() => setShowUrlInput(true)}
            >
              <LinkIcon size={24} color="#ff8c00" />
              <Text style={styles.addImageText}>Add image URL</Text>
            </TouchableOpacity>
          </View>

          {showUrlInput && (
            <View style={styles.urlInputContainer}>
              <TextInput
                style={styles.urlInput}
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.addUrlButton} onPress={addImageFromUrl}>
                <Plus size={20} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelUrlButton}
                onPress={() => {
                  setShowUrlInput(false);
                  setImageUrl('');
                }}
              >
                <X size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Item Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Margherita Pizza"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your dish..."
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryGrid}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    formData.category_id === category.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setFormData({ ...formData, category_id: category.id })}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      formData.category_id === category.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Price *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Unit *</Text>
              <TextInput
                style={styles.input}
                placeholder="serving, piece"
                value={formData.unit}
                onChangeText={(text) => setFormData({ ...formData, unit: text })}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Stock Quantity *</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                value={formData.stock_quantity}
                onChangeText={(text) => setFormData({ ...formData, stock_quantity: text })}
                keyboardType="number-pad"
              />
            </View>

            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Prep Time (min) *</Text>
              <TextInput
                style={styles.input}
                placeholder="15"
                value={formData.preparation_time}
                onChangeText={(text) => setFormData({ ...formData, preparation_time: text })}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.submitButtonText}>Add Menu Item</Text>
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
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f3f4f6',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#ff8c00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 4,
  },
  setPrimaryButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
  },
  setPrimaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ff8c00',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff8c00',
    textAlign: 'center',
  },
  urlInputContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addUrlButton: {
    width: 44,
    height: 44,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelUrlButton: {
    width: 44,
    height: 44,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
    borderWidth: 2.5,
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#ff8c00',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryChipTextActive: {
    color: '#047857',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  infoText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
    marginBottom: 6,
  },
  infoExample: {
    fontSize: 11,
    color: '#78350f',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  bottomSpacing: {
    height: 24,
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#ff8c00',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});

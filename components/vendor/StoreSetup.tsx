import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  Store,
  MapPin,
  DollarSign,
  Clock,
  CreditCard,
  Check,
  ArrowRight,
  ChefHat,
  Utensils,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface StoreSetupProps {
  onComplete: () => void;
}

const CUISINE_OPTIONS = [
  'Italian',
  'Chinese',
  'Japanese',
  'Mexican',
  'Indian',
  'Thai',
  'American',
  'Mediterranean',
  'Fast Food',
  'BBQ',
  'Seafood',
  'Vegetarian',
  'Pizza',
  'Burgers',
  'Sushi',
  'Other',
];

export default function StoreSetup({ onComplete }: StoreSetupProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [storeData, setStoreData] = useState({
    businessName: profile?.business_name || '',
    description: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    cuisineTypes: [] as string[],
  });

  const [settingsData, setSettingsData] = useState({
    deliveryRadius: '5',
    averagePreparationTime: '30',
    openingTime: '09:00',
    closingTime: '22:00',
  });

  const totalSteps = 3;

  const handleStoreInfoSubmit = () => {
    if (!storeData.businessName || !storeData.address || storeData.cuisineTypes.length === 0) {
      setError('Please fill in all required fields and select at least one cuisine type');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSettingsSubmit = () => {
    if (!settingsData.deliveryRadius || !settingsData.averagePreparationTime) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep(3);
  };

  const toggleCuisineType = (cuisine: string) => {
    setStoreData(prev => ({
      ...prev,
      cuisineTypes: prev.cuisineTypes.includes(cuisine)
        ? prev.cuisineTypes.filter(c => c !== cuisine)
        : [...prev.cuisineTypes, cuisine]
    }));
  };

  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const operatingHours = {
        monday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        tuesday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        wednesday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        thursday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        friday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        saturday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
        sunday: { open: settingsData.openingTime, close: settingsData.closingTime, closed: false },
      };

      const { data: vendorData, error: vendorCheckError } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (vendorData?.id) {
        // Update existing vendor
        const { error: updateError } = await supabase
          .from('vendors')
          .update({
            business_name: storeData.businessName,
            description: storeData.description,
            address: storeData.address,
            city: storeData.city,
            state: storeData.state,
            postal_code: storeData.postalCode,
            cuisine_types: storeData.cuisineTypes,
            operating_hours: operatingHours,
            average_preparation_time: parseInt(settingsData.averagePreparationTime),
            delivery_radius: parseFloat(settingsData.deliveryRadius),
            updated_at: new Date().toISOString(),
          })
          .eq('id', vendorData.id);

        if (updateError) throw updateError;
      } else {
        // Create new vendor
        const { error: insertError } = await supabase
          .from('vendors')
          .insert({
            user_id: profile?.id,
            business_name: storeData.businessName,
            description: storeData.description,
            address: storeData.address,
            city: storeData.city,
            state: storeData.state,
            postal_code: storeData.postalCode,
            cuisine_types: storeData.cuisineTypes,
            operating_hours: operatingHours,
            average_preparation_time: parseInt(settingsData.averagePreparationTime),
            delivery_radius: parseFloat(settingsData.deliveryRadius),
            is_verified: true,
            is_active: true,
          });

        if (insertError) throw insertError;
      }

      onComplete();
    } catch (err: any) {
      console.error('Error setting up restaurant:', err);
      setError(err.message || 'Failed to setup restaurant');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              step >= s && styles.stepCircleActive,
              step > s && styles.stepCircleComplete,
            ]}
          >
            {step > s ? (
              <Check size={16} color="#ffffff" />
            ) : (
              <Text
                style={[styles.stepNumber, step >= s && styles.stepNumberActive]}
              >
                {s}
              </Text>
            )}
          </View>
          {s < 3 && (
            <View
              style={[styles.stepLine, step > s && styles.stepLineActive]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <ChefHat size={48} color="#ff8c00" />
      </View>
      <Text style={styles.stepTitle}>Restaurant Information</Text>
      <Text style={styles.stepDescription}>
        Tell us about your restaurant
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Restaurant Name *</Text>
        <TextInput
          style={styles.input}
          value={storeData.businessName}
          onChangeText={(text) =>
            setStoreData({ ...storeData, businessName: text })
          }
          placeholder="Enter your restaurant name"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={storeData.description}
          onChangeText={(text) =>
            setStoreData({ ...storeData, description: text })
          }
          placeholder="Describe your restaurant and cuisine"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Cuisine Types * (Select at least one)</Text>
        <View style={styles.cuisineGrid}>
          {CUISINE_OPTIONS.map((cuisine) => (
            <TouchableOpacity
              key={cuisine}
              style={[
                styles.cuisineChip,
                storeData.cuisineTypes.includes(cuisine) && styles.cuisineChipSelected
              ]}
              onPress={() => toggleCuisineType(cuisine)}
            >
              <Text style={[
                styles.cuisineChipText,
                storeData.cuisineTypes.includes(cuisine) && styles.cuisineChipTextSelected
              ]}>
                {cuisine}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Restaurant Address *</Text>
        <TextInput
          style={styles.input}
          value={storeData.address}
          onChangeText={(text) =>
            setStoreData({ ...storeData, address: text })
          }
          placeholder="Street address"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            value={storeData.city}
            onChangeText={(text) =>
              setStoreData({ ...storeData, city: text })
            }
            placeholder="City"
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            value={storeData.state}
            onChangeText={(text) =>
              setStoreData({ ...storeData, state: text })
            }
            placeholder="State"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Postal Code</Text>
        <TextInput
          style={styles.input}
          value={storeData.postalCode}
          onChangeText={(text) =>
            setStoreData({ ...storeData, postalCode: text })
          }
          placeholder="Postal code"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={styles.nextButton}
        onPress={handleStoreInfoSubmit}
      >
        <Text style={styles.nextButtonText}>Continue</Text>
        <ArrowRight size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Clock size={48} color="#ff8c00" />
      </View>
      <Text style={styles.stepTitle}>Operating Hours & Delivery</Text>
      <Text style={styles.stepDescription}>
        Configure your operating hours and delivery settings
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Operating Hours</Text>
        <View style={styles.row}>
          <View style={[styles.flex1, { marginRight: 8 }]}>
            <Text style={styles.subLabel}>Opening Time</Text>
            <TextInput
              style={styles.input}
              value={settingsData.openingTime}
              onChangeText={(text) =>
                setSettingsData({ ...settingsData, openingTime: text })
              }
              placeholder="09:00"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.subLabel}>Closing Time</Text>
            <TextInput
              style={styles.input}
              value={settingsData.closingTime}
              onChangeText={(text) =>
                setSettingsData({ ...settingsData, closingTime: text })
              }
              placeholder="22:00"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
        <Text style={styles.helperText}>
          These hours will apply to all days. You can customize individual days later.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Average Preparation Time (minutes) *</Text>
        <TextInput
          style={styles.input}
          value={settingsData.averagePreparationTime}
          onChangeText={(text) =>
            setSettingsData({ ...settingsData, averagePreparationTime: text })
          }
          placeholder="30"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
        />
        <Text style={styles.helperText}>
          How long does it typically take to prepare an order?
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Delivery Radius (km) *</Text>
        <TextInput
          style={styles.input}
          value={settingsData.deliveryRadius}
          onChangeText={(text) =>
            setSettingsData({ ...settingsData, deliveryRadius: text })
          }
          placeholder="5"
          placeholderTextColor="#9ca3af"
          keyboardType="decimal-pad"
        />
        <Text style={styles.helperText}>
          Maximum distance you're willing to deliver
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(1)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleSettingsSubmit}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
          <ArrowRight size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Check size={48} color="#ff8c00" />
      </View>
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepDescription}>
        Review your information before submitting
      </Text>

      <View style={styles.summarySection}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Restaurant Name</Text>
          <Text style={styles.summaryValue}>{storeData.businessName}</Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Cuisine Types</Text>
          <Text style={styles.summaryValue}>
            {storeData.cuisineTypes.join(', ')}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Address</Text>
          <Text style={styles.summaryValue}>
            {storeData.address}
            {storeData.city && `, ${storeData.city}`}
            {storeData.state && `, ${storeData.state}`}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Operating Hours</Text>
          <Text style={styles.summaryValue}>
            {settingsData.openingTime} - {settingsData.closingTime}
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Avg. Preparation Time</Text>
          <Text style={styles.summaryValue}>
            {settingsData.averagePreparationTime} minutes
          </Text>
        </View>

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Delivery Radius</Text>
          <Text style={styles.summaryValue}>
            {settingsData.deliveryRadius} km
          </Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Your restaurant will be immediately available to customers once you complete setup.
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(2)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.completeButton, loading && styles.buttonDisabled]}
          onPress={handleFinalSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Check size={20} color="#ffffff" />
              <Text style={styles.completeButtonText}>Complete Setup</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Get Started</Text>
        <Text style={styles.subtitle}>
          Step {step} of {totalSteps}
        </Text>
      </View>

      {renderStepIndicator()}

      <View style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ff8c00',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 32,
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
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#ff8c00',
  },
  stepCircleComplete: {
    backgroundColor: '#059669',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#ff8c00',
  },
  content: {
    padding: 20,
  },
  stepContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
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
  subLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#ff8c00',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  cuisineChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  cuisineChipSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  cuisineChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  cuisineChipTextSelected: {
    color: '#ff8c00',
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 6,
    fontStyle: 'italic',
  },
  summarySection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

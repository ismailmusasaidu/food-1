import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Upload, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function RiderRegisterScreen() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    nin: '',
    bikeMake: '',
    bikeModel: '',
    bikeYear: '',
    bikePlateNumber: '',
    bikeColor: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: '',
    nextOfKinAddress: '',
  });

  const [passportPhoto, setPassportPhoto] = useState<string | null>(null);
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null);

  const pickImage = async (type: 'passport' | 'license') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImagePickerAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'passport') {
        setPassportPhoto(result.assets[0].uri);
      } else {
        setLicensePhoto(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async (type: 'passport' | 'license') => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (type === 'passport') {
        setPassportPhoto(result.assets[0].uri);
      } else {
        setLicensePhoto(result.assets[0].uri);
      }
    }
  };

  const uploadImageToStorage = async (imageUri: string, fileName: string): Promise<string | null> => {
    try {
      let fileToUpload: Blob | File;

      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        fileToUpload = blob;
      } else {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        fileToUpload = blob;
      }

      const { data, error } = await supabase.storage
        .from('rider-documents')
        .upload(fileName, fileToUpload, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Upload failed:', error);
        throw new Error(error.message);
      }

      const { data: urlData } = supabase.storage
        .from('rider-documents')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    if (!profile) return;

    if (!formData.fullName || !formData.phone || !formData.nin || !formData.bikePlateNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!passportPhoto) {
      Alert.alert('Error', 'Please upload your passport photo');
      return;
    }

    try {
      setLoading(true);

      const { data: existingRider } = await supabase
        .from('riders')
        .select('status')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingRider) {
        if (existingRider.status === 'approved') {
          Alert.alert('Already Registered', 'You are already registered as a rider');
          router.replace('/(tabs)');
          return;
        } else if (existingRider.status === 'pending') {
          Alert.alert('Application Pending', 'Your rider application is already pending approval');
          router.replace('/auth/rider-pending');
          return;
        }
      }

      let passportUrl = null;
      let licenseUrl = null;

      if (passportPhoto) {
        const passportPath = `${profile.id}/passport_${Date.now()}.jpg`;
        passportUrl = await uploadImageToStorage(passportPhoto, passportPath);
      }

      if (licensePhoto) {
        const licensePath = `${profile.id}/license_${Date.now()}.jpg`;
        licenseUrl = await uploadImageToStorage(licensePhoto, licensePath);
      }

      const riderData = {
        user_id: profile.id,
        full_name: formData.fullName,
        phone: formData.phone,
        nin: formData.nin,
        motorbike_details: {
          make: formData.bikeMake,
          model: formData.bikeModel,
          year: formData.bikeYear ? parseInt(formData.bikeYear) : null,
          plate_number: formData.bikePlateNumber,
          color: formData.bikeColor,
        },
        next_of_kin: {
          name: formData.nextOfKinName,
          phone: formData.nextOfKinPhone,
          relationship: formData.nextOfKinRelationship,
          address: formData.nextOfKinAddress,
        },
        passport_photo_url: passportUrl,
        license_url: licenseUrl,
        status: 'pending',
      };

      if (existingRider && existingRider.status === 'rejected') {
        const { error: updateError } = await supabase
          .from('riders')
          .update(riderData)
          .eq('user_id', profile.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('riders').insert(riderData);

        if (insertError) throw insertError;
      }

      await supabase
        .from('profiles')
        .update({ role: 'rider' })
        .eq('id', profile.id);

      Alert.alert(
        'Success',
        'Your rider application has been submitted! Please wait for admin approval.',
        [{ text: 'OK', onPress: () => router.replace('/auth/rider-pending') }]
      );
    } catch (error: any) {
      console.error('Submission error:', error);
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Personal Information</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.fullName}
          onChangeText={(text) => setFormData({ ...formData, fullName: text })}
          placeholder="Enter your full name"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="Enter your phone number"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>NIN (National Identification Number) *</Text>
        <TextInput
          style={styles.input}
          value={formData.nin}
          onChangeText={(text) => setFormData({ ...formData, nin: text })}
          placeholder="Enter your NIN"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Passport Photo *</Text>
        <View style={styles.imageActions}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={() => pickImage('passport')}
          >
            <Upload size={20} color="#ff8c00" />
            <Text style={styles.imageButtonText}>Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={() => takePhoto('passport')}
          >
            <Camera size={20} color="#ff8c00" />
            <Text style={styles.imageButtonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
        {passportPhoto && (
          <Text style={styles.uploadedText}>Photo uploaded</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => setCurrentStep(2)}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Motorbike Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Make</Text>
        <TextInput
          style={styles.input}
          value={formData.bikeMake}
          onChangeText={(text) => setFormData({ ...formData, bikeMake: text })}
          placeholder="e.g., Honda, Yamaha"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Model</Text>
        <TextInput
          style={styles.input}
          value={formData.bikeModel}
          onChangeText={(text) => setFormData({ ...formData, bikeModel: text })}
          placeholder="e.g., CG 125"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Year</Text>
        <TextInput
          style={styles.input}
          value={formData.bikeYear}
          onChangeText={(text) => setFormData({ ...formData, bikeYear: text })}
          placeholder="e.g., 2020"
          placeholderTextColor="#94a3b8"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Plate Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.bikePlateNumber}
          onChangeText={(text) => setFormData({ ...formData, bikePlateNumber: text })}
          placeholder="Enter plate number"
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Color</Text>
        <TextInput
          style={styles.input}
          value={formData.bikeColor}
          onChangeText={(text) => setFormData({ ...formData, bikeColor: text })}
          placeholder="e.g., Black"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Riding License (Optional)</Text>
        <View style={styles.imageActions}>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={() => pickImage('license')}
          >
            <Upload size={20} color="#ff8c00" />
            <Text style={styles.imageButtonText}>Upload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={() => takePhoto('license')}
          >
            <Camera size={20} color="#ff8c00" />
            <Text style={styles.imageButtonText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
        {licensePhoto && (
          <Text style={styles.uploadedText}>License uploaded</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(1)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={() => setCurrentStep(3)}
        >
          <Text style={styles.nextButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Next of Kin</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.nextOfKinName}
          onChangeText={(text) => setFormData({ ...formData, nextOfKinName: text })}
          placeholder="Enter next of kin name"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.nextOfKinPhone}
          onChangeText={(text) => setFormData({ ...formData, nextOfKinPhone: text })}
          placeholder="Enter phone number"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Relationship</Text>
        <TextInput
          style={styles.input}
          value={formData.nextOfKinRelationship}
          onChangeText={(text) => setFormData({ ...formData, nextOfKinRelationship: text })}
          placeholder="e.g., Brother, Sister, Friend"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.nextOfKinAddress}
          onChangeText={(text) => setFormData({ ...formData, nextOfKinAddress: text })}
          placeholder="Enter address"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(2)}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Application</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Rider Registration</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of 3</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progress, { width: `${(currentStep / 3) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
  },
  progress: {
    height: 4,
    backgroundColor: '#10b981',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff8c00',
  },
  uploadedText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 80,
  },
});

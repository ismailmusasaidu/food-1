import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Mail, Phone, LogOut, Shield, Edit, Save, X, Store, MapPin, FileText } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Vendor } from '@/types/database';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vendorData, setVendorData] = useState<Vendor | null>(null);
  const [loadingVendor, setLoadingVendor] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setBusinessPhone(profile.business_phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role === 'vendor') {
      fetchVendorData();
    } else {
      setLoadingVendor(false);
    }
  }, [profile]);

  useEffect(() => {
    if (vendorData) {
      setBusinessName(vendorData.business_name || '');
      setBusinessDescription(vendorData.description || '');
      setBusinessAddress(vendorData.address || '');
    }
  }, [vendorData]);

  const fetchVendorData = async () => {
    if (!profile) return;

    try {
      setLoadingVendor(true);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setVendorData(data);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
    } finally {
      setLoadingVendor(false);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (!confirmed) return;
    }

    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSave = async () => {
    if (!profile) {
      console.error('No profile found');
      return;
    }

    if (!fullName.trim()) {
      if (Platform.OS === 'web') {
        alert('Full name is required');
      }
      return;
    }

    if (!email.trim()) {
      if (Platform.OS === 'web') {
        alert('Email is required');
      }
      return;
    }

    if (profile.role === 'vendor' && !businessName.trim()) {
      if (Platform.OS === 'web') {
        alert('Business name is required for vendors');
      }
      return;
    }

    setIsSaving(true);
    try {
      const emailChanged = email.trim() !== profile.email;

      if (emailChanged) {
        console.log('Updating email...');
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim(),
        });

        if (authError) {
          console.error('Auth update error:', authError);
          throw authError;
        }
      }

      const updates: any = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (profile.role === 'vendor') {
        updates.business_phone = businessPhone.trim() || null;

        if (vendorData) {
          console.log('Updating vendor data:', {
            business_name: businessName.trim(),
            description: businessDescription.trim() || null,
            address: businessAddress.trim() || '',
          });

          const { error: vendorError } = await supabase
            .from('vendors')
            .update({
              business_name: businessName.trim(),
              description: businessDescription.trim() || null,
              address: businessAddress.trim() || '',
              updated_at: new Date().toISOString(),
            })
            .eq('id', vendorData.id);

          if (vendorError) {
            console.error('Vendor update error:', vendorError);
            throw vendorError;
          }
          console.log('Vendor data updated successfully');
        }
      }

      console.log('Updating profile:', updates);
      const { data: updatedData, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select();

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }
      console.log('Profile updated successfully:', updatedData);

      console.log('Refreshing profile...');
      await refreshProfile();

      if (profile.role === 'vendor') {
        console.log('Refreshing vendor data...');
        await fetchVendorData();
      }

      if (Platform.OS === 'web') {
        if (emailChanged) {
          alert('Profile updated! Please check your new email address to confirm the change.');
        } else {
          alert('Profile updated successfully!');
        }
      }
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to update profile: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setEmail(profile?.email || '');
    setPhone(profile?.phone || '');
    if (vendorData) {
      setBusinessName(vendorData.business_name || '');
      setBusinessDescription(vendorData.description || '');
      setBusinessAddress(vendorData.address || '');
    }
    setBusinessPhone(profile?.business_phone || '');
    setIsEditing(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#ef4444';
      case 'vendor':
        return '#ff8c00';
      case 'customer':
        return '#ff8c00';
      default:
        return '#6b7280';
    }
  };

  if (profile?.role === 'vendor' && loadingVendor) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
        <Text style={styles.loadingText}>Loading vendor information...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatarContainer}>
          <User size={48} color="#ffffff" />
        </View>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <View style={styles.roleBadge}>
          <Shield size={14} color="#ffffff" />
          <Text style={styles.roleText}>
            {profile?.role.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.editButtonContainer}>
          {!isEditing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <Edit size={18} color="#ffffff" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <X size={18} color="#6b7280" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Save size={18} color="#ffffff" />
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <User size={20} color="#ff8c00" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Full Name</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9ca3af"
                />
              ) : (
                <Text style={styles.infoValue}>{profile?.full_name}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Mail size={20} color="#ff8c00" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={styles.infoValue}>{profile?.email}</Text>
              )}
            </View>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoIcon}>
              <Phone size={20} color="#ff8c00" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{profile?.phone || 'Not provided'}</Text>
              )}
            </View>
          </View>
        </View>

        {profile?.role === 'vendor' && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Store Information</Text>

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Store size={20} color="#ff8c00" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Business Name</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={businessName}
                    onChangeText={setBusinessName}
                    placeholder="Enter business name"
                    placeholderTextColor="#9ca3af"
                  />
                ) : (
                  <Text style={styles.infoValue}>{vendorData?.business_name || 'Not provided'}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <Phone size={20} color="#ff8c00" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Business Phone</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={businessPhone}
                    onChangeText={setBusinessPhone}
                    placeholder="Enter business phone"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={styles.infoValue}>{profile?.business_phone || 'Not provided'}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <MapPin size={20} color="#ff8c00" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Business Address</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={businessAddress}
                    onChangeText={setBusinessAddress}
                    placeholder="Enter business address"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={2}
                  />
                ) : (
                  <Text style={styles.infoValue}>{vendorData?.address || 'Not provided'}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoItem}>
              <View style={styles.infoIcon}>
                <FileText size={20} color="#ff8c00" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Business Description</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, styles.textArea, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={businessDescription}
                    onChangeText={setBusinessDescription}
                    placeholder="Describe your business"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                  />
                ) : (
                  <Text style={styles.infoValue}>{vendorData?.description || 'Not provided'}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/help-center')}
          >
            <Text style={styles.menuText}>Help Center</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/terms-of-service')}
          >
            <Text style={styles.menuText}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/privacy-policy')}
          >
            <Text style={styles.menuText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
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
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingBottom: 48,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    padding: 16,
  },
  editButtonContainer: {
    marginBottom: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 4,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  menuItem: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    gap: 8,
    borderWidth: 2,
    borderColor: '#fee2e2',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  signOutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
});

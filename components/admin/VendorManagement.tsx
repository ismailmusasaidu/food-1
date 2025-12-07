import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Clock, CheckCircle, XCircle, ChevronRight, ArrowLeft, Search, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';

interface VendorManagementProps {
  onBack?: () => void;
}

export default function VendorManagement({ onBack }: VendorManagementProps) {
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Profile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'vendor')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
      setFilteredVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredVendors(vendors);
    } else {
      const filtered = vendors.filter((vendor) => {
        const searchTerm = query.toLowerCase();
        const businessName = (vendor.business_name || '').toLowerCase();
        const fullName = (vendor.full_name || '').toLowerCase();
        const email = (vendor.email || '').toLowerCase();
        const address = (vendor.business_address || '').toLowerCase();
        const status = (vendor.vendor_status || '').toLowerCase();

        return businessName.includes(searchTerm) ||
          fullName.includes(searchTerm) ||
          email.includes(searchTerm) ||
          address.includes(searchTerm) ||
          status.includes(searchTerm);
      });
      setFilteredVendors(filtered);
    }
  };

  const handleApprove = async (vendorId: string) => {
    try {
      setProcessing(true);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ vendor_status: 'approved' })
        .eq('id', vendorId);

      if (profileError) throw profileError;

      const { error: vendorError } = await supabase
        .from('vendors')
        .update({ is_verified: true })
        .eq('user_id', vendorId);

      if (vendorError) throw vendorError;

      await fetchVendors();
      setShowModal(false);
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error approving vendor:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (vendorId: string) => {
    if (!rejectionReason.trim()) {
      return;
    }

    try {
      setProcessing(true);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', vendorId);

      if (profileError) throw profileError;

      const { error: vendorError } = await supabase
        .from('vendors')
        .update({ is_verified: false, is_active: false })
        .eq('user_id', vendorId);

      if (vendorError) throw vendorError;

      await fetchVendors();
      setShowModal(false);
      setSelectedVendor(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting vendor:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'approved':
        return '#ff8c00';
      case 'rejected':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'approved':
        return CheckCircle;
      case 'rejected':
        return XCircle;
      default:
        return Clock;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={24} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Vendor Applications</Text>
            <Text style={styles.subtitle}>{vendors.length} total vendors</Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, address, or status..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const StatusIcon = getStatusIcon(item.vendor_status);
          return (
            <View>
              <TouchableOpacity
                style={styles.vendorCard}
                onPress={() => {
                  setSelectedVendor(item);
                  setShowModal(true);
                }}
              >
                <View style={styles.vendorInfo}>
                  <View style={styles.vendorHeader}>
                    <Text style={styles.vendorName}>{item.business_name || item.full_name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.vendor_status) + '20' },
                      ]}
                    >
                      <StatusIcon size={14} color={getStatusColor(item.vendor_status)} />
                      <Text
                        style={[styles.statusText, { color: getStatusColor(item.vendor_status) }]}
                      >
                        {item.vendor_status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.vendorEmail}>{item.email}</Text>
                  {item.business_address && (
                    <Text style={styles.vendorAddress}>{item.business_address}</Text>
                  )}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedVendor && (
              <>
                <Text style={styles.modalTitle}>Vendor Details</Text>
                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Business Name</Text>
                    <Text style={styles.detailValue}>
                      {selectedVendor.business_name || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Owner Name</Text>
                    <Text style={styles.detailValue}>{selectedVendor.full_name}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{selectedVendor.email}</Text>
                  </View>

                  {selectedVendor.business_phone && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Business Phone</Text>
                      <Text style={styles.detailValue}>{selectedVendor.business_phone}</Text>
                    </View>
                  )}

                  {selectedVendor.business_address && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Business Address</Text>
                      <Text style={styles.detailValue}>{selectedVendor.business_address}</Text>
                    </View>
                  )}

                  {selectedVendor.business_description && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{selectedVendor.business_description}</Text>
                    </View>
                  )}

                  {selectedVendor.business_license && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>License Number</Text>
                      <Text style={styles.detailValue}>{selectedVendor.business_license}</Text>
                    </View>
                  )}

                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: getStatusColor(selectedVendor.vendor_status) },
                      ]}
                    >
                      {selectedVendor.vendor_status.toUpperCase()}
                    </Text>
                  </View>

                  {selectedVendor.vendor_status === 'pending' && (
                    <>
                      <TextInput
                        style={styles.reasonInput}
                        placeholder="Rejection reason (optional for approval, required for rejection)"
                        placeholderTextColor="#9ca3af"
                        value={rejectionReason}
                        onChangeText={setRejectionReason}
                        multiline
                        numberOfLines={3}
                      />

                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.approveButton]}
                          onPress={() => handleApprove(selectedVendor.id)}
                          disabled={processing}
                        >
                          {processing ? (
                            <ActivityIndicator color="#ffffff" />
                          ) : (
                            <>
                              <CheckCircle size={20} color="#ffffff" />
                              <Text style={styles.actionButtonText}>Approve</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionButton, styles.rejectButton]}
                          onPress={() => handleReject(selectedVendor.id)}
                          disabled={processing || !rejectionReason.trim()}
                        >
                          {processing ? (
                            <ActivityIndicator color="#ffffff" />
                          ) : (
                            <>
                              <XCircle size={20} color="#ffffff" />
                              <Text style={styles.actionButtonText}>Reject</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      setShowModal(false);
                      setSelectedVendor(null);
                      setRejectionReason('');
                    }}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#e0f2fe',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  searchIcon: {
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  list: {
    padding: 16,
  },
  vendorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  vendorEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  vendorAddress: {
    fontSize: 12,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    flexShrink: 1,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  reasonInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#ff8c00',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
});

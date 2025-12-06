import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { Bike, ArrowLeft, CheckCircle, XCircle, Ban, Eye, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Rider {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  nin: string;
  motorbike_details: {
    make?: string;
    model?: string;
    plate_number?: string;
  };
  passport_photo_url: string | null;
  license_url: string | null;
  next_of_kin: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating: number;
  total_deliveries: number;
  created_at: string;
}

interface RiderManagementProps {
  onBack?: () => void;
}

const statusColors = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  suspended: '#94a3b8',
};

const statusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export default function RiderManagement({ onBack }: RiderManagementProps) {
  const { profile: currentUser } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    riderId: string;
    status: 'approved' | 'rejected' | 'suspended';
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchRiders();

    const channel = supabase
      .channel('rider-management')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'riders',
        },
        () => {
          fetchRiders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRiders = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRiders(data || []);
    } catch (error: any) {
      console.error('Error fetching riders:', error);
      setErrorMessage(error.message || 'Failed to fetch riders');
    } finally {
      setLoading(false);
    }
  };

  const openDetailsModal = (rider: Rider) => {
    setSelectedRider(rider);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedRider(null);
  };

  const promptUpdateRiderStatus = (
    riderId: string,
    newStatus: 'approved' | 'rejected' | 'suspended'
  ) => {
    setConfirmAction({ riderId, status: newStatus });
    setShowConfirmModal(true);
  };

  const updateRiderStatus = async () => {
    if (!confirmAction) return;

    const { riderId, status: newStatus } = confirmAction;
    const statusMessages = {
      approved: 'approve',
      rejected: 'reject',
      suspended: 'suspend',
    };

    const message = statusMessages[newStatus];

    try {
      setActionLoading(riderId);
      setShowConfirmModal(false);

      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', riderId);

      if (error) throw error;

      if (newStatus === 'approved') {
        const rider = riders.find(r => r.id === riderId);
        if (rider?.user_id) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: 'rider' })
            .eq('id', rider.user_id);

          if (profileError) throw profileError;
        }
      }

      setSuccessMessage(`Rider ${message}d successfully`);
      await fetchRiders();
      closeDetailsModal();
    } catch (error: any) {
      console.error(`Error ${message}ing rider:`, error);
      setErrorMessage(error.message || `Failed to ${message} rider`);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
            <Text style={styles.title}>Rider Management</Text>
            <Text style={styles.subtitle}>{riders.length} total riders</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
            {riders.filter((r) => r.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={[styles.statNumber, { color: '#10b981' }]}>
            {riders.filter((r) => r.status === 'approved').length}
          </Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {riders.filter((r) => r.status === 'rejected').length}
          </Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      <FlatList
        data={riders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const statusColor = statusColors[item.status];
          const isLoading = actionLoading === item.id;

          return (
            <TouchableOpacity
              style={styles.riderCard}
              onPress={() => openDetailsModal(item)}
            >
              <View style={styles.riderHeader}>
                <View style={styles.riderIcon}>
                  <Bike size={20} color="#ff8c00" />
                </View>
                <View style={styles.riderInfo}>
                  <Text style={styles.riderName}>{item.full_name}</Text>
                  <Text style={styles.riderPhone}>{item.phone}</Text>
                  <Text style={styles.riderDate}>
                    Registered {formatDate(item.created_at)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor + '20' },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusLabels[item.status]}
                  </Text>
                </View>
              </View>

              {item.status === 'approved' && (
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{item.total_deliveries}</Text>
                    <Text style={styles.statText}>Deliveries</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>
                      {item.rating > 0 ? item.rating.toFixed(1) : 'N/A'}
                    </Text>
                    <Text style={styles.statText}>Rating</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={closeDetailsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rider Details</Text>
              <TouchableOpacity onPress={closeDetailsModal} style={styles.closeButton}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedRider && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Full Name:</Text>
                    <Text style={styles.detailValue}>{selectedRider.full_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{selectedRider.phone}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>NIN:</Text>
                    <Text style={styles.detailValue}>{selectedRider.nin}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status:</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColors[selectedRider.status] + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusColors[selectedRider.status] },
                        ]}
                      >
                        {statusLabels[selectedRider.status]}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Motorbike Details</Text>
                  {selectedRider.motorbike_details?.make && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Make:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.motorbike_details.make}
                      </Text>
                    </View>
                  )}
                  {selectedRider.motorbike_details?.model && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Model:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.motorbike_details.model}
                      </Text>
                    </View>
                  )}
                  {selectedRider.motorbike_details?.plate_number && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Plate Number:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.motorbike_details.plate_number}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Next of Kin</Text>
                  {selectedRider.next_of_kin?.name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.next_of_kin.name}
                      </Text>
                    </View>
                  )}
                  {selectedRider.next_of_kin?.phone && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.next_of_kin.phone}
                      </Text>
                    </View>
                  )}
                  {selectedRider.next_of_kin?.relationship && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Relationship:</Text>
                      <Text style={styles.detailValue}>
                        {selectedRider.next_of_kin.relationship}
                      </Text>
                    </View>
                  )}
                </View>

                {selectedRider.passport_photo_url && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Passport Photo</Text>
                    <Image
                      source={{ uri: selectedRider.passport_photo_url }}
                      style={styles.documentImage}
                    />
                  </View>
                )}

                {selectedRider.license_url && (
                  <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Driving License</Text>
                    <Image
                      source={{ uri: selectedRider.license_url }}
                      style={styles.documentImage}
                    />
                  </View>
                )}

                {selectedRider.status === 'pending' && (
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => promptUpdateRiderStatus(selectedRider.id, 'approved')}
                      disabled={actionLoading === selectedRider.id}
                    >
                      {actionLoading === selectedRider.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <CheckCircle size={20} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => promptUpdateRiderStatus(selectedRider.id, 'rejected')}
                      disabled={actionLoading === selectedRider.id}
                    >
                      {actionLoading === selectedRider.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <XCircle size={20} color="#ffffff" />
                          <Text style={styles.actionButtonText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {selectedRider.status === 'approved' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.suspendButton]}
                    onPress={() => promptUpdateRiderStatus(selectedRider.id, 'suspended')}
                    disabled={actionLoading === selectedRider.id}
                  >
                    {actionLoading === selectedRider.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ban size={20} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Suspend</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <Text style={styles.confirmTitle}>
              {confirmAction && statusLabels[confirmAction.status]} Rider
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmAction && `Are you sure you want to ${
                confirmAction.status === 'approved' ? 'approve' :
                confirmAction.status === 'rejected' ? 'reject' : 'suspend'
              } this rider?`}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  confirmAction?.status === 'approved'
                    ? styles.approveConfirmButton
                    : styles.rejectConfirmButton,
                ]}
                onPress={updateRiderStatus}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmAction && statusLabels[confirmAction.status]}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!errorMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorMessage(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.messageIcon}>
              <XCircle size={48} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Error</Text>
            <Text style={styles.confirmMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, styles.okButton]}
              onPress={() => setErrorMessage(null)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!successMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSuccessMessage(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContent}>
            <View style={styles.messageIcon}>
              <CheckCircle size={48} color="#10b981" />
            </View>
            <Text style={styles.confirmTitle}>Success</Text>
            <Text style={styles.confirmMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, styles.okButton]}
              onPress={() => setSuccessMessage(null)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  riderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  riderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInfo: {
    flex: 1,
    gap: 4,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  riderPhone: {
    fontSize: 13,
    color: '#64748b',
  },
  riderDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 16,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff8c00',
  },
  statText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  documentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  suspendButton: {
    backgroundColor: '#94a3b8',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  approveConfirmButton: {
    backgroundColor: '#10b981',
  },
  rejectConfirmButton: {
    backgroundColor: '#ef4444',
  },
  okButton: {
    backgroundColor: '#ff8c00',
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  messageIcon: {
    marginBottom: 16,
  },
});

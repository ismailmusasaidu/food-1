import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Shield, ShoppingBag, UserCircle, Edit3, Trash2, X, ArrowLeft, Lock, Unlock, Search } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'customer' | 'vendor' | 'admin';
  created_at: string;
  is_suspended: boolean;
  suspended_at: string | null;
}

interface UserManagementProps {
  onBack?: () => void;
}

const roleIcons = {
  admin: Shield,
  vendor: ShoppingBag,
  customer: UserCircle,
};

const roleColors = {
  admin: '#ef4444',
  vendor: '#ff8c00',
  customer: '#3b82f6',
};

const roleLabels = {
  admin: 'Admin',
  vendor: 'Vendor',
  customer: 'Customer',
};

export default function UserManagement({ onBack }: UserManagementProps) {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'customer' as 'customer' | 'vendor' | 'admin',
  });
  const [updating, setUpdating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('user-management')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, created_at, is_suspended, suspended_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = users.filter((user) =>
        user.full_name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery) ||
        (user.phone && user.phone.toLowerCase().includes(lowerQuery)) ||
        user.role.toLowerCase().includes(lowerQuery)
      );
      setFilteredUsers(filtered);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setEditForm({
      full_name: '',
      phone: '',
      role: 'customer',
    });
  };

  const updateUser = async () => {
    if (!selectedUser) return;

    if (!editForm.full_name.trim()) {
      Alert.alert('Validation Error', 'Full name is required');
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          role: editForm.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      Alert.alert('Success', 'User updated successfully');
      closeEditModal();
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      Alert.alert('Error', error.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userName}? This action cannot be undone and will remove all associated data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(userId);

              console.log('Attempting to delete user:', userId);
              console.log('Current admin user:', currentUser?.id);

              const { data, error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId)
                .select();

              console.log('Delete response:', { data, error });

              if (error) {
                console.error('Delete error details:', {
                  message: error.message,
                  details: error.details,
                  hint: error.hint,
                  code: error.code
                });
                throw error;
              }

              Alert.alert('Success', 'User deleted successfully');
              await fetchUsers();
            } catch (error: any) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', error.message || 'Failed to delete user. The user may have associated data that needs to be removed first.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const toggleSuspension = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot suspend your own account');
      return;
    }

    const action = user.is_suspended ? 'unsuspend' : 'suspend';
    const actionTitle = user.is_suspended ? 'Unsuspend' : 'Suspend';

    Alert.alert(
      `${actionTitle} User`,
      `Are you sure you want to ${action} ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionTitle,
          style: user.is_suspended ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActionLoading(user.id);

              const updateData: any = {
                is_suspended: !user.is_suspended,
              };

              if (!user.is_suspended) {
                updateData.suspended_at = new Date().toISOString();
                updateData.suspended_by = currentUser?.id;
              } else {
                updateData.suspended_at = null;
                updateData.suspended_by = null;
              }

              console.log('Attempting to suspend/unsuspend user:', user.id);
              console.log('Update data:', updateData);
              console.log('Current admin user:', currentUser?.id);

              const { data, error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id)
                .select();

              console.log('Update response:', { data, error });

              if (error) {
                console.error('Suspend/Unsuspend error details:', {
                  message: error.message,
                  details: error.details,
                  hint: error.hint,
                  code: error.code
                });
                throw error;
              }

              Alert.alert('Success', `User ${action}ed successfully`);
              await fetchUsers();
            } catch (error: any) {
              console.error(`Error ${action}ing user:`, error);
              Alert.alert('Error', error.message || `Failed to ${action} user`);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
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
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.subtitle}>{users.length} total users</Text>
          </View>
        </View>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, phone, or role..."
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

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Shield size={20} color="#ef4444" />
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>
            {users.filter((u) => u.role === 'admin').length}
          </Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#ffedd5' }]}>
          <ShoppingBag size={20} color="#ff8c00" />
          <Text style={[styles.statNumber, { color: '#ff8c00' }]}>
            {users.filter((u) => u.role === 'vendor').length}
          </Text>
          <Text style={styles.statLabel}>Vendors</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <UserCircle size={20} color="#3b82f6" />
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>
            {users.filter((u) => u.role === 'customer').length}
          </Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const RoleIcon = roleIcons[item.role];
          const roleColor = roleColors[item.role];
          const isCurrentUser = item.id === currentUser?.id;
          const isLoading = actionLoading === item.id;

          return (
            <View style={[
              styles.userCard,
              item.is_suspended && styles.suspendedCard
            ]}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{item.full_name}</Text>
                    <View style={styles.badges}>
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: roleColor + '20' },
                        ]}
                      >
                        <RoleIcon size={12} color={roleColor} />
                        <Text style={[styles.roleText, { color: roleColor }]}>
                          {roleLabels[item.role]}
                        </Text>
                      </View>
                      {item.is_suspended && (
                        <View style={styles.suspendedBadge}>
                          <Lock size={10} color="#ef4444" />
                          <Text style={styles.suspendedText}>Suspended</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  {item.phone && (
                    <Text style={styles.userPhone}>{item.phone}</Text>
                  )}
                  <Text style={styles.userDate}>
                    Joined {formatDate(item.created_at)}
                  </Text>
                  {item.is_suspended && item.suspended_at && (
                    <Text style={styles.suspendedDate}>
                      Suspended {formatDate(item.suspended_at)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => openEditModal(item)}
                  disabled={isLoading}
                >
                  <Edit3 size={16} color="#ff8c00" />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    item.is_suspended ? styles.unsuspendButton : styles.suspendButton
                  ]}
                  onPress={() => toggleSuspension(item)}
                  disabled={isLoading || isCurrentUser}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={item.is_suspended ? "#059669" : "#f59e0b"} />
                  ) : (
                    <>
                      {item.is_suspended ? (
                        <Unlock size={16} color="#059669" />
                      ) : (
                        <Lock size={16} color="#f59e0b" />
                      )}
                      <Text style={[
                        styles.actionButtonText,
                        item.is_suspended ? styles.unsuspendButtonText : styles.suspendButtonText
                      ]}>
                        {item.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteUser(item.id, item.full_name)}
                  disabled={isLoading || isCurrentUser}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.closeButton}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.full_name}
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, full_name: text })
                    }
                    placeholder="Enter full name"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.phone}
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, phone: text })
                    }
                    placeholder="Enter phone number"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Role</Text>
                  <View style={styles.roleOptions}>
                    {(['customer', 'vendor', 'admin'] as const).map((role) => {
                      const RoleIcon = roleIcons[role];
                      const roleColor = roleColors[role];
                      const isSelected = editForm.role === role;

                      return (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.roleOption,
                            isSelected && {
                              backgroundColor: roleColor + '20',
                              borderColor: roleColor,
                            },
                          ]}
                          onPress={() => setEditForm({ ...editForm, role })}
                          disabled={updating}
                        >
                          <RoleIcon size={18} color={roleColor} />
                          <Text
                            style={[
                              styles.roleOptionText,
                              { color: roleColor },
                            ]}
                          >
                            {roleLabels[role]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, updating && styles.saveButtonDisabled]}
                  onPress={updateUser}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  userCard: {
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
  suspendedCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  userHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userInfo: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    backgroundColor: '#fee2e2',
  },
  suspendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
  },
  userPhone: {
    fontSize: 12,
    color: '#94a3b8',
  },
  userDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  suspendedDate: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  editButton: {
    backgroundColor: '#ffedd5',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ff8c00',
  },
  suspendButton: {
    backgroundColor: '#fef3c7',
  },
  suspendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  unsuspendButton: {
    backgroundColor: '#d1fae5',
  },
  unsuspendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
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
  form: {
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleOptions: {
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
});

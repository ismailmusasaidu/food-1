import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Building2, Plus, Edit, Trash2, Save, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  display_order: number;
}

interface BankAccountFormData {
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  display_order: number;
}

export default function BankAccountManagement() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<BankAccountFormData>({
    bank_name: '',
    account_number: '',
    account_name: '',
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError(`Failed to load: ${fetchError.message}`);
        return;
      }

      console.log('Bank accounts loaded:', data?.length || 0);
      setBankAccounts(data || []);
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
      setError(`Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.bank_name || !formData.account_number || !formData.account_name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase.from('bank_accounts').insert([formData]);

      if (error) throw error;

      Alert.alert('Success', 'Bank account added successfully');
      setShowAddForm(false);
      setFormData({
        bank_name: '',
        account_number: '',
        account_name: '',
        is_active: true,
        display_order: 0,
      });
      fetchBankAccounts();
    } catch (error) {
      console.error('Error adding bank account:', error);
      Alert.alert('Error', 'Failed to add bank account');
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setFormData({
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_name: account.account_name,
      is_active: account.is_active,
      display_order: account.display_order,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!formData.bank_name || !formData.account_number || !formData.account_name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update(formData)
        .eq('id', editingId);

      if (error) throw error;

      Alert.alert('Success', 'Bank account updated successfully');
      setEditingId(null);
      setFormData({
        bank_name: '',
        account_number: '',
        account_name: '',
        is_active: true,
        display_order: 0,
      });
      fetchBankAccounts();
    } catch (error) {
      console.error('Error updating bank account:', error);
      Alert.alert('Error', 'Failed to update bank account');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this bank account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('bank_accounts').delete().eq('id', id);

              if (error) throw error;

              Alert.alert('Success', 'Bank account deleted successfully');
              fetchBankAccounts();
            } catch (error) {
              console.error('Error deleting bank account:', error);
              Alert.alert('Error', 'Failed to delete bank account');
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({
      bank_name: '',
      account_number: '',
      account_name: '',
      is_active: true,
      display_order: 0,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Building2 size={24} color="#ff8c00" />
          <Text style={styles.headerTitle}>Bank Accounts</Text>
        </View>
        {!showAddForm && !editingId && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddForm(true)}>
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Account</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchBankAccounts} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAddForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add New Bank Account</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Name</Text>
            <TextInput
              style={styles.input}
              value={formData.bank_name}
              onChangeText={(text) => setFormData({ ...formData, bank_name: text })}
              placeholder="e.g., First Bank of Nigeria"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={formData.account_number}
              onChangeText={(text) => setFormData({ ...formData, account_number: text })}
              placeholder="e.g., 1234567890"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Name</Text>
            <TextInput
              style={styles.input}
              value={formData.account_name}
              onChangeText={(text) => setFormData({ ...formData, account_name: text })}
              placeholder="e.g., FoodDelivery Ltd"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Order</Text>
            <TextInput
              style={styles.input}
              value={formData.display_order.toString()}
              onChangeText={(text) =>
                setFormData({ ...formData, display_order: parseInt(text) || 0 })
              }
              placeholder="e.g., 1"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.toggleGroup}>
            <Text style={styles.label}>Active</Text>
            <TouchableOpacity
              style={[styles.toggle, formData.is_active && styles.toggleActive]}
              onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
            >
              <View
                style={[styles.toggleThumb, formData.is_active && styles.toggleThumbActive]}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <X size={16} color="#64748b" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
              <Save size={16} color="#fff" />
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.accountsList}>
        {bankAccounts.map((account) => (
          <View key={account.id} style={styles.accountCard}>
            {editingId === account.id ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bank Name</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.bank_name}
                    onChangeText={(text) => setFormData({ ...formData, bank_name: text })}
                    placeholder="Bank Name"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Number</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.account_number}
                    onChangeText={(text) => setFormData({ ...formData, account_number: text })}
                    placeholder="Account Number"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Name</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.account_name}
                    onChangeText={(text) => setFormData({ ...formData, account_name: text })}
                    placeholder="Account Name"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Display Order</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.display_order.toString()}
                    onChangeText={(text) =>
                      setFormData({ ...formData, display_order: parseInt(text) || 0 })
                    }
                    placeholder="Display Order"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.toggleGroup}>
                  <Text style={styles.label}>Active</Text>
                  <TouchableOpacity
                    style={[styles.toggle, formData.is_active && styles.toggleActive]}
                    onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  >
                    <View
                      style={[styles.toggleThumb, formData.is_active && styles.toggleThumbActive]}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                    <X size={16} color="#64748b" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                    <Save size={16} color="#fff" />
                    <Text style={styles.saveButtonText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.accountHeader}>
                  <View style={styles.accountInfo}>
                    <Text style={styles.bankName}>{account.bank_name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        account.is_active ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          account.is_active ? styles.statusTextActive : styles.statusTextInactive,
                        ]}
                      >
                        {account.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.accountActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEdit(account)}
                    >
                      <Edit size={16} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(account.id)}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.accountDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Number:</Text>
                    <Text style={styles.detailValue}>{account.account_number}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Name:</Text>
                    <Text style={styles.detailValue}>{account.account_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Display Order:</Text>
                    <Text style={styles.detailValue}>{account.display_order}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      {bankAccounts.length === 0 && !showAddForm && (
        <View style={styles.emptyState}>
          <Building2 size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No bank accounts added yet</Text>
          <Text style={styles.emptySubtext}>Add your first bank account to get started</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#ff8c00',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  accountsList: {
    gap: 12,
    paddingHorizontal: 16,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accountInfo: {
    flex: 1,
    gap: 8,
  },
  bankName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextInactive: {
    color: '#991b1b',
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 6,
  },
  accountDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

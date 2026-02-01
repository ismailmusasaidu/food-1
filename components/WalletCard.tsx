import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { Wallet, Eye, EyeOff, Plus, Minus, Copy, X, Building2, CreditCard, Calendar, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface WalletData {
  id: string;
  balance: number;
  currency: string;
  paystack_account_number: string | null;
  paystack_bank_name: string | null;
  is_active: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
  balance_after: number;
}

export default function WalletCard() {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankCode, setBankCode] = useState('');

  useEffect(() => {
    fetchWallet();
  }, [profile]);

  const fetchWallet = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) throw error;
      setWallet(data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!wallet) return;

    try {
      setLoadingTransactions(true);
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const createVirtualAccount = async () => {
    try {
      setCreatingAccount(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wallet-create-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create virtual account');
      }

      const result = await response.json();
      setWallet(result.wallet);

      if (Platform.OS === 'web') {
        alert('Virtual account created successfully!');
      }
    } catch (error: any) {
      console.error('Error creating virtual account:', error);
      if (Platform.OS === 'web') {
        alert(`Failed to create virtual account: ${error.message}`);
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      if (Platform.OS === 'web') {
        alert('Please enter a valid amount');
      }
      return;
    }

    if (amount < 100) {
      if (Platform.OS === 'web') {
        alert('Minimum withdrawal amount is ₦100');
      }
      return;
    }

    if (amount > wallet.balance) {
      if (Platform.OS === 'web') {
        alert('Insufficient balance');
      }
      return;
    }

    if (!accountNumber || !accountName || !bankCode) {
      if (Platform.OS === 'web') {
        alert('Please fill in all bank details');
      }
      return;
    }

    try {
      setWithdrawing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wallet-withdraw`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            bank_code: bankCode,
            account_number: accountNumber,
            account_name: accountName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process withdrawal');
      }

      const result = await response.json();

      if (Platform.OS === 'web') {
        alert('Withdrawal request submitted successfully!');
      }

      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setAccountNumber('');
      setAccountName('');
      setBankCode('');

      await fetchWallet();
    } catch (error: any) {
      console.error('Error withdrawing:', error);
      if (Platform.OS === 'web') {
        alert(`Withdrawal failed: ${error.message}`);
      }
    } finally {
      setWithdrawing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft size={18} color="#10b981" />;
      case 'withdrawal':
        return <ArrowUpRight size={18} color="#ef4444" />;
      case 'payment':
        return <CreditCard size={18} color="#f59e0b" />;
      case 'refund':
        return <ArrowDownLeft size={18} color="#3b82f6" />;
      default:
        return <Wallet size={18} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (!wallet) {
    return (
      <View style={styles.walletCard}>
        <View style={styles.emptyWalletContainer}>
          <Wallet size={48} color="#ff8c00" />
          <Text style={styles.emptyWalletTitle}>Create Your Wallet</Text>
          <Text style={styles.emptyWalletText}>
            Get a dedicated virtual account for instant deposits
          </Text>
          <TouchableOpacity
            style={[styles.createButton, creatingAccount && styles.createButtonDisabled]}
            onPress={createVirtualAccount}
            disabled={creatingAccount}
          >
            {creatingAccount ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Wallet size={20} color="#ffffff" />
                <Text style={styles.createButtonText}>Create Wallet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>
                {balanceVisible
                  ? `₦${parseFloat(wallet.balance.toString()).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '******'}
              </Text>
              <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                {balanceVisible ? (
                  <Eye size={24} color="#ffffff" />
                ) : (
                  <EyeOff size={24} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {wallet.paystack_account_number && (
          <View style={styles.accountDetails}>
            <View style={styles.accountRow}>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Bank Name</Text>
                <Text style={styles.accountValue}>{wallet.paystack_bank_name}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Account Number</Text>
                <View style={styles.accountNumberRow}>
                  <Text style={styles.accountValue}>{wallet.paystack_account_number}</Text>
                  <TouchableOpacity onPress={() => copyToClipboard(wallet.paystack_account_number!)}>
                    <Copy size={18} color="#ff8c00" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowDepositModal(true)}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Minus size={20} color="#ffffff" />
            <Text style={styles.actionButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.transactionsButton}
          onPress={() => {
            setShowTransactionsModal(true);
            fetchTransactions();
          }}
        >
          <Text style={styles.transactionsButtonText}>View Transactions</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDepositModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit Funds</Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.depositInfo}>
              <Building2 size={32} color="#ff8c00" />
              <Text style={styles.depositTitle}>Transfer to Your Virtual Account</Text>
              <Text style={styles.depositText}>
                Send money to the account below and it will be credited instantly
              </Text>

              <View style={styles.bankDetails}>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Bank Name</Text>
                  <Text style={styles.bankDetailValue}>{wallet.paystack_bank_name}</Text>
                </View>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Account Number</Text>
                  <View style={styles.bankDetailValueRow}>
                    <Text style={styles.bankDetailValue}>{wallet.paystack_account_number}</Text>
                    <TouchableOpacity onPress={() => copyToClipboard(wallet.paystack_account_number!)}>
                      <Copy size={18} color="#ff8c00" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.bankDetailRow}>
                  <Text style={styles.bankDetailLabel}>Account Name</Text>
                  <Text style={styles.bankDetailValue}>{profile?.full_name}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Funds</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.withdrawForm}>
              <Text style={styles.inputLabel}>Amount (₦)</Text>
              <TextInput
                style={styles.input}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Enter amount"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Account Number</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Enter account number"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>Account Name</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Enter account name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.inputLabel}>Bank Code</Text>
              <TextInput
                style={styles.input}
                value={bankCode}
                onChangeText={setBankCode}
                placeholder="e.g., 057 for Zenith"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.helperText}>Minimum withdrawal: ₦100</Text>

              <TouchableOpacity
                style={[styles.submitButton, withdrawing && styles.submitButtonDisabled]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Withdraw</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showTransactionsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity onPress={() => setShowTransactionsModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.transactionsList}>
              {loadingTransactions ? (
                <View style={styles.loadingTransactions}>
                  <ActivityIndicator size="large" color="#ff8c00" />
                </View>
              ) : transactions.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Wallet size={48} color="#d1d5db" />
                  <Text style={styles.emptyTransactionsText}>No transactions yet</Text>
                </View>
              ) : (
                transactions.map((transaction) => (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      {getTransactionIcon(transaction.type)}
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDescription}>{transaction.description}</Text>
                      <Text style={styles.transactionDate}>{formatDate(transaction.created_at)}</Text>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text
                        style={[
                          styles.transactionAmount,
                          transaction.type === 'deposit' || transaction.type === 'refund'
                            ? styles.transactionAmountPositive
                            : styles.transactionAmountNegative,
                        ]}
                      >
                        {transaction.type === 'deposit' || transaction.type === 'refund' ? '+' : '-'}
                        ₦{transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status) }]}>
                        <Text style={styles.statusText}>{transaction.status}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 0,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  walletHeader: {
    backgroundColor: '#ff8c00',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  balanceSection: {
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  accountDetails: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  accountRow: {
    gap: 16,
  },
  accountInfo: {
    gap: 4,
  },
  accountLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  accountValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  accountNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  withdrawButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  transactionsButton: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionsButtonText: {
    textAlign: 'center',
    color: '#ff8c00',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  emptyWalletContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyWalletTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyWalletText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff8c00',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
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
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  depositInfo: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  depositTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 8,
  },
  depositText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  bankDetails: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    gap: 16,
  },
  bankDetailRow: {
    gap: 4,
  },
  bankDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  bankDetailValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '700',
  },
  bankDetailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  withdrawForm: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  transactionsList: {
    padding: 20,
  },
  loadingTransactions: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTransactions: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  emptyTransactionsText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDetails: {
    flex: 1,
    gap: 4,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionAmountPositive: {
    color: '#10b981',
  },
  transactionAmountNegative: {
    color: '#ef4444',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

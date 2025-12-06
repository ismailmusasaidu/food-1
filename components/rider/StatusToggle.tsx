import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Power, Zap, Circle } from 'lucide-react-native';

interface StatusToggleProps {
  currentStatus: 'available' | 'busy' | 'offline';
  onStatusChange: (status: 'available' | 'busy' | 'offline') => Promise<void>;
  disabled?: boolean;
}

export default function StatusToggle({
  currentStatus,
  onStatusChange,
  disabled = false,
}: StatusToggleProps) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: 'available' | 'busy' | 'offline') => {
    if (loading || disabled || newStatus === currentStatus) return;

    try {
      setLoading(true);
      await onStatusChange(newStatus);
    } catch (error) {
      console.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'available':
        return '#10b981';
      case 'busy':
        return '#f59e0b';
      case 'offline':
        return '#64748b';
      default:
        return '#64748b';
    }
  };

  const getStatusLabel = () => {
    switch (currentStatus) {
      case 'available':
        return 'Available';
      case 'busy':
        return 'Busy';
      case 'offline':
        return 'Offline';
      default:
        return 'Offline';
    }
  };

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'available':
        return <Zap size={24} color="#ffffff" />;
      case 'busy':
        return <Circle size={24} color="#ffffff" />;
      case 'offline':
        return <Power size={24} color="#ffffff" />;
      default:
        return <Power size={24} color="#ffffff" />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.currentStatus}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            getStatusIcon()
          )}
        </View>
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusLabel()}
          </Text>
        </View>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'available' && styles.activeButton,
            { backgroundColor: currentStatus === 'available' ? '#10b981' : '#f1f5f9' },
          ]}
          onPress={() => handleStatusChange('available')}
          disabled={loading || disabled}
        >
          <Zap
            size={20}
            color={currentStatus === 'available' ? '#ffffff' : '#10b981'}
          />
          <Text
            style={[
              styles.buttonText,
              currentStatus === 'available' && styles.activeButtonText,
            ]}
          >
            Available
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'busy' && styles.activeButton,
            { backgroundColor: currentStatus === 'busy' ? '#f59e0b' : '#f1f5f9' },
          ]}
          onPress={() => handleStatusChange('busy')}
          disabled={loading || disabled}
        >
          <Circle
            size={20}
            color={currentStatus === 'busy' ? '#ffffff' : '#f59e0b'}
          />
          <Text
            style={[
              styles.buttonText,
              currentStatus === 'busy' && styles.activeButtonText,
            ]}
          >
            Busy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            currentStatus === 'offline' && styles.activeButton,
            { backgroundColor: currentStatus === 'offline' ? '#64748b' : '#f1f5f9' },
          ]}
          onPress={() => handleStatusChange('offline')}
          disabled={loading || disabled}
        >
          <Power
            size={20}
            color={currentStatus === 'offline' ? '#ffffff' : '#64748b'}
          />
          <Text
            style={[
              styles.buttonText,
              currentStatus === 'offline' && styles.activeButtonText,
            ]}
          >
            Offline
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '800',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  activeButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  activeButtonText: {
    color: '#ffffff',
  },
});

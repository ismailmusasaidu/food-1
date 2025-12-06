import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  Bell,
  Package,
  Gift,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
} from 'lucide-react-native';

export interface RiderNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationsListProps {
  notifications: RiderNotification[];
  loading?: boolean;
  onNotificationPress?: (notification: RiderNotification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
}

export default function NotificationsList({
  notifications,
  loading = false,
  onNotificationPress,
  onMarkAsRead,
  onDismiss,
}: NotificationsListProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_assigned':
        return <Package size={20} color="#ff8c00" />;
      case 'pickup_ready':
        return <CheckCircle size={20} color="#10b981" />;
      case 'delivery_update':
        return <Clock size={20} color="#3b82f6" />;
      case 'bonus':
        return <Gift size={20} color="#f59e0b" />;
      case 'alert':
        return <AlertCircle size={20} color="#ef4444" />;
      default:
        return <Bell size={20} color="#64748b" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order_assigned':
        return '#fff7ed';
      case 'pickup_ready':
        return '#f0fdf4';
      case 'delivery_update':
        return '#eff6ff';
      case 'bonus':
        return '#fef3c7';
      case 'alert':
        return '#fee2e2';
      default:
        return '#f8fafc';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  const handlePress = (notification: RiderNotification) => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  const handleDismiss = (notificationId: string, event: any) => {
    event.stopPropagation();
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  const renderNotification = ({ item }: { item: RiderNotification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handlePress(item)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) }]}>
        {getNotificationIcon(item.type)}
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={(e) => handleDismiss(item.id, e)}
          >
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.message} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Bell size={48} color="#cbd5e1" />
        <Text style={styles.emptyText}>No notifications yet</Text>
        <Text style={styles.emptySubtext}>You'll see updates about your deliveries here</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={notifications}
      renderItem={renderNotification}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#ff8c00',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff8c00',
  },
});

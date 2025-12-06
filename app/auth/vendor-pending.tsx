import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function VendorPendingScreen() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <LinearGradient colors={['#ff8c00', '#e67e00', '#cc7000']} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Clock size={64} color="#ffffff" />
        </View>

        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.subtitle}>
          Thank you for registering as a vendor! Your application is currently being reviewed by our
          admin team.
        </Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What happens next?</Text>
          <Text style={styles.infoText}>
            1. Our team will review your business information{'\n'}
            2. We may contact you for additional details{'\n'}
            3. You'll receive an email once approved{'\n'}
            4. After approval, you can access your vendor dashboard
          </Text>
        </View>

        <Text style={styles.waitTime}>This usually takes 24-48 hours</Text>

        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#d1fae5',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#d1fae5',
    lineHeight: 22,
  },
  waitTime: {
    fontSize: 14,
    color: '#fef3c7',
    fontStyle: 'italic',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Star, Clock, MapPin } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { Vendor } from '@/types/database';

interface RestaurantCardProps {
  restaurant: Vendor;
  onPress: () => void;
}

export default function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const [fontsLoaded] = useFonts({
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  const businessName = restaurant.business_name || 'Restaurant';
  const firstLetter = businessName.charAt(0).toUpperCase();
  const rating = Number(restaurant.rating) || 0;
  const minOrder = Number(restaurant.minimum_order) || 0;

  if (!fontsLoaded) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {restaurant.logo_url ? (
        <Image source={{ uri: restaurant.logo_url }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, styles.logoPlaceholder]}>
          <Text style={styles.logoText}>{firstLetter}</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {businessName}
        </Text>

        {restaurant.description && (
          <Text style={styles.description} numberOfLines={2}>
            {restaurant.description}
          </Text>
        )}

        {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
          <Text style={styles.cuisineText}>
            {restaurant.cuisine_types.slice(0, 3).join(' • ')}
          </Text>
        )}

        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Star size={14} color="#fbbf24" fill="#fbbf24" />
            <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
          </View>

          {restaurant.average_preparation_time && (
            <View style={styles.metaItem}>
              <Clock size={14} color="#64748b" />
              <Text style={styles.metaText}>{restaurant.average_preparation_time} min</Text>
            </View>
          )}

          {restaurant.city && (
            <View style={styles.metaItem}>
              <MapPin size={14} color="#64748b" />
              <Text style={styles.metaText}>{restaurant.city}</Text>
            </View>
          )}
        </View>

        {minOrder > 0 && (
          <Text style={styles.minOrder}>Min. order: ${minOrder.toFixed(2)}</Text>
        )}

        {!restaurant.is_accepting_orders && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>Closed</Text>
          </View>
        )}

        {restaurant.is_currently_open === false && restaurant.is_accepting_orders && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>Currently Closed</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  logoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff8c00',
  },
  logoText: {
    fontSize: 64,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ffffff',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1f2937',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 10,
  },
  cuisineText: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: '#ff8c00',
    marginBottom: 10,
  },
  metaContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#64748b',
  },
  minOrder: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#94a3b8',
    marginTop: 4,
  },
  closedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closedText: {
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
    color: '#dc2626',
  },
});

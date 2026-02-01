import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Clock, Sun, Utensils, Moon } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { supabase } from '@/lib/supabase';
import { Vendor, Category } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import RestaurantCard from '@/components/RestaurantCard';

export default function CustomerHome() {
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [restaurants, setRestaurants] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMealTime, setSelectedMealTime] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
  });

  useEffect(() => {
    fetchCategories();
    fetchRestaurants();

    const subscription = supabase
      .channel('vendors_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vendors',
        },
        (payload) => {
          setRestaurants((prev) =>
            prev.map((restaurant) =>
              restaurant.id === payload.new.id ? (payload.new as Vendor) : restaurant
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .eq('is_verified', true);

      const { data, error } = await query.order('rating', { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRestaurant = (restaurantId: string) => {
    router.push(`/restaurant/${restaurantId}`);
  };

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch = restaurant.business_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    if (!selectedCategory) return matchesSearch;

    const matchesCategory =
      restaurant.cuisine_types?.some((type) =>
        categories
          .find((cat) => cat.id === selectedCategory)
          ?.name.toLowerCase()
          .includes(type.toLowerCase())
      ) || false;

    return matchesSearch && matchesCategory;
  });

  const renderHeader = () => (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.greeting}>Hello, {profile?.full_name || 'Guest'}</Text>
        <Text style={styles.subtitle}>What would you like to order today?</Text>

        <View style={styles.searchContainer}>
          <Search size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food or vendor..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.scheduledMealsSection}>
        <View style={styles.sectionHeader}>
          <Clock size={20} color="#1e293b" />
          <Text style={styles.sectionTitle}>Schedule Your Meal</Text>
        </View>
        <Text style={styles.sectionSubtitle}>Choose your preferred meal time</Text>

        <View style={styles.mealTimesContainer}>
          <TouchableOpacity
            style={[
              styles.mealTimeCard,
              selectedMealTime === 'breakfast' && styles.mealTimeCardActive,
            ]}
            onPress={() => setSelectedMealTime(selectedMealTime === 'breakfast' ? null : 'breakfast')}
          >
            <View style={[
              styles.mealTimeIcon,
              selectedMealTime === 'breakfast' && styles.mealTimeIconActive,
            ]}>
              <Sun size={24} color={selectedMealTime === 'breakfast' ? '#ffffff' : '#ff8c00'} />
            </View>
            <Text style={[
              styles.mealTimeName,
              selectedMealTime === 'breakfast' && styles.mealTimeNameActive,
            ]}>
              BREAKFAST
            </Text>
            <Text style={[
              styles.mealTimeInfo,
              selectedMealTime === 'breakfast' && styles.mealTimeInfoActive,
            ]}>
              Order before 7 am
            </Text>
            <Text style={[
              styles.mealTimeDelivery,
              selectedMealTime === 'breakfast' && styles.mealTimeDeliveryActive,
            ]}>
              Delivered before 8 am
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mealTimeCard,
              selectedMealTime === 'lunch' && styles.mealTimeCardActive,
            ]}
            onPress={() => setSelectedMealTime(selectedMealTime === 'lunch' ? null : 'lunch')}
          >
            <View style={[
              styles.mealTimeIcon,
              selectedMealTime === 'lunch' && styles.mealTimeIconActive,
            ]}>
              <Utensils size={24} color={selectedMealTime === 'lunch' ? '#ffffff' : '#ff8c00'} />
            </View>
            <Text style={[
              styles.mealTimeName,
              selectedMealTime === 'lunch' && styles.mealTimeNameActive,
            ]}>
              LUNCH
            </Text>
            <Text style={[
              styles.mealTimeInfo,
              selectedMealTime === 'lunch' && styles.mealTimeInfoActive,
            ]}>
              Order before 11 am
            </Text>
            <Text style={[
              styles.mealTimeDelivery,
              selectedMealTime === 'lunch' && styles.mealTimeDeliveryActive,
            ]}>
              Delivered before 12 pm
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mealTimeCard,
              selectedMealTime === 'dinner' && styles.mealTimeCardActive,
            ]}
            onPress={() => setSelectedMealTime(selectedMealTime === 'dinner' ? null : 'dinner')}
          >
            <View style={[
              styles.mealTimeIcon,
              selectedMealTime === 'dinner' && styles.mealTimeIconActive,
            ]}>
              <Moon size={24} color={selectedMealTime === 'dinner' ? '#ffffff' : '#ff8c00'} />
            </View>
            <Text style={[
              styles.mealTimeName,
              selectedMealTime === 'dinner' && styles.mealTimeNameActive,
            ]}>
              DINNER
            </Text>
            <Text style={[
              styles.mealTimeInfo,
              selectedMealTime === 'dinner' && styles.mealTimeInfoActive,
            ]}>
              Order before 5 pm
            </Text>
            <Text style={[
              styles.mealTimeDelivery,
              selectedMealTime === 'dinner' && styles.mealTimeDeliveryActive,
            ]}>
              Delivered before 7 pm
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.restaurantsHeader}>
        <Text style={styles.restaurantsTitle}>Available Restaurants</Text>
      </View>
    </>
  );

  if (!fontsLoaded) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff8c00" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredRestaurants}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.restaurantList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RestaurantCard restaurant={item} onPress={() => openRestaurant(item.id)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 20,
    paddingBottom: 28,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  greeting: {
    fontSize: 28,
    fontFamily: 'Poppins-ExtraBold',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#e0f2fe',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    borderWidth: 0,
    outlineWidth: 0,
  },
  categoriesWrapper: {
    paddingVertical: 24,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryChipActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  categoryText: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: '#475569',
    letterSpacing: 0.3,
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  scheduledMealsSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
    marginBottom: 16,
  },
  mealTimesContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  mealTimeCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  mealTimeCardActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mealTimeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff5e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTimeIconActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  mealTimeName: {
    fontSize: 13,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  mealTimeNameActive: {
    color: '#ffffff',
  },
  mealTimeInfo: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#64748b',
    marginBottom: 2,
  },
  mealTimeInfoActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mealTimeDelivery: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#94a3b8',
  },
  mealTimeDeliveryActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  restaurantsHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  restaurantsTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-ExtraBold',
    color: '#1e293b',
    letterSpacing: 0.3,
  },
});

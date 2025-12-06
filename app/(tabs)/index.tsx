import { useAuth } from '@/contexts/AuthContext';
import CustomerHome from '@/components/home/CustomerHome';
import VendorHome from '@/components/home/VendorHome';
import AdminHome from '@/components/home/AdminHome';
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function HomeScreen() {
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.role === 'rider') {
      router.replace('/(tabs)/rider');
    }
  }, [profile]);

  if (!profile) {
    return null;
  }

  if (profile.role === 'vendor') {
    return <VendorHome />;
  }

  if (profile.role === 'admin') {
    return <AdminHome />;
  }

  if (profile.role === 'rider') {
    return null;
  }

  return <CustomerHome />;
}

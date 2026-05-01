import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getCurrentUser } from '../services/auth';
import { getApartment, getApartmentMembers } from '../services/apartments';
import { getChores } from '../services/chores';
import { useAuthStore } from '../store/authStore';
import { useApartmentStore } from '../store/apartmentStore';
import AuthScreen from '../screens/AuthScreen';
import ApartmentScreen from '../screens/ApartmentScreen';
import AppNavigator from './AppNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

export default function RootNavigator() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const { apartment, setApartment, setMembers, setChores } = useApartmentStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await getCurrentUser(firebaseUser.uid);
        if (appUser) {
          setUser(appUser);
          if (appUser.apartmentId) {
            const apt = await getApartment(appUser.apartmentId);
            if (apt) {
              setApartment(apt);
              const [fetchedMembers, fetchedChores] = await Promise.all([
                getApartmentMembers(apt.id),
                getChores(apt.id),
              ]);
              setMembers(fetchedMembers);
              setChores(fetchedChores);
            }
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading, setApartment, setMembers, setChores]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading ChoreShare..." />;
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthScreen />
      ) : !user.apartmentId || !apartment ? (
        <ApartmentScreen />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}

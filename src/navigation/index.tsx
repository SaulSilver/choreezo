import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { getApartment, getApartmentMembers } from '../services/apartments';
import { getChores } from '../services/chores';
import { useProfileStore } from '../store/profileStore';
import { useApartmentStore } from '../store/apartmentStore';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ApartmentScreen from '../screens/ApartmentScreen';
import AppNavigator from './AppNavigator';
import LoadingSpinner from '../components/LoadingSpinner';

export default function RootNavigator() {
  const { userId, name, apartmentId, isLoading, loadProfile } = useProfileStore();
  const { apartment, setApartment, setMembers, setChores } = useApartmentStore();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!apartmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const apt = await getApartment(apartmentId);
        if (cancelled || !apt) return;
        setApartment(apt);
        const [fetchedMembers, fetchedChores] = await Promise.all([
          getApartmentMembers(apt.id),
          getChores(apt.id),
        ]);
        if (cancelled) return;
        setMembers(fetchedMembers);
        setChores(fetchedChores);
      } catch (error) {
        console.error('Failed to load apartment data', error);
      }
    })();
    return () => { cancelled = true; };
  }, [apartmentId, setApartment, setMembers, setChores]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading ChoreShare..." />;
  }

  return (
    <NavigationContainer>
      {!name || !userId ? (
        <ProfileSetupScreen />
      ) : !apartmentId || !apartment ? (
        <ApartmentScreen />
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}

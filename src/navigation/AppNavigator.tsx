import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import WeeklyScheduleScreen from '../screens/WeeklyScheduleScreen';
import MyChoresScreen from '../screens/MyChoresScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EditAssignmentScreen from '../screens/EditAssignmentScreen';

export type AppStackParamList = {
  Tabs: undefined;
  EditAssignment: { assignmentId: string };
};

type TabParamList = {
  WeeklySchedule: undefined;
  MyChores: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
      }}
    >
      <Tab.Screen
        name="WeeklySchedule"
        component={WeeklyScheduleScreen}
        options={{
          title: 'This Week',
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📅</Text>,
        }}
      />
      <Tab.Screen
        name="MyChores"
        component={MyChoresScreen}
        options={{
          title: 'My Chores',
          tabBarLabel: 'My Chores',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✅</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#FFFFFF' }, headerTitleStyle: { fontWeight: '700', color: '#1F2937' } }}>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="EditAssignment"
        component={EditAssignmentScreen}
        options={{
          title: 'Edit Assignment',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '700', color: '#1F2937' },
        }}
      />
    </Stack.Navigator>
  );
}

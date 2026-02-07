import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCurrentUser } from '../lib/api';
import { LoginScreen } from '../screens/LoginScreen';
import { WorkplacesScreen } from '../screens/WorkplacesScreen';
import { ActivityIndicator, View } from 'react-native';

export type RootStackParamList = {
  Login: undefined;
  Workplaces: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {user ? (
        <Stack.Screen
          name="Workplaces"
          component={WorkplacesScreen}
          options={{ title: 'Workplaces' }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

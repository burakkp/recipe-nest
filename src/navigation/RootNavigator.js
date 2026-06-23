import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import SavedScreen from '../screens/SavedScreen';
import DetailScreen from '../screens/DetailScreen';
import FolderScreen from '../screens/FolderScreen';
import ShareImportScreen from '../screens/ShareImportScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Feed: { active: 'home', inactive: 'home-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Saved: { active: 'bookmark', inactive: 'bookmark-outline' },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.screen },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name].active : TAB_ICONS[route.name].inactive}
            size={size}
            color={color}
          />
        ),
        tabBarLabel: ({ color, focused, children }) => (
          <Text style={{ color, fontSize: 10, fontWeight: focused ? '700' : '600' }}>
            {children}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.screen } }}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Detail" component={DetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Folder" component={FolderScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ShareImport"
        component={ShareImportScreen}
        options={{ presentation: 'modal', title: 'Import Recipe' }}
      />
    </Stack.Navigator>
  );
}

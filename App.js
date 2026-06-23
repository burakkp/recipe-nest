import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { SavedProvider } from './src/context/SavedContext';
import RootNavigator from './src/navigation/RootNavigator';

export const navigationRef = createNavigationContainerRef();

function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent || !navigationRef.isReady()) return;
    const shared = shareIntent.webUrl || shareIntent.text;
    if (shared) {
      navigationRef.navigate('ShareImport', {
        url: shareIntent.webUrl || null,
        text: shareIntent.text || null,
      });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider>
        <SavedProvider>
          <NavigationContainer ref={navigationRef}>
            <ShareIntentHandler />
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="auto" />
        </SavedProvider>
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './src/App';

// Configure root notification handler immediately upon JS bundle initialization
// Ensures notifications received when the app is in the background or killed are displayed
if (Platform.OS !== 'web') {
  try {
    const Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch {
    // Ignore in unsupported environments
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

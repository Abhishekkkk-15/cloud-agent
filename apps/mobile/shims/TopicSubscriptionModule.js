'use strict';

// Safe shim for ExpoTopicSubscriptionModule to allow expo-notifications to load safely in Expo Go
let nativeModule = null;
try {
  const { requireNativeModule } = require('expo');
  nativeModule = requireNativeModule('ExpoTopicSubscriptionModule');
} catch (e) {
  // Gracefully fallback when running inside Expo Go where ExpoTopicSubscriptionModule is absent
  nativeModule = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(),
    unsubscribeFromTopicAsync: () => Promise.resolve(),
  };
}

module.exports = nativeModule;
module.exports.default = nativeModule;

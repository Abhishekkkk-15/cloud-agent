import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { colors } from './theme/tokens';
import { SidebarDrawer, AppScreen } from './components/SidebarDrawer';
import { NotificationBanner } from './components/NotificationBanner';
import { MachineHealthScreen } from './screens/MachineHealthScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { AgentTurnScreen } from './screens/AgentTurnScreen';
import { SessionsScreen } from './screens/SessionsScreen';
import { AuthScreen } from './screens/AuthScreen';
import { useDaemonStore } from './stores/useDaemonStore';

export default function App() {
  // Default screen is Chat with the last opened session
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('agent');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const init = useDaemonStore((s) => s.init);
  const isAuthenticated = useDaemonStore((s) => s.isAuthenticated);
  const isInitializingAuth = useDaemonStore((s) => s.isInitializingAuth);
  const token = useDaemonStore((s) => s.token);

  useEffect(() => {
    init();
  }, [init]);

  // Left-edge swipe responder to smoothly slide open the sidebar drawer
  const edgeSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx;
        return (
          !isDrawerOpen &&
          startX <= 50 &&
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3
        );
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const startX = evt.nativeEvent.pageX - gestureState.dx;
        return (
          !isDrawerOpen &&
          startX <= 50 &&
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3
        );
      },
      onPanResponderGrant: () => {
        setIsDrawerOpen(true);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 15 || gestureState.vx > 0.2) {
          setIsDrawerOpen(true);
        }
      },
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  // While restoring persisted auth session from storage, prevent flash of AuthScreen
  if (isInitializingAuth) {
    return (
      <View style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' }]}>
        <ExpoStatusBar style="light" />
        <ActivityIndicator size="small" color="#fafafa" />
      </View>
    );
  }

  // If not authenticated, present the clean AuthScreen
  if (!isAuthenticated && !token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ExpoStatusBar style="light" />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />

      {/* Main Screens with edge swipe gesture support */}
      <View style={styles.screenContainer} {...edgeSwipePanResponder.panHandlers}>
        {currentScreen === 'agent' && (
          <AgentTurnScreen
            onBack={() => setIsDrawerOpen(true)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            onNavigateTab={(tab) => setCurrentScreen(tab as AppScreen)}
          />
        )}
        {currentScreen === 'health' && (
          <MachineHealthScreen
            onBack={() => setCurrentScreen('agent')}
            onNavigateTab={(tab) => setCurrentScreen(tab as AppScreen)}
          />
        )}
        {currentScreen === 'approvals' && (
          <ApprovalsScreen
            onBack={() => setCurrentScreen('agent')}
            onNavigateTab={(tab) => setCurrentScreen(tab as AppScreen)}
          />
        )}
        {currentScreen === 'sessions' && (
          <SessionsScreen
            onBack={() => setCurrentScreen('agent')}
            onSelectSession={() => setCurrentScreen('agent')}
          />
        )}
      </View>

      {/* Swipeable Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentScreen={currentScreen}
        onNavigateScreen={(screen) => setCurrentScreen(screen)}
      />

      {/* Global In-App Notification Toast */}
      <NotificationBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  }
});

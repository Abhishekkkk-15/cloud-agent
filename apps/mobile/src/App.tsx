import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  PanResponder,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from './theme/tokens';
import { SidebarDrawer, AppScreen } from './components/SidebarDrawer';
import { NotificationBanner } from './components/NotificationBanner';
import { MachineHealthScreen } from './screens/MachineHealthScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { AgentTurnScreen } from './screens/AgentTurnScreen';
import { SessionsScreen } from './screens/SessionsScreen';
import { AuthScreen } from './screens/AuthScreen';
import { useDaemonStore } from './stores/useDaemonStore';
import { mobileP2P } from './lib/p2p-client';

function MainApp() {
  // Default screen is Chat with the last opened session
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('agent');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const init = useDaemonStore((s) => s.init);
  const isAuthenticated = useDaemonStore((s) => s.isAuthenticated);
  const isInitializingAuth = useDaemonStore((s) => s.isInitializingAuth);
  const token = useDaemonStore((s) => s.token);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  useEffect(() => {
    init();
    if (Platform.OS === 'android') {
      (StatusBar as any).setTranslucent?.(true);
      (StatusBar as any).setBackgroundColor?.('transparent');
      StatusBar.setBarStyle(isLight ? 'dark-content' : 'light-content');
    }
  }, [init, isLight]);

  // Auto-reconnect and session reconciliation when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const store = useDaemonStore.getState();
        if (store.token) {
          if (store.connectionState !== 'connected') {
            mobileP2P.reconnectNow();
          } else {
            store.reconcileActiveSession();
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Left-edge swipe responder to smoothly slide open the sidebar drawer
  const edgeSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return (
          gestureState.dx > 15 &&
          Math.abs(gestureState.dy) < 35 &&
          gestureState.moveX < 45
        );
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return (
          gestureState.dx > 15 &&
          Math.abs(gestureState.dy) < 35 &&
          gestureState.moveX < 45
        );
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 25) {
          setIsDrawerOpen(true);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 15 || gestureState.vx > 0.2) {
          setIsDrawerOpen(true);
        }
      },
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  return (
    <View style={[styles.rootContainer, isLight && { backgroundColor: '#ffffff' }]}>
      <ExpoStatusBar style={isLight ? "dark" : "light"} />

      {isInitializingAuth ? (
        <View style={[styles.rootContainer, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="small" color={isLight ? "#0077b6" : "#fafafa"} />
        </View>
      ) : !isAuthenticated && !token ? (
        <AuthScreen />
      ) : (
        <>
          {/* Main Screens with edge swipe gesture support */}
          <View
            style={[
              styles.screenContainer,
              isLight && { backgroundColor: '#f6f8fa' },
            ]}
            {...edgeSwipePanResponder.panHandlers}
          >
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
        </>
      )}

      {/* Global In-App Notification Toast (Mounted across All Screens, Auth & Modals) */}
      <NotificationBanner onNavigate={(screen) => setCurrentScreen(screen)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});

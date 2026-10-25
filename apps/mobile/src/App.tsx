import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  PanResponder,
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
  const token = useDaemonStore((s) => s.token);

  useEffect(() => {
    init();
  }, [init]);

  // Left-edge swipe responder to smoothly slide open the sidebar drawer (called unconditionally)
  const edgePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx > 15 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 25 || gestureState.vx > 0.3) {
          setIsDrawerOpen(true);
        }
      },
    })
  ).current;

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

      {/* Edge Swipe Detection Zone for opening drawer */}
      {!isDrawerOpen && (
        <View
          style={styles.edgeGestureStrip}
          {...edgePanResponder.panHandlers}
          pointerEvents="box-only"
        />
      )}

      {/* Main Screens */}
      <View style={styles.screenContainer}>
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
  },
  edgeGestureStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 24,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
});

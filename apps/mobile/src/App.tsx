import './global.css';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  PanResponder,
  AppState,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PanelUIProvider, PanelUITheme, Spinner, Text } from 'panelui-native';
import { colors } from './theme/tokens';
import { SidebarDrawer, AppScreen } from './components/SidebarDrawer';
import { NotificationBanner } from './components/NotificationBanner';
import { OfflineBanner } from './components/OfflineBanner';
import { MachineHealthScreen } from './screens/MachineHealthScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { AgentTurnScreen } from './screens/AgentTurnScreen';
import { SessionsScreen } from './screens/SessionsScreen';
import { AuthScreen, CloudAgentLogo } from './screens/AuthScreen';
import { useDaemonStore } from './stores/useDaemonStore';
import { mobileP2P } from './lib/p2p-client';
import { isRunningInExpoGo } from './lib/notifications';

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

  // Synchronize PanelUI and Uniwind with store theme
  useEffect(() => {
    PanelUITheme.setTheme(theme);
  }, [theme]);

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

  // Listen for push notification lock-screen quick actions and deep linking
  useEffect(() => {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return;
    try {
      const Notifications = require('expo-notifications');
      if (!Notifications?.addNotificationResponseReceivedListener) return;

      const handleNotificationResponse = async (response: any) => {
        if (!response) return;
        const actionIdentifier = response.actionIdentifier;
        const data = response.notification?.request?.content?.data || {};
        const store = useDaemonStore.getState();

        // 1. Interactive Lock-Screen Quick Actions (APPROVE / REJECT)
        if (actionIdentifier === 'APPROVE' || actionIdentifier === 'REJECT') {
          const isAllowed = actionIdentifier === 'APPROVE';
          const machineId = data.machineId || store.activeMachine?.machineId;
          const approvalId = data.approvalId;

          // Dispatch to Gateway HTTP bridge immediately
          if (machineId && approvalId) {
            const cleanGw = (store.gatewayUrl || '').replace(/\/+$/, '');
            fetch(`${cleanGw}/api/machines/${machineId}/approve`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
              },
              body: JSON.stringify({ approvalId, allowed: isAllowed }),
            }).catch((err) => console.warn('[NotificationAction] Gateway approve error:', err));
          }

          // If connected via WebRTC, also trigger store handler
          if (store.connectionState === 'connected') {
            store.respondApproval(isAllowed).catch(() => {});
          } else {
            store.dismissPendingApproval();
          }
          return;
        }

        // 2. Notification Card Tap (Deep Linking)
        if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER || !actionIdentifier) {
          // Switch to target machine if provided and different
          if (data.machineId && data.machineId !== store.activeMachine?.machineId) {
            const matched = store.machines.find((m) => m.machineId === data.machineId);
            if (matched) {
              await store.selectMachine(matched);
            }
          }

          // Switch to target session if provided
          if (data.sessionId) {
            const matchedSession = store.sessions.find((s) => s.id === data.sessionId);
            if (matchedSession) {
              await store.selectSession(matchedSession);
            } else {
              store.subscribeToSessionStream(data.sessionId);
            }
          }

          // If approval required, restore approval state
          if (data.type === 'approval_required' && data.approvalId) {
            store.setPendingApproval({
              id: data.approvalId,
              sessionId: data.sessionId,
              tool: data.tool || 'bash',
              command: data.command || '',
              description: 'Elevated command requires approval',
              requestedAt: 'Just now',
              targetNode: store.activeMachine?.name || 'Remote Host',
              caller: 'Google Antigravity CLI',
              riskLevel: 'high',
            });
          }

          setCurrentScreen('agent');
          setIsDrawerOpen(false);
        }
      };

      const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

      // Check cold-start launch response
      if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
        Notifications.getLastNotificationResponseAsync()
          .then((last: any) => {
            if (last) handleNotificationResponse(last);
          })
          .catch(() => {});
      }

      return () => {
        sub?.remove?.();
      };
    } catch (err) {
      console.warn('[Notifications] Deep link response listener setup failed:', err);
    }
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
        <View className="flex-1 bg-background items-center justify-center p-6 gap-4">
          <CloudAgentLogo color={isLight ? '#262626' : '#f5f5f5'} size={110} />
          <Spinner size="lg" />
          <Text className="text-xs font-medium text-muted-foreground tracking-wide mt-2">
            Initializing Cloud Agent...
          </Text>
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

      {/* Global Network Offline Banner */}
      <OfflineBanner />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PanelUIProvider>
        <MainApp />
      </PanelUIProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#141414',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#141414',
  },
});

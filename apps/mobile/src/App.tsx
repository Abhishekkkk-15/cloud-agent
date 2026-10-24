import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, Platform } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { colors } from './theme/tokens';
import { BottomNavBar, TabId } from './components/BottomNavBar';
import { MachineHealthScreen } from './screens/MachineHealthScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { AgentTurnScreen } from './screens/AgentTurnScreen';
import { SessionsScreen } from './screens/SessionsScreen';
import { useDaemonStore } from './stores/useDaemonStore';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('health');
  const init = useDaemonStore((s) => s.init);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <View style={styles.screenContainer}>
        {activeTab === 'health' && (
          <MachineHealthScreen
            onNavigateTab={(tab) => setActiveTab(tab as TabId)}
          />
        )}
        {activeTab === 'approvals' && (
          <ApprovalsScreen
            onBack={() => setActiveTab('health')}
            onNavigateTab={(tab) => setActiveTab(tab as TabId)}
          />
        )}
        {activeTab === 'agent' && (
          <AgentTurnScreen
            onBack={() => setActiveTab('health')}
            onNavigateTab={(tab) => setActiveTab(tab as TabId)}
          />
        )}
        {activeTab === 'sessions' && (
          <SessionsScreen
            onBack={() => setActiveTab('health')}
            onSelectSession={() => setActiveTab('agent')}
          />
        )}
      </View>

      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingApprovalsCount={pendingApproval ? 1 : 0}
      />
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
});

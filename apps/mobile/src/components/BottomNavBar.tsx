import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Activity, ShieldAlert, Bot, Layers } from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

export type TabId = 'health' | 'approvals' | 'agent' | 'sessions';

interface BottomNavBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  pendingApprovalsCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onSelectTab,
  pendingApprovalsCount = 0,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  return (
    <View style={[styles.container, isLight && styles.containerLight]}>
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('health')}
        activeOpacity={0.7}
      >
        <Activity
          size={20}
          color={activeTab === 'health' ? colors.green : (isLight ? '#6e7681' : colors.textMuted)}
        />
        <Text
          style={[
            styles.tabLabel,
            isLight && { color: '#6e7681' },
            activeTab === 'health' && { color: colors.green, fontWeight: '700' },
          ]}
        >
          Health
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('approvals')}
        activeOpacity={0.7}
      >
        <View>
          <ShieldAlert
            size={20}
            color={activeTab === 'approvals' ? colors.red : (isLight ? '#6e7681' : colors.textMuted)}
          />
          {pendingApprovalsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingApprovalsCount}</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.tabLabel,
            isLight && { color: '#6e7681' },
            activeTab === 'approvals' && { color: colors.red, fontWeight: '700' },
          ]}
        >
          Approvals
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('agent')}
        activeOpacity={0.7}
      >
        <View style={activeTab === 'agent' ? (isLight ? styles.activePillLight : styles.activePill) : styles.iconWrapper}>
          <Bot
            size={18}
            color={activeTab === 'agent' ? '#ffffff' : (isLight ? '#6e7681' : '#8d96a0')}
          />
        </View>
        <Text
          style={[
            styles.tabLabel,
            isLight && { color: '#6e7681' },
            activeTab === 'agent' && (isLight ? styles.activeTabLabelLight : styles.activeTabLabel),
          ]}
        >
          Agent
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('sessions')}
        activeOpacity={0.7}
      >
        <Layers
          size={20}
          color={activeTab === 'sessions' ? (isLight ? '#0077b6' : colors.green) : (isLight ? '#6e7681' : colors.textMuted)}
        />
        <Text
          style={[
            styles.tabLabel,
            isLight && { color: '#6e7681' },
            activeTab === 'sessions' && { color: isLight ? '#0077b6' : colors.green, fontWeight: '700' },
          ]}
        >
          Sessions
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 62,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d0d7de',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: colors.greenBg,
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePillLight: {
    backgroundColor: '#0077b6',
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    color: '#8d96a0',
    marginTop: 3,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: '#fafafa',
    fontWeight: '700',
  },
  activeTabLabelLight: {
    color: '#0077b6',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#f85149',
    borderRadius: radii.full,
    paddingHorizontal: 4,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
});

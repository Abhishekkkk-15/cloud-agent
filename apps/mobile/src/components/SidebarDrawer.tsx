import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Cpu,
  Layers,
  Terminal,
  Radio,
  Server,
  Sparkles,
  Search,
  LogOut,
  Folder,
  Pin,
  MoreHorizontal,
  X,
  Globe,
  ChevronDown,
  Bell,
} from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';
import { NewChatWorkspaceSheet } from './NewChatWorkspaceSheet';
import { PairMachineModal } from './PairMachineModal';
import { MachineSwitcherModal } from './MachineSwitcherModal';
import { FolderPickerModal } from './FolderPickerModal';
import { SessionActionModal } from './SessionActionModal';
import { ServerSettingsModal } from './ServerSettingsModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 340);

export type AppScreen = 'agent' | 'health' | 'approvals' | 'sessions';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: AppScreen;
  onNavigateScreen: (screen: AppScreen) => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  isOpen,
  onClose,
  currentScreen,
  onNavigateScreen,
}) => {
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const machines = useDaemonStore((s) => s.machines);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const sessions = useDaemonStore((s) => s.sessions);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const workspaces = useDaemonStore((s) => s.workspaces);
  const selectedWorkspace = useDaemonStore((s) => s.selectedWorkspace);
  const setSelectedWorkspace = useDaemonStore((s) => s.setSelectedWorkspace);
  const selectSession = useDaemonStore((s) => s.selectSession);
  const createNewSession = useDaemonStore((s) => s.createNewSession);
  const startNewSessionInWorkspace = useDaemonStore((s) => s.startNewSessionInWorkspace);
  const logout = useDaemonStore((s) => s.logout);
  const currentUser = useDaemonStore((s) => s.currentUser);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);

  const [activeFilterWs, setActiveFilterWs] = useState<string>('all');
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [actionSession, setActionSession] = useState<RealSessionItem | null>(null);
  const [showNewChatSheet, setShowNewChatSheet] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showMachineSwitcher, setShowMachineSwitcher] = useState<boolean>(false);
  const [showDirectFolderPicker, setShowDirectFolderPicker] = useState<boolean>(false);
  const [showServerSettings, setShowServerSettings] = useState<boolean>(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, backdropAnim]);

  // Pan responder for swiping left to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -15 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          slideAnim.setValue(Math.max(gestureState.dx, -DRAWER_WIDTH));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60 || gestureState.vx < -0.4) {
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const handleNewChat = () => {
    setShowNewChatSheet(true);
  };

  const handleStartSessionInWorkspace = (workspacePath: string) => {
    startNewSessionInWorkspace(workspacePath);
    onNavigateScreen('agent');
    onClose();
  };

  const handleSelectSession = (item: RealSessionItem) => {
    selectSession(item);
    onNavigateScreen('agent');
    onClose();
  };

  const handleNavScreen = (screen: AppScreen) => {
    onNavigateScreen(screen);
    onClose();
  };

  const searchedSessions = sessions.filter((s) => {
    const matchesWs = activeFilterWs === 'all' || s.workspaceName.toLowerCase() === activeFilterWs.toLowerCase();
    const query = drawerSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      s.title.toLowerCase().includes(query) ||
      s.workspaceName.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query);
    return matchesWs && matchesQuery;
  });

  const pinnedSessions = searchedSessions.filter((s) => s.pinned);
  const recentSessions = searchedSessions.filter((s) => !s.pinned);

  const formatTimeAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const renderSessionRow = (item: RealSessionItem) => {
    const isActive = activeSession?.id === item.id && currentScreen === 'agent';
    return (
      <View
        key={item.id}
        style={[styles.sessionItem, isActive && styles.sessionItemActive]}
      >
        <TouchableOpacity
          style={styles.sessionItemContent}
          onPress={() => handleSelectSession(item)}
          activeOpacity={0.7}
        >
          <View style={styles.sessionTitleRow}>
            {item.pinned ? (
              <Pin size={11} color="#0077b6" style={{ marginRight: 5 }} />
            ) : null}
            <Text
              style={[
                styles.sessionTitle,
                isActive && styles.sessionTitleActive,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
          </View>
          <View style={styles.sessionMetaRow}>
            <Text style={styles.sessionWorkspace} numberOfLines={1}>
              {item.workspaceName}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.sessionTime}>
              {formatTimeAgo(item.updatedAt || item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreActionBtn}
          onPress={() => setActionSession(item)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MoreHorizontal size={14} color="#8b949e" />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isOpen) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]} pointerEvents="box-none">
      {/* Dimmed Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.65],
              }),
            },
          ]}
        />
      </TouchableWithoutFeedback>

      {/* Drawer Surface */}
      <Animated.View
        style={[
          styles.drawerContainer,
          {
            width: DRAWER_WIDTH,
            transform: [{ translateX: slideAnim }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 1. Drawer Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.nodeInfo}
            onPress={() => setShowMachineSwitcher(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    activeMachine?.isOnline
                      ? '#3fb950'
                      : connectionState === 'connected'
                      ? colors.primary
                      : '#e3b341',
                },
              ]}
            />
            <View style={styles.nodeTextCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.nodeName} numberOfLines={1}>
                  {activeMachine?.name || daemonStatus?.hostname || 'Local Machine'}
                </Text>
                <ChevronDown size={14} color="#8b949e" />
              </View>
              <Text style={styles.nodeSub} numberOfLines={1}>
                {machines.length > 1
                  ? `${machines.length} machines • Tap to switch`
                  : activeMachine
                  ? `${activeMachine.platform} • ${activeMachine.isOnline ? 'Online' : 'Offline'}`
                  : 'Antigravity CLI'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={18} color="#f0f6fc" />
          </TouchableOpacity>
        </View>

        {/* 2. Primary Actions: + New Chat & + Pair Machine */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={handleNewChat}
            activeOpacity={0.8}
          >
            <View style={styles.newChatIconBox}>
              <Plus size={16} color="#ffffff" />
            </View>
            <Text style={styles.newChatText}>New Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pairMachineBtn}
            onPress={() => setShowPairModal(true)}
            activeOpacity={0.7}
          >
            <Server size={14} color="#8b949e" />
            <Text style={styles.pairMachineText}>Pair Machine</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Workspaces Pill Filter */}
        {workspaces.length > 0 && (
          <View style={styles.workspacesFilterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.workspacePillScroll}
            >
              <TouchableOpacity
                style={[
                  styles.wsPill,
                  activeFilterWs === 'all' && styles.wsPillActive,
                ]}
                onPress={() => setActiveFilterWs('all')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.wsPillText,
                    activeFilterWs === 'all' && styles.wsPillTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {workspaces.map((ws) => (
                <TouchableOpacity
                  key={ws}
                  style={[
                    styles.wsPill,
                    activeFilterWs === ws && styles.wsPillActive,
                  ]}
                  onPress={() => setActiveFilterWs(ws)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.wsPillText,
                      activeFilterWs === ws && styles.wsPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ws}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. Scrollable Sessions & Secondary Navigation */}
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Inline Search Bar */}
          <View style={styles.drawerSearchBox}>
            <Search size={13} color="#8b949e" />
            <TextInput
              style={styles.drawerSearchInput}
              value={drawerSearch}
              onChangeText={setDrawerSearch}
              placeholder="Search sessions..."
              placeholderTextColor="#6e7681"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {drawerSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setDrawerSearch('')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <X size={13} color="#8b949e" />
              </TouchableOpacity>
            )}
          </View>

          {/* Section: Pinned Sessions */}
          {pinnedSessions.length > 0 && (
            <View style={styles.pinnedSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Pin size={11} color="#0077b6" />
                  <Text style={styles.sectionTitle}>PINNED SESSIONS</Text>
                </View>
                <Text style={styles.sectionBadge}>{pinnedSessions.length}</Text>
              </View>
              {pinnedSessions.map((item) => renderSessionRow(item))}
            </View>
          )}

          {/* Section: Recent Sessions */}
          <View style={[styles.sectionHeaderRow, pinnedSessions.length > 0 && { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
            <Text style={styles.sectionBadge}>{recentSessions.length}</Text>
          </View>

          {recentSessions.length === 0 ? (
            <View style={styles.emptySessionsBox}>
              <Text style={styles.emptySessionsText}>
                {drawerSearch ? 'No matching sessions' : 'No active sessions'}
              </Text>
            </View>
          ) : (
            recentSessions.map((item) => renderSessionRow(item))
          )}

          {/* Section: System & Navigation */}
          <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>SYSTEM & MANAGEMENT</Text>
          </View>

          {/* Nav: Security Approvals */}
          <TouchableOpacity
            style={[
              styles.navItem,
              currentScreen === 'approvals' && styles.navItemActive,
            ]}
            onPress={() => handleNavScreen('approvals')}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <ShieldAlert
                size={17}
                color={pendingApproval ? colors.red : '#c9d1d9'}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'approvals' && styles.navLabelActive,
              ]}
            >
              Security Approvals
            </Text>
            {pendingApproval ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>1 Pending</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Nav: Machine Health */}
          <TouchableOpacity
            style={[
              styles.navItem,
              currentScreen === 'health' && styles.navItemActive,
            ]}
            onPress={() => handleNavScreen('health')}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Activity
                size={17}
                color={currentScreen === 'health' ? colors.primary : '#c9d1d9'}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'health' && styles.navLabelActive,
              ]}
            >
              Machine Health & Telemetry
            </Text>
          </TouchableOpacity>

          {/* Nav: All Workspaces */}
          <TouchableOpacity
            style={[
              styles.navItem,
              currentScreen === 'sessions' && styles.navItemActive,
            ]}
            onPress={() => handleNavScreen('sessions')}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Layers
                size={17}
                color={currentScreen === 'sessions' ? colors.primary : '#c9d1d9'}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'sessions' && styles.navLabelActive,
              ]}
            >
              All Transcripts & Workspaces
            </Text>
          </TouchableOpacity>

          {/* Nav: Browse Machine Folders */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setShowDirectFolderPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Folder size={17} color="#c9d1d9" />
            </View>
            <Text style={styles.navLabel}>Browse Machine Folders</Text>
            <ChevronRight size={14} color="#6e7681" />
          </TouchableOpacity>

          {/* Nav: Push Notifications & Server Endpoints */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setShowServerSettings(true)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Bell size={17} color="#c9d1d9" />
            </View>
            <Text style={styles.navLabel}>Push Notifications & Server</Text>
            <ChevronRight size={14} color="#6e7681" />
          </TouchableOpacity>
        </ScrollView>

        {/* 5. Drawer Footer with VPS Status & Sign Out */}
        <View style={styles.footer}>
          <View style={styles.footerStatus}>
            <View style={styles.pingDot} />
            <Text style={styles.footerText}>
              VPS Connected • {pingRtt || '12ms'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <LogOut size={13} color="#8b949e" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Interactive New Chat Workspace Sheet */}
      <NewChatWorkspaceSheet
        visible={showNewChatSheet}
        onClose={() => setShowNewChatSheet(false)}
        onStartSession={handleStartSessionInWorkspace}
      />

      {/* Machine Pairing Modal */}
      <PairMachineModal
        visible={showPairModal}
        onClose={() => setShowPairModal(false)}
      />

      {/* Machine & VPS Switcher Modal */}
      <MachineSwitcherModal
        visible={showMachineSwitcher}
        onClose={() => setShowMachineSwitcher(false)}
        onPairNew={() => setShowPairModal(true)}
      />

      {/* Direct Remote Folder Browser Modal */}
      <FolderPickerModal
        visible={showDirectFolderPicker}
        onClose={() => setShowDirectFolderPicker(false)}
        onSelectFolder={handleStartSessionInWorkspace}
      />

      {/* Server & Network Endpoints Modal */}
      <ServerSettingsModal
        visible={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      {/* Session Action Modal (Rename, Pin, Delete) */}
      <SessionActionModal
        visible={Boolean(actionSession)}
        session={actionSession}
        onClose={() => setActionSession(null)}
        onRename={async (sess, title) => {
          await renameSession(sess.id, title);
        }}
        onTogglePin={async (sess) => {
          await togglePinSession(sess.id);
        }}
        onDelete={async (sess) => {
          await deleteSession(sess.id);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0d1117',
    borderRightWidth: 1,
    borderRightColor: '#21262d',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 210,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  nodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  nodeTextCol: {
    flex: 1,
  },
  nodeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f0f6fc',
    letterSpacing: -0.2,
  },
  nodeSub: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.md,
    height: 42,
    gap: 8,
  },
  newChatIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  pairMachineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: radii.md,
    height: 36,
    gap: 6,
  },
  pairMachineText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8b949e',
  },
  workspacesFilterContainer: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  workspacePillScroll: {
    paddingHorizontal: 14,
    gap: 6,
  },
  wsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  wsPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  wsPillText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  wsPillTextActive: {
    color: '#f0f6fc',
    fontWeight: '600',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  drawerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#21262d',
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 12,
    gap: 8,
  },
  drawerSearchInput: {
    flex: 1,
    height: 36,
    color: '#f0f6fc',
    fontSize: 12,
  },
  pinnedSection: {
    marginBottom: 8,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 0.8,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6e7681',
  },
  emptySessionsBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: 12,
    color: '#6e7681',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  sessionItemActive: {
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sessionItemContent: {
    flex: 1,
    marginRight: 8,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#c9d1d9',
    lineHeight: 18,
    flex: 1,
  },
  sessionTitleActive: {
    color: '#f0f6fc',
    fontWeight: '600',
  },
  moreActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161b22',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  sessionWorkspace: {
    fontSize: 11,
    color: '#8b949e',
    maxWidth: 120,
  },
  metaDot: {
    fontSize: 10,
    color: '#6e7681',
  },
  sessionTime: {
    fontSize: 11,
    color: '#6e7681',
  },
  activeBar: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: 3,
  },
  navItemActive: {
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
  },
  navIconBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  navLabel: {
    fontSize: 13,
    color: '#c9d1d9',
    flex: 1,
  },
  navLabelActive: {
    color: '#f0f6fc',
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: 'rgba(248, 81, 73, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: '#f85149',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#010409',
  },
  footerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  footerText: {
    fontSize: 11,
    color: '#8b949e',
    fontWeight: '500',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  logoutText: {
    fontSize: 11,
    color: '#8b949e',
    fontWeight: '500',
  },
});

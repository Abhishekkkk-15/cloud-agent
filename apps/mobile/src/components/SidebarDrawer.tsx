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
  Platform,
  TouchableWithoutFeedback,
  TextInput,
} from 'react-native';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Activity,
  Cpu,
  Layers,
  Server,
  Search,
  LogOut,
  Folder,
  Pin,
  MoreHorizontal,
  X,
  Bell,
  ChevronsUpDown,
  CheckCircle2,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, RealSessionItem, MachineInfo } from '../stores/useDaemonStore';
import { NewChatWorkspaceSheet } from './NewChatWorkspaceSheet';
import { PairMachineModal } from './PairMachineModal';
import { MachineSwitcherModal } from './MachineSwitcherModal';
import { FolderPickerModal } from './FolderPickerModal';
import { SessionActionModal } from './SessionActionModal';
import { ServerSettingsModal } from './ServerSettingsModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.85), 350);

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
  const selectSession = useDaemonStore((s) => s.selectSession);
  const selectMachine = useDaemonStore((s) => s.selectMachine);
  const startNewSessionInWorkspace = useDaemonStore((s) => s.startNewSessionInWorkspace);
  const logout = useDaemonStore((s) => s.logout);
  const currentUser = useDaemonStore((s) => s.currentUser);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);

  const [activeFilterWs, setActiveFilterWs] = useState<string>('all');
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
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

  // Standby nodes (excluding active)
  const standbyMachines = machines.filter((m) => m.machineId !== activeMachine?.machineId);

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
              <Pin size={11} color={colors.primary} style={{ marginRight: 5 }} />
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
          <MoreHorizontal size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isOpen) return null;

  const operatorInitial = currentUser?.name ? currentUser.name[0].toUpperCase() : 'O';
  const operatorName = currentUser?.name || 'Local Operator';
  const operatorEmail = currentUser?.email || 'local@cloud-agent.internal';

  const cpuCores = daemonStatus?.telemetry?.cpu?.cores || 8;
  const ramGb = daemonStatus?.telemetry?.ram?.totalGb || 32;
  const nodePlatform = activeMachine?.platform || daemonStatus?.platform || 'Host';

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
        {/* 1. Profile Bar (Stitch Screen 1 Style) */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>{operatorInitial}</Text>
              <View style={styles.avatarOnlineDot} />
            </View>
            <View style={styles.profileTextCol}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {operatorName}
                </Text>
                <CheckCircle2 size={13} color={colors.primary} />
              </View>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {operatorEmail}
              </Text>
            </View>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.circleActionBtn}
              onPress={() => setShowSearchInput((prev) => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Search size={15} color={showSearchInput ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.circleActionBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <ChevronLeft size={17} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input Box (Collapsible / Toggleable) */}
        {showSearchInput && (
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={13} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={drawerSearch}
                onChangeText={setDrawerSearch}
                placeholder="Search sessions or workspaces..."
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {drawerSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setDrawerSearch('')}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={13} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Scrollable Content */}
        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Compute Node Fleet Widget (Stitch Screen 1) */}
          <View style={styles.computeNodeSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.computeLabelRow}>
                <Server size={12} color={colors.textMuted} />
                <Text style={styles.computeLabel}>COMPUTE NODE</Text>
              </View>
              <View style={styles.latencyTag}>
                <Text style={styles.latencyTagText}>{pingRtt || '18ms'}</Text>
              </View>
            </View>

            {/* Primary Connected Machine Card */}
            <View style={styles.activeMachineCard}>
              <View style={styles.machineCardTopRow}>
                <View style={styles.machineTitleRow}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.machineHostname} numberOfLines={1}>
                    {activeMachine?.name || daemonStatus?.hostname || 'Local Machine'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.switchNodeBtn}
                  onPress={() => setShowMachineSwitcher(true)}
                  activeOpacity={0.7}
                >
                  <ChevronsUpDown size={12} color={colors.primaryLight} />
                  <Text style={styles.switchNodeText}>Switch</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.machineSpecs} numberOfLines={1}>
                {cpuCores} vCPU • {ramGb}GB RAM • {nodePlatform}
              </Text>
            </View>

            {/* Standby Secondary Nodes Grid (2 Columns) */}
            <View style={styles.standbyGrid}>
              {standbyMachines.slice(0, 2).map((m) => (
                <TouchableOpacity
                  key={m.machineId}
                  style={styles.standbyCard}
                  onPress={() => selectMachine(m)}
                  activeOpacity={0.7}
                >
                  <View style={styles.standbyTopRow}>
                    <View
                      style={[
                        styles.standbyDot,
                        { backgroundColor: m.isOnline ? colors.statusLive : colors.textDisabled },
                      ]}
                    />
                    <Text style={styles.standbyName} numberOfLines={1}>
                      {m.name}
                    </Text>
                  </View>
                  <Text style={styles.standbySub} numberOfLines={1}>
                    {m.platform} • {m.isOnline ? 'Standby' : 'Offline'}
                  </Text>
                </TouchableOpacity>
              ))}
              {standbyMachines.length < 2 && (
                <TouchableOpacity
                  style={styles.standbyAddCard}
                  onPress={() => setShowPairModal(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color={colors.textMuted} />
                  <Text style={styles.standbyAddText}>Pair Node</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3. Primary Action: + New Session */}
          <TouchableOpacity
            style={styles.newSessionBtn}
            onPress={() => setShowNewChatSheet(true)}
            activeOpacity={0.8}
          >
            <View style={styles.newSessionIconCircle}>
              <Plus size={14} color="#ffffff" />
            </View>
            <Text style={styles.newSessionBtnText}>New Session</Text>
          </TouchableOpacity>

          {/* 4. Workspace Carousel Filter */}
          {workspaces.length > 0 && (
            <View style={styles.workspacesCarousel}>
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

          {/* 5. Sessions List */}
          {pinnedSessions.length > 0 && (
            <View style={styles.pinnedSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Pin size={11} color={colors.primary} />
                  <Text style={styles.sectionTitle}>PINNED</Text>
                </View>
                <Text style={styles.sectionBadge}>{pinnedSessions.length}</Text>
              </View>
              {pinnedSessions.map((item) => renderSessionRow(item))}
            </View>
          )}

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

          {/* 6. Management & Navigation Links */}
          <View style={[styles.sectionHeaderRow, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>MANAGEMENT & TOOLS</Text>
          </View>

          {/* Security Approvals */}
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
                color={pendingApproval ? colors.red : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'approvals' && styles.navLabelActive,
              ]}
            >
              Security Approvals & Diff
            </Text>
            {pendingApproval ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>1 Action</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Machine Health & Telemetry */}
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
                color={currentScreen === 'health' ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'health' && styles.navLabelActive,
              ]}
            >
              Machine Health & Fleet
            </Text>
          </TouchableOpacity>

          {/* Workspaces & Fleets Screen */}
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
                color={currentScreen === 'sessions' ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                currentScreen === 'sessions' && styles.navLabelActive,
              ]}
            >
              Workspace & Fleet Tree
            </Text>
          </TouchableOpacity>

          {/* Remote Folder Picker */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setShowDirectFolderPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Folder size={17} color={colors.textSecondary} />
            </View>
            <Text style={styles.navLabel}>Browse Node Folders</Text>
            <ChevronRight size={14} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Server & Notifications Settings */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setShowServerSettings(true)}
            activeOpacity={0.7}
          >
            <View style={styles.navIconBox}>
              <Bell size={17} color={colors.textSecondary} />
            </View>
            <Text style={styles.navLabel}>Push & Server Settings</Text>
            <ChevronRight size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>

        {/* 7. Drawer Footer: VPS Status & Sign Out */}
        <View style={styles.footer}>
          <View style={styles.footerStatus}>
            <View style={styles.pingDot} />
            <Text style={styles.footerText}>
              VPS Connected • {pingRtt || '18ms'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.7}
          >
            <LogOut size={13} color={colors.textMuted} />
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
    backgroundColor: colors.surfaceContainerLowest,
    borderRightWidth: 1,
    borderRightColor: colors.borderMuted,
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 210,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.statusLive,
    borderWidth: 1.5,
    borderColor: colors.surfaceContainerLowest,
  },
  profileTextCol: {
    marginLeft: 10,
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  profileEmail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.surfaceContainerLowest,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingHorizontal: 10,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    color: colors.textPrimary,
    fontSize: 12,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  computeNodeSection: {
    marginBottom: 12,
  },
  computeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  computeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  latencyTag: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  latencyTagText: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.textSecondary,
  },
  activeMachineCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 12,
    marginTop: 6,
  },
  machineCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  machineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.statusLive,
    marginRight: 8,
  },
  machineHostname: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.mono,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  switchNodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  switchNodeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  machineSpecs: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
    fontFamily: typography.mono,
  },
  standbyGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  standbyCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    padding: 8,
  },
  standbyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  standbyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  standbyName: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.mono,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  standbySub: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 3,
  },
  standbyAddCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 10,
  },
  standbyAddText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    height: 40,
    gap: 8,
    marginBottom: 10,
  },
  newSessionIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSessionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  workspacesCarousel: {
    marginBottom: 8,
  },
  workspacePillScroll: {
    gap: 6,
  },
  wsPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  wsPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  wsPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  wsPillTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
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
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  emptySessionsBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptySessionsText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radii.md,
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  sessionItemActive: {
    backgroundColor: colors.primarySubtle,
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
    color: colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  sessionTitleActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  moreActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  sessionWorkspace: {
    fontSize: 10,
    color: colors.textMuted,
    maxWidth: 110,
  },
  metaDot: {
    fontSize: 9,
    color: colors.textDisabled,
  },
  sessionTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radii.md,
    marginBottom: 3,
  },
  navItemActive: {
    backgroundColor: colors.primarySubtle,
  },
  navIconBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  navLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  navLabelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    color: colors.red,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.bgCanvasInset,
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
    backgroundColor: colors.statusLive,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    fontFamily: typography.mono,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  logoutText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
});

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Activity,
  Cpu,
  Layers,
  Server,
  Search,
  LogOut,
  Folder,
  FolderGit2,
  Pin,
  MoreVertical,
  X,
  Bell,
  ChevronsUpDown,
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
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const machines = useDaemonStore((s) => s.machines);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const sessions = useDaemonStore((s) => s.sessions);
  const isLoadingSessions = useDaemonStore((s) => s.isLoadingSessions);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
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

  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [avatarError, setAvatarError] = useState(false);

  const avatarUri =
    currentUser?.avatarUrl ||
    (currentUser as any)?.avatar_url ||
    (currentUser as any)?.picture ||
    (currentUser as any)?.photoUrl ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUri]);

  const toggleGroupCollapse = (groupName: string) => {
    const isCurrentlyActive = Boolean(
      activeSession && (
        (activeSession.workspaceName || 'Default') === groupName
      )
    );
    setUserToggledGroups((prev) => {
      const wasOpen = prev[groupName] !== undefined ? prev[groupName] : isCurrentlyActive;
      return {
        ...prev,
        [groupName]: !wasOpen,
      };
    });
  };

  useEffect(() => {
    if (activeSession?.workspaceName) {
      setUserToggledGroups((prev) => ({
        ...prev,
        [activeSession.workspaceName || 'Default']: true,
      }));
    }
  }, [activeSession?.id, activeSession?.workspaceName]);
  const [isRendered, setIsRendered] = useState<boolean>(isOpen);
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
      setIsRendered(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          mass: 0.8,
          stiffness: 220,
          useNativeDriver: false,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 240,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setIsRendered(false);
        }
      });
    }
  }, [isOpen, slideAnim, backdropAnim]);

  const handleBackdropPress = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsRendered(false);
      onClose();
    });
  };

  // Pan responder for live swiping left to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dx < -8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          slideAnim.setValue(Math.max(gestureState.dx, -DRAWER_WIDTH));
          const progress = 1 - Math.abs(gestureState.dx) / DRAWER_WIDTH;
          backdropAnim.setValue(Math.max(0, Math.min(1, progress)));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -60 || gestureState.vx < -0.3) {
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: -DRAWER_WIDTH,
              duration: 180,
              useNativeDriver: false,
            }),
            Animated.timing(backdropAnim, {
              toValue: 0,
              duration: 180,
              useNativeDriver: false,
            }),
          ]).start(() => {
            setIsRendered(false);
            onClose();
          });
        } else {
          Animated.parallel([
            Animated.spring(slideAnim, {
              toValue: 0,
              damping: 24,
              mass: 0.8,
              stiffness: 220,
              useNativeDriver: false,
            }),
            Animated.timing(backdropAnim, {
              toValue: 1,
              duration: 160,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const closeAndNavigate = (action: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsRendered(false);
      action();
      onClose();
    });
  };

  const handleStartSessionInWorkspace = (workspacePath: string) => {
    closeAndNavigate(() => {
      startNewSessionInWorkspace(workspacePath);
      onNavigateScreen('agent');
    });
  };

  const handleSelectSession = (item: RealSessionItem) => {
    closeAndNavigate(() => {
      selectSession(item);
      onNavigateScreen('agent');
    });
  };

  const handleNavScreen = (screen: AppScreen) => {
    closeAndNavigate(() => {
      onNavigateScreen(screen);
    });
  };

  const searchedSessions = useMemo(() => {
    const query = drawerSearch.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((s) => {
      return (
        s.title.toLowerCase().includes(query) ||
        s.workspaceName.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
      );
    });
  }, [sessions, drawerSearch]);

  const pinnedSessions = useMemo(() => {
    return searchedSessions.filter((s) => s.pinned);
  }, [searchedSessions]);

  const workspaceGroups = useMemo(() => {
    const groupedMap = new Map<string, { name: string; path: string; items: RealSessionItem[] }>();

    // 1. Seed with registered workspaces from store
    for (const ws of workspaces) {
      if (ws) {
        groupedMap.set(ws, { name: ws, path: '', items: [] });
      }
    }

    // 2. Group sessions by workspaceName
    for (const s of searchedSessions) {
      const key = s.workspaceName || 'Default';
      const existing = groupedMap.get(key);
      if (existing) {
        if (!existing.path && s.workspacePath) existing.path = s.workspacePath;
        existing.items.push(s);
      } else {
        groupedMap.set(key, {
          name: key,
          path: s.workspacePath || '',
          items: [s],
        });
      }
    }

    // 3. Filter and assemble groups
    const query = drawerSearch.trim().toLowerCase();
    const groups: Array<{ name: string; path: string; items: RealSessionItem[] }> = [];

    for (const [name, val] of groupedMap.entries()) {
      if (query) {
        if (val.items.length > 0 || name.toLowerCase().includes(query)) {
          groups.push(val);
        }
      } else {
        // Show all groups with sessions, or registered workspaces
        if (val.items.length > 0 || workspaces.includes(name)) {
          groups.push(val);
        }
      }
    }

    // Sort so activeSession's workspace is on top, then alphabetical
    return groups.sort((a, b) => {
      if (activeSession?.workspaceName === a.name) return -1;
      if (activeSession?.workspaceName === b.name) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [workspaces, searchedSessions, drawerSearch, activeSession?.workspaceName]);

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

  const renderSessionRow = (item: RealSessionItem, isChild = false) => {
    const isActive = activeSession?.id === item.id && currentScreen === 'agent';
    return (
      <View
        key={item.id}
        style={[
          styles.sessionItem,
          isChild && styles.sessionItemChild,
          isActive && styles.sessionItemActive,
        ]}
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
            {!isChild && (
              <>
                <Text style={styles.sessionWorkspace} numberOfLines={1}>
                  {item.workspaceName}
                </Text>
                <Text style={styles.sessionMetaDot}>•</Text>
              </>
            )}
            {item.messageCount > 0 && (
              <>
                <Text style={styles.sessionMetaText}>
                  {item.messageCount} msg{item.messageCount === 1 ? '' : 's'}
                </Text>
                <Text style={styles.sessionMetaDot}>•</Text>
              </>
            )}
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
          <MoreVertical size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isRendered && !isOpen) return null;

  const operatorInitial = currentUser?.name ? currentUser.name[0].toUpperCase() : 'O';
  const operatorName = currentUser?.name || 'Local Operator';
  const operatorEmail = currentUser?.email || 'local@cloud-agent.internal';

  const cpuCores = daemonStatus?.telemetry?.cpu?.cores || 8;
  const ramGb = daemonStatus?.telemetry?.ram?.totalGb || 32;
  const nodePlatform = activeMachine?.platform || daemonStatus?.platform || 'Host';

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 200 }]}
      pointerEvents={isOpen || isRendered ? 'box-none' : 'none'}
    >
      {/* Dimmed Backdrop */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
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
          pointerEvents={isOpen ? 'auto' : 'none'}
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
        <View
          style={[
            styles.drawerSafeArea,
            {
              paddingTop: topInset + (Platform.OS === 'ios' ? 8 : 4),
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 4),
            },
          ]}
        >
          {/* Floating Search Bar (No borders, no < icon, floating pill) */}
        <View style={styles.floatingSearchContainer}>
          <View style={styles.floatingSearchBox}>
            <Search size={15} color={colors.textMuted} />
            <TextInput
              style={styles.floatingSearchInput}
              value={drawerSearch}
              onChangeText={setDrawerSearch}
              placeholder="Search sessions or workspaces..."
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {drawerSearch.length > 0 && (
              <TouchableOpacity
                onPress={() => setDrawerSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
              <Plus size={14} color="#0a0a0a" />
            </View>
            <Text style={styles.newSessionBtnText}>New Session</Text>
          </TouchableOpacity>

          {/* 4. Pinned Sessions (if any) */}
          {pinnedSessions.length > 0 && (
            <View style={styles.pinnedSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleWithIcon}>
                  <Pin size={11} color={colors.primary} />
                  <Text style={styles.sectionTitle}>PINNED SESSIONS</Text>
                </View>
                <Text style={styles.sectionBadge}>{pinnedSessions.length}</Text>
              </View>
              {pinnedSessions.map((item) => renderSessionRow(item, false))}
            </View>
          )}

          {/* 5. Workspaces & Sessions Tree Hierarchy */}
          <View style={[styles.sectionHeaderRow, pinnedSessions.length > 0 && { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>WORKSPACES</Text>
            {isLoadingSessions ? (
              <ActivityIndicator size="small" color="#a3a3a3" style={{ transform: [{ scale: 0.65 }] }} />
            ) : (
              <Text style={styles.sectionBadge}>
                {workspaceGroups.length} {workspaceGroups.length === 1 ? 'folder' : 'folders'}
              </Text>
            )}
          </View>

          {isLoadingSessions && workspaceGroups.length === 0 ? (
            <View style={styles.loadingSessionsBox}>
              <ActivityIndicator size="small" color="#a3a3a3" style={{ transform: [{ scale: 0.8 }] }} />
              <Text style={styles.loadingSessionsText}>Loading workspaces...</Text>
            </View>
          ) : workspaceGroups.length === 0 ? (
            <View style={styles.emptySessionsBox}>
              <Text style={styles.emptySessionsText}>
                {drawerSearch ? 'No matching workspaces or sessions' : 'No workspaces discovered'}
              </Text>
            </View>
          ) : (
            workspaceGroups.map((group) => {
              const hasActiveSession = Boolean(
                activeSession && (
                  group.name === (activeSession.workspaceName || 'Default') ||
                  group.items.some((item) => item.id === activeSession.id)
                )
              );
              const isExpanded = drawerSearch.trim()
                ? true
                : userToggledGroups[group.name] !== undefined
                  ? userToggledGroups[group.name]
                  : hasActiveSession;
              const isCollapsed = !isExpanded;
              return (
                <View key={group.name} style={styles.workspaceGroupContainer}>
                  {/* Workspace Folder Header */}
                  <TouchableOpacity
                    style={styles.workspaceFolderHeader}
                    onPress={() => toggleGroupCollapse(group.name)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.workspaceFolderToggle}>
                      {isCollapsed ? (
                        <ChevronRight size={15} color={colors.textMuted} />
                      ) : (
                        <ChevronDown size={15} color={colors.textMuted} />
                      )}
                      <View style={styles.workspaceFolderIconBox}>
                        <FolderGit2 size={20} color="#fafafa" />
                      </View>
                      <Text style={styles.workspaceFolderName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <View style={styles.workspaceCountBadge}>
                        <Text style={styles.workspaceCountBadgeText}>{group.items.length}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Child Sessions in Folder */}
                  {!isCollapsed && (
                    <View style={styles.workspaceChildrenContainer}>
                      {group.items.map((session) => renderSessionRow(session, true))}
                      <TouchableOpacity
                        style={styles.workspaceNewSessionItem}
                        onPress={() => handleStartSessionInWorkspace(group.path || group.name)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.workspaceNewSessionIconCircle}>
                          <Plus size={10} color={colors.textMuted} />
                        </View>
                        <Text style={styles.workspaceNewSessionText}>New Session</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
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

        {/* 7. Drawer Footer: User Profile */}
        <View style={styles.drawerBottomFooter}>
          <View style={styles.bottomProfileCard}>
            <View style={styles.avatarBox}>
              {avatarUri && !avatarError ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  onError={() => setAvatarError(true)}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{operatorInitial}</Text>
              )}
            </View>
            <View style={styles.bottomProfileTextCol}>
              <Text style={styles.bottomProfileName} numberOfLines={1}>
                {operatorName}
              </Text>
              <Text style={styles.bottomProfileEmail} numberOfLines={1}>
                {operatorEmail}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bottomLogoutBtn}
              onPress={logout}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Sign Out"
            >
              <LogOut size={15} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
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
        initialPath={targetWorkspacePath || activeSession?.workspacePath || undefined}
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
    zIndex: 210,
    overflow: 'hidden',
  },
  drawerSafeArea: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  floatingSearchContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  floatingSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  floatingSearchInput: {
    flex: 1,
    height: 40,
    color: '#fafafa',
    fontSize: 13,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fafafa',
  },
  drawerBottomFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: colors.surfaceContainerLowest,
  },
  bottomProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomProfileTextCol: {
    marginLeft: 10,
    flex: 1,
    marginRight: 8,
  },
  bottomProfileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
  },
  bottomProfileEmail: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  bottomLogoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
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
  workspaceGroupContainer: {
    marginBottom: 6,
  },
  workspaceFolderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 4,
  },
  workspaceFolderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  workspaceFolderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
    marginRight: 9,
  },
  workspaceFolderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  workspaceCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginLeft: 8,
  },
  workspaceCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a3a3a3',
  },
  workspaceChildrenContainer: {
    marginLeft: 16,
    paddingLeft: 10,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 3,
    paddingBottom: 6,
  },
  workspaceNewSessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radii.md,
    marginTop: 2,
    marginBottom: 2,
  },
  workspaceNewSessionIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  workspaceNewSessionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
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
  loadingSessionsBox: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingSessionsText: {
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
  sessionItemChild: {
    paddingLeft: 8,
    paddingVertical: 7,
    marginBottom: 2,
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
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
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
  sessionMetaDot: {
    fontSize: 9,
    color: colors.textDisabled,
  },
  sessionMetaText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaDot: {
    display: "none",
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
});

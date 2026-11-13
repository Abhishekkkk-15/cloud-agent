import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Drawer,
  Tree,
  Button,
  Input,
  Badge,
  Item,
  Text,
  Spinner,
  cn,
} from 'panelui-native';
import {
  Plus,
  ChevronRight,
  ShieldAlert,
  Activity,
  Server,
  Search,
  LogOut,
  Folder,
  FolderOpen,
  Pin,
  MoreVertical,
  X,
  Bell,
  ChevronsUpDown,
  Sun,
  Moon,
  Palette,
  Cpu,
} from './Icons';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';
import { NewChatWorkspaceSheet } from './NewChatWorkspaceSheet';
import { PairMachineModal } from './PairMachineModal';
import { MachineSwitcherModal } from './MachineSwitcherModal';
import { SessionDropdownMenu } from './SessionDropdownMenu';
import { ServerSettingsModal } from './ServerSettingsModal';
import { ProcessManagerSheet } from './ProcessManagerSheet';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BrandLogo } from './BrandLogo';
import { getGlossyHeaderTokens } from '../theme/tokens';

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
  const effectiveTopPadding = Math.max(topInset, Platform.OS === 'ios' ? 12 : 8) + 4;

  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const sessions = useDaemonStore((s) => s.sessions);
  const isLoadingSessions = useDaemonStore((s) => s.isLoadingSessions);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const workspaces = useDaemonStore((s) => s.workspaces);
  const knownWorkspaces = useDaemonStore((s) => s.knownWorkspaces);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const selectSession = useDaemonStore((s) => s.selectSession);
  const startNewSessionInWorkspace = useDaemonStore((s) => s.startNewSessionInWorkspace);
  const logout = useDaemonStore((s) => s.logout);
  const currentUser = useDaemonStore((s) => s.currentUser);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const cliWorkers = useDaemonStore((s) => s.cliWorkers);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);
  const theme = useDaemonStore((s) => s.theme);
  const toggleTheme = useDaemonStore((s) => s.toggleTheme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight, isSwiss), [isLight, isSwiss]);

  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState(false);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>([]);

  const [showNewChatSheet, setShowNewChatSheet] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showMachineSwitcher, setShowMachineSwitcher] = useState<boolean>(false);
  const [showServerSettings, setShowServerSettings] = useState<boolean>(false);
  const [showProcessManager, setShowProcessManager] = useState<boolean>(false);

  const avatarUri =
    currentUser?.avatarUrl ||
    (currentUser as any)?.avatar_url ||
    (currentUser as any)?.picture ||
    (currentUser as any)?.photoUrl ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUri]);

  useEffect(() => {
    if (!isOpen && !drawerSearch) {
      setIsSearchActive(false);
    }
  }, [isOpen, drawerSearch]);

  // Auto-expand active session's or target workspace folder
  useEffect(() => {
    const currentWs =
      activeSession?.workspaceName ||
      (targetWorkspacePath ? targetWorkspacePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() : null);
    if (currentWs) {
      setExpandedWorkspaces((prev) =>
        prev.includes(currentWs) ? prev : [...prev, currentWs]
      );
    }
  }, [activeSession?.id, activeSession?.workspaceName, targetWorkspacePath]);

  const handleStartSessionInWorkspace = (workspacePath: string) => {
    onClose();
    startNewSessionInWorkspace(workspacePath);
    onNavigateScreen('agent');
  };

  const handleSelectSession = (item: RealSessionItem) => {
    onClose();
    selectSession(item);
    onNavigateScreen('agent');
  };

  const handleNavScreen = (screen: AppScreen) => {
    onClose();
    onNavigateScreen(screen);
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

    // 2. Seed with known workspaces from host
    for (const kw of knownWorkspaces) {
      if (kw.name) {
        const existing = groupedMap.get(kw.name);
        if (existing) {
          if (!existing.path && kw.path) existing.path = kw.path;
        } else {
          groupedMap.set(kw.name, { name: kw.name, path: kw.path || '', items: [] });
        }
      }
    }

    // 3. Seed active targetWorkspacePath if set
    if (targetWorkspacePath) {
      const clean = targetWorkspacePath.replace(/\\/g, '/');
      const parts = clean.split('/').filter(Boolean);
      const wsName = parts.length > 0 ? parts[parts.length - 1] : clean;
      if (!groupedMap.has(wsName)) {
        groupedMap.set(wsName, { name: wsName, path: targetWorkspacePath, items: [] });
      } else {
        const existing = groupedMap.get(wsName)!;
        if (!existing.path) existing.path = targetWorkspacePath;
      }
    }

    // 4. Group sessions by workspaceName
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

    // 5. Filter and assemble groups
    const query = drawerSearch.trim().toLowerCase();
    const groups: Array<{ name: string; path: string; items: RealSessionItem[] }> = [];

    for (const [name, val] of groupedMap.entries()) {
      if (query) {
        if (val.items.length > 0 || name.toLowerCase().includes(query)) {
          groups.push(val);
        }
      } else {
        groups.push(val);
      }
    }

    // Sort so activeSession's workspace (or target workspace) is on top, then alphabetical
    const activeWs =
      activeSession?.workspaceName ||
      (targetWorkspacePath ? targetWorkspacePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() : undefined);
    return groups.sort((a, b) => {
      if (activeWs === a.name) return -1;
      if (activeWs === b.name) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [workspaces, knownWorkspaces, targetWorkspacePath, searchedSessions, drawerSearch, activeSession?.workspaceName]);

  const operatorInitial = currentUser?.name
    ? currentUser.name[0].toUpperCase()
    : currentUser?.email
      ? currentUser.email[0].toUpperCase()
      : 'U';
  const operatorName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const operatorEmail = currentUser?.email || '';

  const displayedExpanded = drawerSearch.trim()
    ? workspaceGroups.map((g) => g.name)
    : expandedWorkspaces;

  return (
    <>
      <Drawer
        open={isOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      >
        <Drawer.Content
          side="start"
          size="md"
          showClose={false}
          className="bg-popover border-r border-border p-0"
          style={{ paddingTop: 0 }}
        >
          {/* Drawer Body: Smoothly scrollable with native UI-thread physics */}
          <Drawer.Body
            scrollable={true}
            contentContainerStyle={{
              paddingTop: effectiveTopPadding,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: 16,
            }}
          >
            {/* 1. Header: Brand Logo/Title & Search Toggle */}
            {!isSearchActive ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                className="flex-row items-center justify-between mb-3 h-10"
              >
                <View className="flex-row items-center gap-2.5">
                  <BrandLogo size={36} />
                  <Text className="text-[17px] font-bold text-foreground tracking-tight">
                    Cloud Agent
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    { width: 40, height: 40, borderRadius: 20 },
                    glossyHeader.containerStyle,
                  ]}
                  className="items-center justify-center active:opacity-70"
                  onPress={() => setIsSearchActive(true)}
                  activeOpacity={0.7}
                  accessibilityLabel="Search sessions and workspaces"
                >
                  <Search size={19} color={glossyHeader.iconColor} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                className="flex-row items-center gap-2 mb-3 h-10"
              >
                <View className="flex-1">
                  <Input
                    placeholder="Search sessions or workspaces..."
                    value={drawerSearch}
                    onChangeText={setDrawerSearch}
                    size="sm"
                    variant="outline"
                    autoFocus={true}
                    startContent={<Search size={14} color={isLight ? '#686868' : '#a3a3a3'} />}
                    endContent={
                      drawerSearch.length > 0 ? (
                        <TouchableOpacity onPress={() => setDrawerSearch('')}>
                          <X size={14} color={isLight ? '#686868' : '#a3a3a3'} />
                        </TouchableOpacity>
                      ) : undefined
                    }
                    className="w-full"
                  />
                </View>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 items-center justify-center rounded-lg"
                  onPress={() => {
                    setDrawerSearch('');
                    setIsSearchActive(false);
                  }}
                >
                  <X size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                </Button>
              </Animated.View>
            )}

            {/* 2. Compute Node Selector Card */}
            <TouchableOpacity
              onPress={() => setShowMachineSwitcher(true)}
              activeOpacity={0.7}
              className="flex-row items-center justify-between px-3.5 py-3 rounded-2xl bg-surface border border-border mb-3.5"
            >
              <View className="flex-row items-center gap-3 flex-1 mr-2.5">
                <View className="relative">
                  <View className="w-9 h-9 rounded-xl bg-surface-secondary border border-border items-center justify-center">
                    <Server size={17} color={isLight ? '#262626' : '#f5f5f5'} />
                  </View>
                  <View
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface',
                      activeMachine?.isOnline !== false ? 'bg-emerald-500' : 'bg-amber-500'
                    )}
                  />
                </View>

                <View className="flex-1 justify-center">
                  <Text className="text-[14px] font-semibold text-foreground leading-tight" numberOfLines={1}>
                    {activeMachine?.name || daemonStatus?.hostname || 'Compute Node'}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-0.5">
                    <Text className="text-xs text-muted-foreground">
                      {activeMachine?.platform || daemonStatus?.platform || 'Host'}
                    </Text>
                    {pingRtt ? (
                      <>
                        <Text className="text-xs text-muted-foreground">•</Text>
                        <Text className="text-xs text-muted-foreground font-mono">
                          {pingRtt}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>

              <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary shrink-0">
                <Text className="text-xs font-semibold text-foreground">Switch</Text>
                <ChevronsUpDown size={13} color={isLight ? '#262626' : '#f5f5f5'} />
              </View>
            </TouchableOpacity>

            {/* 3. Primary Action: + New Session */}
            <Button
              variant="primary"
              size="md"
              onPress={() => setShowNewChatSheet(true)}
              className="w-full mb-4 flex-row items-center justify-center gap-2 rounded-xl"
            >
              <Plus size={16} color={isLight ? '#fafafa' : '#262626'} />
              <Text className="font-semibold text-primary-foreground text-sm">New Session</Text>
            </Button>

            {/* 4. Pinned Sessions (if any) */}
            {pinnedSessions.length > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5 px-1">
                  <View className="flex-row items-center gap-1.5">
                    <Pin size={11} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Pinned Sessions
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">{pinnedSessions.length}</Text>
                </View>
                {pinnedSessions.map((session) => {
                  const isActive = activeSession?.id === session.id && currentScreen === 'agent';
                  return (
                    <View
                      key={session.id}
                      className={cn(
                        'flex-row items-center justify-between rounded-xl my-0.5',
                        isActive ? 'bg-secondary' : 'hover:bg-secondary/40'
                      )}
                    >
                      <TouchableOpacity
                        onPress={() => handleSelectSession(session)}
                        className="flex-row items-center flex-1 py-2.5 pl-3 pr-2"
                        activeOpacity={0.7}
                      >
                        <Pin size={13} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginRight: 8 }} />
                        <Text
                          className={cn(
                            'text-[15px] flex-1 leading-snug',
                            isActive ? 'font-semibold text-foreground' : 'text-foreground'
                          )}
                          numberOfLines={1}
                        >
                          {session.title}
                        </Text>
                      </TouchableOpacity>

                      <View className="pr-1.5">
                        <SessionDropdownMenu session={session} iconSize={15} triggerClassName="p-1.5" />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* 5. Workspaces & Sessions Tree Hierarchy (PanelUI Tree) */}
            <View className="mb-2">
              <View className="flex-row items-center justify-between mb-1.5 px-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workspaces
                </Text>
                {isLoadingSessions ? (
                  <Spinner size="sm" />
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    {workspaceGroups.length} {workspaceGroups.length === 1 ? 'folder' : 'folders'}
                  </Text>
                )}
              </View>

              {isLoadingSessions && workspaceGroups.length === 0 ? (
                <View className="py-4 items-center justify-center">
                  <Spinner size="sm" />
                  <Text className="text-xs text-muted-foreground mt-2">Loading workspaces...</Text>
                </View>
              ) : workspaceGroups.length === 0 ? (
                <View className="py-3 items-center justify-center">
                  <Text className="text-xs text-muted-foreground">
                    {drawerSearch ? 'No matching workspaces or sessions' : 'No workspaces discovered'}
                  </Text>
                </View>
              ) : (
                <Tree
                  selectionMode="single"
                  value={activeSession?.id}
                  expanded={displayedExpanded}
                  onExpandedChange={(newExpanded) => setExpandedWorkspaces(newExpanded)}
                  showLines={true}
                  size="default"
                  className="w-full"
                >
                  {workspaceGroups.map((group) => {
                    const isGroupExpanded = displayedExpanded.includes(group.name);
                    return (
                      <Tree.Item key={group.name} value={group.name}>
                        <Tree.Trigger className="py-2.5 px-3 rounded-xl flex-row items-center justify-between">
                          <Tree.Indicator />
                          {/* Workspace folder icon: closed / open based on state */}
                          <Tree.Icon className="mr-2.5">
                            {isGroupExpanded ? (
                              <FolderOpen size={19} color={isLight ? '#262626' : '#f5f5f5'} />
                            ) : (
                              <Folder size={19} color={isLight ? '#686868' : '#a3a3a3'} />
                            )}
                          </Tree.Icon>
                          <Tree.Label className="text-[16px] font-semibold text-foreground flex-1 tracking-tight" numberOfLines={1}>
                            {group.name}
                          </Tree.Label>
                          {group.items.length > 0 && (
                            <Tree.Actions>
                              <View className="px-2 py-0.5 rounded-full bg-secondary">
                                <Text className="text-xs font-semibold text-muted-foreground font-mono">
                                  {group.items.length}
                                </Text>
                              </View>
                            </Tree.Actions>
                          )}
                        </Tree.Trigger>

                        {/* Child Sessions: Zero icons, clean text and subtle hairline guide */}
                        <Tree.Group>
                          {group.items.map((session) => {
                            const isSessionActive = activeSession?.id === session.id && currentScreen === 'agent';
                            return (
                              <Tree.Item key={session.id} value={session.id}>
                                <Tree.Trigger
                                  onPress={() => handleSelectSession(session)}
                                  className={cn(
                                    'py-2.5 px-3 rounded-xl flex-row items-center justify-between my-0.5',
                                    isSessionActive && 'bg-secondary'
                                  )}
                                >
                                  {/* Sessions have NO icon, matching clean tree standard */}
                                  <Tree.Label
                                    className={cn(
                                      'text-[15px] flex-1 leading-snug',
                                      isSessionActive
                                        ? 'font-semibold text-foreground'
                                        : 'text-muted-foreground'
                                    )}
                                    numberOfLines={1}
                                  >
                                    {session.title}
                                  </Tree.Label>
                                  <Tree.Actions className="flex-row items-center gap-1.5">
                                    {session.pinned && (
                                      <Pin size={13} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginRight: 2 }} />
                                    )}
                                    <SessionDropdownMenu session={session} iconSize={15} triggerClassName="p-1.5" />
                                  </Tree.Actions>
                                </Tree.Trigger>
                              </Tree.Item>
                            );
                          })}

                          {/* Quick create inside workspace */}
                          <TouchableOpacity
                            onPress={() => handleStartSessionInWorkspace(group.path || group.name)}
                            className="flex-row items-center py-2.5 px-3 rounded-xl mt-1"
                            activeOpacity={0.7}
                          >
                            <Plus size={15} color={isLight ? '#686868' : '#a3a3a3'} style={{ marginRight: 8 }} />
                            <Text className="text-[14px] text-muted-foreground font-medium">New Session</Text>
                          </TouchableOpacity>
                        </Tree.Group>
                      </Tree.Item>
                    );
                  })}
                </Tree>
              )}
            </View>
          </Drawer.Body>

          {/* Sticky Management & Tools (Pinned right above user profile) */}
          <View className="border-t border-border px-3 pt-2 pb-1 bg-card">
            <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
              Management & Tools
            </Text>

            {/* Command Approvals */}
            <Item
              variant="default"
              size="sm"
              className={cn(
                'px-2.5 py-1.5 rounded-xl my-0.5',
                currentScreen === 'approvals' && 'bg-secondary'
              )}
              onPress={() => handleNavScreen('approvals')}
            >
              <Item.Media variant="icon">
                <ShieldAlert size={17} color={pendingApproval ? '#ef4444' : (isLight ? '#686868' : '#a3a3a3')} />
              </Item.Media>
              <Item.Content>
                <Item.Title className={cn('text-[14px]', currentScreen === 'approvals' ? 'text-foreground font-semibold' : 'text-foreground font-medium')}>
                  Command Approvals
                </Item.Title>
              </Item.Content>
              <Item.Actions>
                {pendingApproval ? (
                  <Badge variant="destructive" size="sm" className="px-2 py-0.5">
                    <Text className="text-xs font-semibold text-destructive-foreground">1 Action</Text>
                  </Badge>
                ) : null}
              </Item.Actions>
            </Item>

            {/* Machine Health & Telemetry */}
            <Item
              variant="default"
              size="sm"
              className={cn(
                'px-2.5 py-1.5 rounded-xl my-0.5',
                currentScreen === 'health' && 'bg-secondary'
              )}
              onPress={() => handleNavScreen('health')}
            >
              <Item.Media variant="icon">
                <Activity size={17} color={currentScreen === 'health' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
              </Item.Media>
              <Item.Content>
                <Item.Title className={cn('text-[14px]', currentScreen === 'health' ? 'text-foreground font-semibold' : 'text-foreground font-medium')}>
                  Machine Health & Fleet
                </Item.Title>
              </Item.Content>
            </Item>

            {/* Process & Daemon Control */}
            <Item
              variant="default"
              size="sm"
              className="px-2.5 py-1.5 rounded-xl my-0.5"
              onPress={() => {
                onClose();
                setShowProcessManager(true);
              }}
            >
              <Item.Media variant="icon">
                <Cpu size={17} color={isLight ? '#686868' : '#a3a3a3'} />
              </Item.Media>
              <Item.Content>
                <Item.Title className="text-[14px] font-medium text-foreground">
                  Process & Daemon Control
                </Item.Title>
              </Item.Content>
              <Item.Actions className="flex-row items-center gap-1.5">
                {cliWorkers.length > 0 && (
                  <Badge variant="secondary" size="xs">
                    <Text className="text-[10px] font-medium">
                      {cliWorkers.length} {cliWorkers.length === 1 ? 'worker' : 'workers'}
                    </Text>
                  </Badge>
                )}
                <ChevronRight size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              </Item.Actions>
            </Item>

            {/* Server & Notifications Settings */}
            <Item
              variant="default"
              size="sm"
              className="px-2.5 py-1.5 rounded-xl my-0.5"
              onPress={() => setShowServerSettings(true)}
            >
              <Item.Media variant="icon">
                <Bell size={17} color={isPushRegistered ? '#10b981' : (isLight ? '#686868' : '#a3a3a3')} />
              </Item.Media>
              <Item.Content>
                <Item.Title className="text-[14px] font-medium text-foreground">
                  Settings & Push Alerts
                </Item.Title>
              </Item.Content>
              <Item.Actions className="flex-row items-center gap-2">
                <Badge
                  variant={isPushRegistered ? 'success' : 'secondary'}
                  size="sm"
                  className="px-1.5 py-0"
                >
                  <Text className="text-[10px] font-medium">
                    {isPushRegistered ? 'Active' : 'Offline'}
                  </Text>
                </Badge>
                <ChevronRight size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              </Item.Actions>
            </Item>
          </View>

          {/* 7. Drawer Footer: User Profile */}
          <Drawer.Footer className="border-t border-border px-4 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-full bg-secondary items-center justify-center overflow-hidden border border-border">
                {avatarUri && !avatarError ? (
                  <Image
                    source={{ uri: avatarUri }}
                    className="w-full h-full"
                    onError={() => setAvatarError(true)}
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-xs font-bold text-foreground">{operatorInitial}</Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {operatorName}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {operatorEmail}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onPress={toggleTheme}
                className="w-8 h-8 p-0 items-center justify-center rounded-lg"
                accessibilityLabel="Toggle Theme"
              >
                {theme === 'swiss' ? (
                  <Palette size={15} color="#DC201E" />
                ) : isLight ? (
                  <Sun size={15} color="#262626" />
                ) : (
                  <Moon size={15} color="#a3a3a3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={logout}
                className="w-8 h-8 p-0 items-center justify-center rounded-lg"
                accessibilityLabel="Sign Out"
              >
                <LogOut size={15} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
            </View>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

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

      {/* Server & Network Endpoints Modal */}
      <ServerSettingsModal
        visible={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      {/* Process & Daemon Manager Sheet */}
      <ProcessManagerSheet
        isOpen={showProcessManager}
        onClose={() => setShowProcessManager(false)}
      />
    </>
  );
};

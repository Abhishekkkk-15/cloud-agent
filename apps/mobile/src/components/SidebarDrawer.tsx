import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Drawer,
  Tree,
  Button,
  Input,
  Card,
  Badge,
  Item,
  Text,
  cn,
} from 'panelui-native';
import {
  Plus,
  ChevronRight,
  ShieldAlert,
  Activity,
  Layers,
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
} from './Icons';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';
import { NewChatWorkspaceSheet } from './NewChatWorkspaceSheet';
import { PairMachineModal } from './PairMachineModal';
import { MachineSwitcherModal } from './MachineSwitcherModal';
import { FolderPickerModal } from './FolderPickerModal';
import { SessionActionModal } from './SessionActionModal';
import { SessionDropdownMenu } from './SessionDropdownMenu';
import { ServerSettingsModal } from './ServerSettingsModal';

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
  const theme = useDaemonStore((s) => s.theme);
  const toggleTheme = useDaemonStore((s) => s.toggleTheme);
  const isLight = theme === 'light';

  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [avatarError, setAvatarError] = useState(false);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>([]);

  const [actionSession, setActionSession] = useState<RealSessionItem | null>(null);
  const [showNewChatSheet, setShowNewChatSheet] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showMachineSwitcher, setShowMachineSwitcher] = useState<boolean>(false);
  const [showDirectFolderPicker, setShowDirectFolderPicker] = useState<boolean>(false);
  const [showServerSettings, setShowServerSettings] = useState<boolean>(false);

  const avatarUri =
    currentUser?.avatarUrl ||
    (currentUser as any)?.avatar_url ||
    (currentUser as any)?.picture ||
    (currentUser as any)?.photoUrl ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUri]);

  // Auto-expand active session's workspace folder
  useEffect(() => {
    if (activeSession?.workspaceName) {
      setExpandedWorkspaces((prev) =>
        prev.includes(activeSession.workspaceName || 'Default')
          ? prev
          : [...prev, activeSession.workspaceName || 'Default']
      );
    }
  }, [activeSession?.id, activeSession?.workspaceName]);

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

  const standbyMachines = machines.filter((m) => m.machineId !== activeMachine?.machineId);

  const operatorInitial = currentUser?.name
    ? currentUser.name[0].toUpperCase()
    : currentUser?.email
      ? currentUser.email[0].toUpperCase()
      : 'U';
  const operatorName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const operatorEmail = currentUser?.email || '';

  const cpuCores = daemonStatus?.telemetry?.cpu?.cores || 8;
  const ramGb = daemonStatus?.telemetry?.ram?.totalGb || 32;
  const nodePlatform = activeMachine?.platform || daemonStatus?.platform || 'Host';

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
        >
          {/* Drawer Body: Smoothly scrollable with native UI-thread physics */}
          <Drawer.Body
            scrollable={true}
            contentContainerStyle={{
              paddingTop: topInset + (Platform.OS === 'ios' ? 8 : 12),
              paddingBottom: Math.max(insets.bottom, 16),
              paddingHorizontal: 16,
            }}
          >
            {/* 1. Search Bar */}
            <View className="mb-3">
              <Input
                placeholder="Search sessions or workspaces..."
                value={drawerSearch}
                onChangeText={setDrawerSearch}
                size="sm"
                variant="outline"
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

            {/* 2. Compute Node Fleet Widget */}
            <Card className="p-3 mb-3 bg-surface border border-border rounded-xl">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-1.5">
                  <Server size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Compute Node
                  </Text>
                </View>
                <Badge variant="outline" size="sm" className="px-1.5 py-0.5">
                  <Text className="text-xs text-muted-foreground font-mono">{pingRtt || '18ms'}</Text>
                </Badge>
              </View>

              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
                  {activeMachine?.name || daemonStatus?.hostname || 'Local Machine'}
                </Text>
                <Button
                  variant="outline"
                  size="xs"
                  onPress={() => setShowMachineSwitcher(true)}
                  className="flex-row items-center gap-1 px-2 py-1"
                >
                  <ChevronsUpDown size={11} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-medium text-foreground">Switch</Text>
                </Button>
              </View>

              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {cpuCores} vCPU • {ramGb}GB RAM • {nodePlatform}
              </Text>

              {/* Standby Nodes Grid */}
              <View className="flex-row gap-2 mt-2.5 pt-2.5 border-t border-border">
                {standbyMachines.slice(0, 2).map((m) => (
                  <TouchableOpacity
                    key={m.machineId}
                    onPress={() => selectMachine(m)}
                    className="flex-1 p-2 rounded-lg bg-surface-secondary border border-border"
                    activeOpacity={0.7}
                  >
                    <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                      {m.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {m.isOnline ? 'Standby' : 'Offline'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {standbyMachines.length < 2 && (
                  <TouchableOpacity
                    onPress={() => setShowPairModal(true)}
                    className="flex-1 p-2 rounded-lg border border-dashed border-border items-center justify-center flex-row gap-1"
                    activeOpacity={0.7}
                  >
                    <Plus size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                    <Text className="text-xs text-muted-foreground font-medium">Pair Node</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>

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
                    <TouchableOpacity
                      key={session.id}
                      onPress={() => handleSelectSession(session)}
                      className={cn(
                        'flex-row items-center justify-between py-2 px-2.5 rounded-lg my-0.5',
                        isActive ? 'bg-secondary' : 'hover:bg-secondary/40'
                      )}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center flex-1 mr-2">
                        <Pin size={11} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginRight: 6 }} />
                        <Text
                          className={cn(
                            'text-sm flex-1',
                            isActive ? 'font-semibold text-foreground' : 'text-foreground'
                          )}
                          numberOfLines={1}
                        >
                          {session.title}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setActionSession(session)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="p-1"
                      >
                        <MoreVertical size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                      </TouchableOpacity>
                    </TouchableOpacity>
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
                  <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} style={{ transform: [{ scale: 0.65 }] }} />
                ) : (
                  <Text className="text-xs text-muted-foreground">
                    {workspaceGroups.length} {workspaceGroups.length === 1 ? 'folder' : 'folders'}
                  </Text>
                )}
              </View>

              {isLoadingSessions && workspaceGroups.length === 0 ? (
                <View className="py-4 items-center justify-center">
                  <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
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
                        <Tree.Trigger className="py-2 px-2.5 rounded-lg flex-row items-center justify-between">
                          <Tree.Indicator />
                          {/* Workspace folder icon: closed / open based on state */}
                          <Tree.Icon className="mr-2">
                            {isGroupExpanded ? (
                              <FolderOpen size={17} color={isLight ? '#262626' : '#f5f5f5'} />
                            ) : (
                              <Folder size={17} color={isLight ? '#686868' : '#a3a3a3'} />
                            )}
                          </Tree.Icon>
                          <Tree.Label className="text-[15px] font-semibold text-foreground flex-1 tracking-tight" numberOfLines={1}>
                            {group.name}
                          </Tree.Label>
                          {group.items.length > 0 && (
                            <Tree.Actions>
                              <View className="px-1.5 py-0.5 rounded-full bg-secondary/80">
                                <Text className="text-xs font-medium text-muted-foreground font-mono">
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
                                    'py-2 px-2.5 rounded-lg flex-row items-center justify-between',
                                    isSessionActive && 'bg-secondary'
                                  )}
                                >
                                  {/* Sessions have NO icon, matching clean tree standard */}
                                  <Tree.Label
                                    className={cn(
                                      'text-sm flex-1',
                                      isSessionActive
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground'
                                    )}
                                    numberOfLines={1}
                                  >
                                    {session.title}
                                  </Tree.Label>
                                  <Tree.Actions className="flex-row items-center gap-1">
                                    {session.pinned && (
                                      <Pin size={12} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginRight: 2 }} />
                                    )}
                                    <SessionDropdownMenu session={session} iconSize={13} triggerClassName="p-1" />
                                  </Tree.Actions>
                                </Tree.Trigger>
                              </Tree.Item>
                            );
                          })}

                          {/* Quick create inside workspace */}
                          <TouchableOpacity
                            onPress={() => handleStartSessionInWorkspace(group.path || group.name)}
                            className="flex-row items-center py-2 px-2.5 rounded-lg mt-0.5"
                            activeOpacity={0.7}
                          >
                            <Plus size={13} color={isLight ? '#686868' : '#a3a3a3'} style={{ marginRight: 6 }} />
                            <Text className="text-sm text-muted-foreground font-medium">New Session</Text>
                          </TouchableOpacity>
                        </Tree.Group>
                      </Tree.Item>
                    );
                  })}
                </Tree>
              )}
            </View>

            {/* 6. Management & Navigation Links (PanelUI Item) */}
            <View className="pt-1.5 mt-0.5 border-t border-border mb-1">
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                Management & Tools
              </Text>

              {/* Theme Toggle */}
              <Item
                variant="default"
                size="xs"
                className="px-2 py-1.5 rounded-lg my-0"
                onPress={toggleTheme}
              >
                <Item.Media variant="icon">
                  {isLight ? <Sun size={15} color="#262626" /> : <Moon size={15} color="#f5f5f5" />}
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm text-foreground">
                    {isLight ? 'Theme: White' : 'Theme: Dark'}
                  </Item.Title>
                </Item.Content>
                <Item.Actions>
                  <Badge variant="outline" size="sm" className="px-1.5 py-0">
                    <Text className="text-[11px] font-medium text-foreground">{isLight ? 'White' : 'Dark'}</Text>
                  </Badge>
                </Item.Actions>
              </Item>

              {/* Security Approvals */}
              <Item
                variant="default"
                size="xs"
                className={cn(
                  'px-2 py-1.5 rounded-lg my-0',
                  currentScreen === 'approvals' && 'bg-secondary'
                )}
                onPress={() => handleNavScreen('approvals')}
              >
                <Item.Media variant="icon">
                  <ShieldAlert size={15} color={pendingApproval ? '#ef4444' : (isLight ? '#686868' : '#a3a3a3')} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className={cn('text-sm', currentScreen === 'approvals' ? 'text-foreground font-semibold' : 'text-foreground')}>
                    Security Approvals & Diff
                  </Item.Title>
                </Item.Content>
                <Item.Actions>
                  {pendingApproval ? (
                    <Badge variant="destructive" size="sm" className="px-1.5 py-0">
                      <Text className="text-[11px] font-semibold text-destructive-foreground">1 Action</Text>
                    </Badge>
                  ) : null}
                </Item.Actions>
              </Item>

              {/* Machine Health & Telemetry */}
              <Item
                variant="default"
                size="xs"
                className={cn(
                  'px-2 py-1.5 rounded-lg my-0',
                  currentScreen === 'health' && 'bg-secondary'
                )}
                onPress={() => handleNavScreen('health')}
              >
                <Item.Media variant="icon">
                  <Activity size={15} color={currentScreen === 'health' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className={cn('text-sm', currentScreen === 'health' ? 'text-foreground font-semibold' : 'text-foreground')}>
                    Machine Health & Fleet
                  </Item.Title>
                </Item.Content>
              </Item>

              {/* Workspace & Fleets Screen */}
              <Item
                variant="default"
                size="xs"
                className={cn(
                  'px-2 py-1.5 rounded-lg my-0',
                  currentScreen === 'sessions' && 'bg-secondary'
                )}
                onPress={() => handleNavScreen('sessions')}
              >
                <Item.Media variant="icon">
                  <Layers size={15} color={currentScreen === 'sessions' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className={cn('text-sm', currentScreen === 'sessions' ? 'text-foreground font-semibold' : 'text-foreground')}>
                    Workspace & Fleet Tree
                  </Item.Title>
                </Item.Content>
              </Item>

              {/* Remote Folder Picker */}
              <Item
                variant="default"
                size="xs"
                className="px-2 py-1.5 rounded-lg my-0"
                onPress={() => setShowDirectFolderPicker(true)}
              >
                <Item.Media variant="icon">
                  <Folder size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm text-foreground">
                    Browse Node Folders
                  </Item.Title>
                </Item.Content>
                <Item.Actions>
                  <ChevronRight size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                </Item.Actions>
              </Item>

              {/* Server & Notifications Settings */}
              <Item
                variant="default"
                size="xs"
                className="px-2 py-1.5 rounded-lg my-0"
                onPress={() => setShowServerSettings(true)}
              >
                <Item.Media variant="icon">
                  <Bell size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm text-foreground">
                    Push & Server Settings
                  </Item.Title>
                </Item.Content>
                <Item.Actions>
                  <ChevronRight size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                </Item.Actions>
              </Item>
            </View>
          </Drawer.Body>

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
                {isLight ? <Sun size={15} color="#262626" /> : <Moon size={15} color="#a3a3a3" />}
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
    </>
  );
};

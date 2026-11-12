import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Badge,
  Button,
  Input,
  Text,
  GridItem,
  ScrollHeader,
  Spinner,
  cn,
} from 'panelui-native';
import {
  Search,
  X,
  Plus,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Folder,
  Pin,
  MoreVertical,
  Server,
  Zap,
  Activity,
  RefreshCw,
} from '../components/Icons';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';
import { SessionActionModal } from '../components/SessionActionModal';
import { SessionDropdownMenu } from '../components/SessionDropdownMenu';
import { getGlossyHeaderTokens, getGlossyGridItemTokens } from '../theme/tokens';

interface SessionsScreenProps {
  onBack?: () => void;
  onSelectSession?: (session: RealSessionItem) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SessionsScreen: React.FC<SessionsScreenProps> = ({
  onBack,
  onSelectSession,
  onNavigateTab,
}) => {
  const sessions = useDaemonStore((s) => s.sessions);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const workspaces = useDaemonStore((s) => s.workspaces);
  const selectedWorkspace = useDaemonStore((s) => s.selectedWorkspace);
  const setSelectedWorkspace = useDaemonStore((s) => s.setSelectedWorkspace);
  const isLoadingSessions = useDaemonStore((s) => s.isLoadingSessions);
  const fetchSessions = useDaemonStore((s) => s.fetchSessions);
  const selectSessionInStore = useDaemonStore((s) => s.selectSession);
  const startNewSessionInWorkspace = useDaemonStore((s) => s.startNewSessionInWorkspace);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight), [isLight]);
  const glossyGridItem = useMemo(() => getGlossyGridItemTokens(isLight, isSwiss), [isLight, isSwiss]);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionSession, setActionSession] = useState<RealSessionItem | null>(null);
  const [userToggledGroups, setUserToggledGroups] = useState<Record<string, boolean>>({});

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

  const filteredSessions = sessions.filter((s) => {
    const matchesWorkspace =
      selectedWorkspace === 'all' || s.workspaceName === selectedWorkspace;
    const matchesSearch =
      searchQuery.trim() === '' ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.workspaceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWorkspace && matchesSearch;
  });

  const workspaceGroups = useMemo(() => {
    const groups: { name: string; path: string; items: RealSessionItem[] }[] = [];
    const groupedMap = new Map<string, { path: string; items: RealSessionItem[] }>();

    for (const ws of workspaces) {
      groupedMap.set(ws, { path: '', items: [] });
    }

    for (const s of filteredSessions) {
      const key = s.workspaceName || 'Default';
      const existing = groupedMap.get(key);
      if (existing) {
        if (!existing.path && s.workspacePath) existing.path = s.workspacePath;
        existing.items.push(s);
      } else {
        groupedMap.set(key, { path: s.workspacePath || '', items: [s] });
      }
    }

    for (const [name, val] of groupedMap.entries()) {
      if (selectedWorkspace === 'all' || selectedWorkspace === name) {
        groups.push({ name, path: val.path, items: val.items });
      }
    }
    return groups;
  }, [workspaces, filteredSessions, selectedWorkspace]);

  const totalTurns = useMemo(
    () => sessions.reduce((acc, s) => acc + (s.messageCount || 0), 0),
    [sessions]
  );

  const handleCardPress = async (session: RealSessionItem) => {
    await selectSessionInStore(session);
    if (onSelectSession) {
      onSelectSession(session);
    }
  };

  const handleNewSessionInGroup = (groupPath: string) => {
    startNewSessionInWorkspace(groupPath);
    if (onNavigateTab) {
      onNavigateTab('agent');
    }
  };

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

  return (
    <View className="flex-1 bg-background">
      <ScrollHeader className="flex-1" inset={true}>
        <ScrollHeader.Bar divider={false} surface="blur">
          {onBack && (
            <TouchableOpacity
              style={[
                { width: 44, height: 44, borderRadius: 22 },
                glossyHeader.containerStyle,
              ]}
              className="items-center justify-center mr-2.5 active:opacity-70"
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={24} color={glossyHeader.iconColor} />
            </TouchableOpacity>
          )}

          <ScrollHeader.Title className="text-base font-semibold text-foreground">
            Workspaces & Fleets
          </ScrollHeader.Title>

          <ScrollHeader.Actions>
            <TouchableOpacity
              style={[
                { width: 44, height: 44, borderRadius: 22 },
                glossyHeader.containerStyle,
              ]}
              className="items-center justify-center active:opacity-70"
              onPress={fetchSessions}
              disabled={isLoadingSessions}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Refresh sessions"
            >
              {isLoadingSessions ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw size={22} color={glossyHeader.iconColor} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="h-10 px-3.5 rounded-full bg-primary flex-row items-center gap-1.5 active:opacity-80"
              onPress={() => {
                const ws = selectedWorkspace === 'all' ? (targetWorkspacePath || workspaces[0] || '') : selectedWorkspace;
                startNewSessionInWorkspace(ws);
              }}
              accessibilityLabel="New session"
            >
              <Plus size={16} color={isLight ? '#fafafa' : '#141414'} />
              <Text className="text-xs font-semibold text-primary-foreground">New</Text>
            </TouchableOpacity>
          </ScrollHeader.Actions>
        </ScrollHeader.Bar>

        <ScrollHeader.Large className="px-4 pb-3">
          <ScrollHeader.Title className="text-2xl font-bold text-foreground">
            Workspaces & Fleets
          </ScrollHeader.Title>
          <ScrollHeader.Description className="text-xs text-muted-foreground mt-0.5">
            {`${activeMachine?.name || 'Local Machine'} • ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'} • ${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
          </ScrollHeader.Description>
        </ScrollHeader.Large>

        <ScrollView
          className="flex-1 bg-background"
          contentContainerClassName="p-4 gap-3.5"
          showsVerticalScrollIndicator={false}
        >
        {/* 1. Overview Bento Grid */}
        <GridItem.Group columns={2} gap={10} rowHeight={130} size="sm">
          {/* Host Tile */}
          <GridItem
            colSpan={1}
            rowSpan={1}
            className="p-3"
            style={glossyGridItem.containerStyle}
          >
            <GridItem.Media variant="icon">
              <Server size={15} color={isLight ? '#262626' : '#f5f5f5'} />
            </GridItem.Media>
            <GridItem.Title>Host</GridItem.Title>
            <GridItem.Value className="text-sm font-semibold" numberOfLines={1}>
              {activeMachine?.name || 'Local Host'}
            </GridItem.Value>
            <GridItem.Description numberOfLines={1}>
              {activeMachine?.platform || 'Connected'}
            </GridItem.Description>
          </GridItem>

          {/* Active Sessions Tile */}
          <GridItem
            colSpan={1}
            rowSpan={1}
            className="p-3"
            style={glossyGridItem.containerStyle}
          >
            <GridItem.Media variant="icon">
              <Zap size={15} color="#10b981" />
            </GridItem.Media>
            <GridItem.Title>Active Sessions</GridItem.Title>
            <GridItem.Value className="text-sm font-semibold font-mono text-success">
              {sessions.length}
            </GridItem.Value>
            <GridItem.Description numberOfLines={1}>
              Chat sessions
            </GridItem.Description>
          </GridItem>

          {/* Workspaces Tile */}
          <GridItem
            colSpan={1}
            rowSpan={1}
            className="p-3"
            style={glossyGridItem.containerStyle}
          >
            <GridItem.Media variant="icon">
              <FolderGit2 size={15} color={isLight ? '#262626' : '#f5f5f5'} />
            </GridItem.Media>
            <GridItem.Title>Workspaces</GridItem.Title>
            <GridItem.Value className="text-sm font-semibold">
              {workspaces.length}
            </GridItem.Value>
            <GridItem.Description numberOfLines={1}>
              Linked directories
            </GridItem.Description>
          </GridItem>

          {/* Total Turns Tile */}
          <GridItem
            colSpan={1}
            rowSpan={1}
            className="p-3"
            style={glossyGridItem.containerStyle}
          >
            <GridItem.Media variant="icon">
              <Activity size={15} color={isLight ? '#262626' : '#f5f5f5'} />
            </GridItem.Media>
            <GridItem.Title>Messages</GridItem.Title>
            <GridItem.Value className="text-sm font-semibold">
              {totalTurns}
            </GridItem.Value>
            <GridItem.Description numberOfLines={1}>
              Total session turns
            </GridItem.Description>
          </GridItem>
        </GridItem.Group>

        {/* 2. Filter & Environment Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-0.5"
        >
          {/* Active Node Pill */}
          <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="text-xs font-semibold text-foreground">
              {activeMachine?.name || 'Local Machine'}
            </Text>
          </View>

          {/* All Filter Pill */}
          <Button
            variant={selectedWorkspace === 'all' ? 'primary' : 'outline'}
            size="xs"
            className="rounded-xl px-3 py-1.5"
            onPress={() => setSelectedWorkspace('all')}
          >
            All ({sessions.length})
          </Button>

          {/* Workspace Filter Pills */}
          {workspaces.map((ws) => {
            const count = sessions.filter((s) => s.workspaceName === ws).length;
            const isSelected = selectedWorkspace === ws;
            return (
              <Button
                key={ws}
                variant={isSelected ? 'primary' : 'outline'}
                size="xs"
                className="rounded-xl px-3 py-1.5"
                onPress={() => setSelectedWorkspace(ws)}
              >
                {ws} ({count})
              </Button>
            );
          })}
        </ScrollView>

        {/* 3. Search Bar */}
        <View className="relative">
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search sessions, prompts, repositories..."
            size="md"
            variant="outline"
            className="pl-9 pr-9"
          />
          <View className="absolute left-3 top-0 bottom-0 justify-center pointer-events-none">
            <Search size={14} color={isLight ? '#686868' : '#a3a3a3'} />
          </View>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              className="absolute right-3 top-0 bottom-0 justify-center p-1"
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={isLight ? '#686868' : '#a3a3a3'} />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. Repository Fleets Tree */}
        {isLoadingSessions && sessions.length === 0 ? (
          <View className="py-12 items-center justify-center gap-2">
            <Spinner size="sm" />
            <Text className="text-xs text-muted-foreground">Loading workspace tree...</Text>
          </View>
        ) : workspaceGroups.length === 0 ? (
          <Card className="p-6 bg-card border border-border rounded-2xl items-center justify-center">
            <Text className="text-sm font-semibold text-foreground mb-1">
              No workspaces discovered
            </Text>
            <Text className="text-xs text-muted-foreground text-center">
              {searchQuery
                ? `No sessions matching "${searchQuery}"`
                : 'Connect to daemon to browse active repositories'}
            </Text>
          </Card>
        ) : (
          <View className="gap-3">
            {workspaceGroups.map((group) => {
              const hasActiveSession = Boolean(
                activeSession && (
                  group.name === (activeSession.workspaceName || 'Default') ||
                  group.items.some((item) => item.id === activeSession.id)
                )
              );
              const isExpanded = searchQuery.trim()
                ? true
                : userToggledGroups[group.name] !== undefined
                ? userToggledGroups[group.name]
                : hasActiveSession;
              const isCollapsed = !isExpanded;

              return (
                <Card
                  key={group.name}
                  className="bg-card border border-border rounded-2xl overflow-hidden p-0"
                >
                  {/* Workspace Group Header */}
                  <View className="px-3.5 py-3 flex-row items-center justify-between bg-surface border-b border-border">
                    <TouchableOpacity
                      className="flex-row items-center gap-2 flex-1 mr-2"
                      onPress={() => toggleGroupCollapse(group.name)}
                      activeOpacity={0.7}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                      ) : (
                        <ChevronDown size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                      )}
                      <View className="w-7 h-7 rounded-lg bg-surface-secondary items-center justify-center border border-border">
                        <FolderGit2 size={16} color={isLight ? '#262626' : '#f5f5f5'} />
                      </View>
                      <Text
                        className="text-sm font-semibold text-foreground flex-1"
                        numberOfLines={1}
                      >
                        {group.name}
                      </Text>
                      <Badge variant="outline" size="xs">
                        {group.items.length}
                      </Badge>
                    </TouchableOpacity>

                    <Button
                      variant="ghost"
                      size="xs"
                      className="w-7 h-7 p-0 items-center justify-center rounded-lg border border-border"
                      onPress={() => handleNewSessionInGroup(group.path || group.name)}
                      accessibilityLabel={`Start new session in ${group.name}`}
                    >
                      <Plus size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                    </Button>
                  </View>

                  {/* Sessions Tree Items */}
                  {!isCollapsed && (
                    <View className="divide-y divide-border">
                      {group.items.length === 0 ? (
                        <View className="py-4 items-center justify-center">
                          <Text className="text-xs text-muted-foreground font-mono">
                            No sessions in this workspace
                          </Text>
                        </View>
                      ) : (
                        group.items.map((session) => {
                          const isCurrentActive = activeSession?.id === session.id;

                          return (
                            <TouchableOpacity
                              key={session.id}
                              className={cn(
                                'p-3 flex-row items-center justify-between',
                                isCurrentActive && 'bg-surface'
                              )}
                              onPress={() => handleCardPress(session)}
                              activeOpacity={0.7}
                            >
                              <View className="flex-1 mr-2">
                                <View className="flex-row items-center gap-1.5 mb-1">
                                  <Folder
                                    size={13}
                                    color={isLight ? '#262626' : '#f5f5f5'}
                                  />
                                  {session.pinned ? (
                                    <Pin
                                      size={11}
                                      color={isLight ? '#262626' : '#f5f5f5'}
                                    />
                                  ) : null}
                                  <Text
                                    className="text-xs font-semibold text-foreground flex-1"
                                    numberOfLines={1}
                                  >
                                    {session.title}
                                  </Text>
                                </View>

                                <View className="flex-row items-center gap-1.5">
                                  <Text className="text-[11px] text-muted-foreground">
                                    {session.messageCount} msgs
                                  </Text>
                                  <Text className="text-[11px] text-muted-foreground">•</Text>
                                  <Text className="text-[11px] text-muted-foreground">
                                    {formatTimeAgo(session.updatedAt || session.createdAt)}
                                  </Text>
                                  <Text className="text-[11px] text-muted-foreground">•</Text>
                                  <Text className="text-[11px] font-mono text-muted-foreground" numberOfLines={1}>
                                    {session.model || 'claude-3-5-sonnet'}
                                  </Text>
                                </View>
                              </View>

                              <SessionDropdownMenu
                                session={session}
                                iconSize={14}
                                triggerClassName="w-7 h-7 items-center justify-center rounded-lg"
                              />
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScrollHeader>

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

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Search,
  X,
  Zap,
  Play,
  Clock,
  GitBranch,
  Sparkles,
  RefreshCw,
  Pin,
  MoreHorizontal,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  Server,
  Folder,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';
import { SessionActionModal } from '../components/SessionActionModal';

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
  const workspaces = useDaemonStore((s) => s.workspaces);
  const selectedWorkspace = useDaemonStore((s) => s.selectedWorkspace);
  const setSelectedWorkspace = useDaemonStore((s) => s.setSelectedWorkspace);
  const isLoadingSessions = useDaemonStore((s) => s.isLoadingSessions);
  const fetchSessions = useDaemonStore((s) => s.fetchSessions);
  const selectSessionInStore = useDaemonStore((s) => s.selectSession);
  const startNewSessionInWorkspace = useDaemonStore((s) => s.startNewSessionInWorkspace);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionSession, setActionSession] = useState<RealSessionItem | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
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
    <View style={styles.container}>
      <HeaderBar
        title="Workspace & Fleets"
        subtitle={`${activeMachine?.name || 'Local Machine'} • ${workspaces.length} workspaces`}
        showLiveDot={true}
        liveColor={colors.statusLive}
        onBack={onBack}
        onMore={fetchSessions}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Fleet & Organization Header Bar (Stitch Screen 3) */}
        <View style={styles.fleetHeaderCard}>
          <View style={styles.fleetHeaderLeft}>
            <View style={styles.fleetBadgeBox}>
              <Text style={styles.fleetBadgeText}>
                {activeMachine?.name ? activeMachine.name[0].toUpperCase() : 'A'}
              </Text>
            </View>
            <View style={styles.fleetTitleCol}>
              <Text style={styles.fleetTitle}>Cloud Agent Fleet</Text>
              <Text style={styles.fleetSub}>
                {activeMachine?.name || 'Local Machine'} • {pingRtt || '18ms'}
              </Text>
            </View>
          </View>
          <View style={styles.liveAgentsPill}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveAgentsText}>{sessions.length} agents live</Text>
          </View>
        </View>

        {/* 2. Filter & Environment Carousel (Stitch Screen 3) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.carouselScroll}
          contentContainerStyle={styles.carouselContainer}
        >
          {/* Active Box Pill */}
          <View style={styles.envPillActive}>
            <View style={styles.envDot} />
            <Text style={styles.envPillTextActive}>
              {activeMachine?.name || 'Local Machine'}
            </Text>
          </View>

          {/* All Filter Pill */}
          <TouchableOpacity
            style={[
              styles.envPill,
              selectedWorkspace === 'all' && styles.envPillSelected,
            ]}
            onPress={() => setSelectedWorkspace('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.envPillText,
                selectedWorkspace === 'all' && styles.envPillTextSelected,
              ]}
            >
              All ({sessions.length})
            </Text>
          </TouchableOpacity>

          {/* Workspaces Pills */}
          {workspaces.map((ws) => {
            const count = sessions.filter((s) => s.workspaceName === ws).length;
            const isSelected = selectedWorkspace === ws;
            return (
              <TouchableOpacity
                key={ws}
                style={[styles.envPill, isSelected && styles.envPillSelected]}
                onPress={() => setSelectedWorkspace(ws)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.envPillText,
                    isSelected && styles.envPillTextSelected,
                  ]}
                >
                  {ws} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. Search Bar */}
        <View style={styles.searchBar}>
          <Search size={14} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sessions, prompts, repositories..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. Repository Fleets Tree (Stitch Screen 3) */}
        {isLoadingSessions && sessions.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading workspace tree...</Text>
          </View>
        ) : workspaceGroups.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No workspaces discovered</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `No sessions matching "${searchQuery}"`
                : 'Connect to daemon to browse active repositories'}
            </Text>
          </View>
        ) : (
          <View style={styles.treeContainer}>
            {workspaceGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.name]);
              return (
                <View key={group.name} style={styles.groupCard}>
                  {/* Workspace Group Header */}
                  <View style={styles.groupHeaderRow}>
                    <TouchableOpacity
                      style={styles.groupHeaderLeft}
                      onPress={() => toggleGroupCollapse(group.name)}
                      activeOpacity={0.7}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={15} color={colors.textMuted} />
                      ) : (
                        <ChevronDown size={15} color={colors.textMuted} />
                      )}
                      <FolderGit2 size={16} color={colors.primaryLight} style={{ marginLeft: 6 }} />
                      <Text style={styles.groupName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <View style={styles.groupBadge}>
                        <Text style={styles.groupBadgeText}>{group.items.length}</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.newChatInGroupBtn}
                      onPress={() => handleNewSessionInGroup(group.path || group.name)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={`Start new session in ${group.name}`}
                    >
                      <Plus size={14} color={colors.primaryLight} />
                    </TouchableOpacity>
                  </View>

                  {/* Sessions Tree Items */}
                  {!isCollapsed && (
                    <View style={styles.groupSessionsList}>
                      {group.items.length === 0 ? (
                        <View style={styles.emptyGroupSub}>
                          <Text style={styles.emptyGroupText}>No sessions in this workspace</Text>
                        </View>
                      ) : (
                        group.items.map((session) => (
                          <TouchableOpacity
                            key={session.id}
                            style={styles.sessionTreeItem}
                            onPress={() => handleCardPress(session)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.sessionItemContent}>
                              <View style={styles.sessionTopRow}>
                                <View style={styles.sessionTitleLeft}>
                                  <Folder size={13} color={colors.primary} style={{ marginRight: 6 }} />
                                  {session.pinned ? (
                                    <Pin size={11} color={colors.primary} style={{ marginRight: 5 }} />
                                  ) : null}
                                  <Text style={styles.sessionTitle} numberOfLines={1}>
                                    {session.title}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.moreActionBtn}
                                  onPress={() => setActionSession(session)}
                                  activeOpacity={0.7}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <MoreHorizontal size={14} color={colors.textMuted} />
                                </TouchableOpacity>
                              </View>

                              <View style={styles.sessionMetaRow}>
                                <Text style={styles.sessionMetaText}>
                                  {session.messageCount} msgs
                                </Text>
                                <Text style={styles.metaDot}>•</Text>
                                <Text style={styles.sessionMetaText}>
                                  {formatTimeAgo(session.updatedAt || session.createdAt)}
                                </Text>
                                <Text style={styles.metaDot}>•</Text>
                                <Text style={styles.sessionModelTag}>
                                  {session.model || 'claude-3-5-sonnet'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

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
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  fleetHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 12,
  },
  fleetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  fleetBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fleetBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  fleetTitleCol: {
    flex: 1,
  },
  fleetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  fleetSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.mono,
  },
  liveAgentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.statusLiveSubtle,
    borderWidth: 1,
    borderColor: colors.statusLiveBorder,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusLive,
  },
  liveAgentsText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.statusLive,
  },
  carouselScroll: {
    marginBottom: 12,
  },
  carouselContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  envPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  envDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.statusLive,
  },
  envPillTextActive: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  envPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  envPillSelected: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  envPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  envPillTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  treeContainer: {
    gap: 10,
  },
  groupCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceContainerHigh,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
    marginLeft: 6,
    flexShrink: 1,
  },
  groupBadge: {
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  newChatInGroupBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupSessionsList: {
    padding: 8,
    gap: 6,
  },
  emptyGroupSub: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyGroupText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sessionTreeItem: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 10,
  },
  sessionItemContent: {
    flex: 1,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  sessionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
    flex: 1,
  },
  moreActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 5,
  },
  sessionMetaText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metaDot: {
    fontSize: 8,
    color: colors.textDisabled,
  },
  sessionModelTag: {
    fontSize: 10,
    color: colors.primaryLight,
    fontFamily: typography.mono,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

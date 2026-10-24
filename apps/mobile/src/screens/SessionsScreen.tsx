import React, { useState } from 'react';
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
  ArrowUpDown,
  RefreshCw,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore, RealSessionItem } from '../stores/useDaemonStore';

interface SessionsScreenProps {
  onBack?: () => void;
  onSelectSession?: (session: RealSessionItem) => void;
}

export const SessionsScreen: React.FC<SessionsScreenProps> = ({
  onBack,
  onSelectSession,
}) => {
  const sessions = useDaemonStore((s) => s.sessions);
  const workspaces = useDaemonStore((s) => s.workspaces);
  const selectedWorkspace = useDaemonStore((s) => s.selectedWorkspace);
  const setSelectedWorkspace = useDaemonStore((s) => s.setSelectedWorkspace);
  const isLoadingSessions = useDaemonStore((s) => s.isLoadingSessions);
  const fetchSessions = useDaemonStore((s) => s.fetchSessions);
  const selectSessionInStore = useDaemonStore((s) => s.selectSession);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  const [searchQuery, setSearchQuery] = useState('');

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

  const handleCardPress = async (session: RealSessionItem) => {
    await selectSessionInStore(session);
    if (onSelectSession) {
      onSelectSession(session);
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
        title="Agent Sessions & Transcripts"
        subtitle={`${activeMachine?.name || 'DESKTOP-BJI38IC'} • cloud-daemon`}
        onBack={onBack}
        onMore={fetchSessions}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Host Status Micro-Bar */}
        <View style={styles.microBar}>
          <View style={styles.microBarLeft}>
            <View style={styles.pulseDot} />
            <Text style={styles.microBarTitle}>DAEMON ACTIVE</Text>
            <Text style={styles.microBarSub}>• 0-db in-memory transcripts</Text>
          </View>
          <View style={styles.creditsPill}>
            <Zap size={12} color={colors.green} />
            <Text style={styles.creditsText}>{sessions.length} sessions discovered</Text>
          </View>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search prompts, workspaces, session IDs..."
            placeholderTextColor={colors.textMuted}
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

        {/* Filter Chips Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedWorkspace === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedWorkspace('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                selectedWorkspace === 'all' && styles.chipTextActive,
              ]}
            >
              All Workspaces
            </Text>
            <View style={styles.chipCountBadge}>
              <Text style={styles.chipCountText}>{sessions.length}</Text>
            </View>
          </TouchableOpacity>

          {workspaces.map((ws) => {
            const count = sessions.filter((s) => s.workspaceName === ws).length;
            return (
              <TouchableOpacity
                key={ws}
                style={[
                  styles.filterChip,
                  selectedWorkspace === ws && styles.filterChipActive,
                ]}
                onPress={() => setSelectedWorkspace(ws)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedWorkspace === ws && styles.chipTextActive,
                  ]}
                >
                  {ws}
                </Text>
                <View style={styles.chipCountBadge}>
                  <Text style={styles.chipCountText}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Counter and Sort Header */}
        <View style={styles.counterRow}>
          <View style={styles.counterLeft}>
            <Text style={styles.counterTitle}>ACTIVE SESSIONS</Text>
            <Text style={styles.counterDot}>•</Text>
            <Text style={styles.counterNumber}>
              {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={fetchSessions}
            activeOpacity={0.7}
          >
            {isLoadingSessions ? (
              <ActivityIndicator size="small" color={colors.blue} />
            ) : (
              <RefreshCw size={13} color={colors.textMuted} />
            )}
            <Text style={styles.sortButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Session Cards List */}
        {isLoadingSessions && sessions.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.loadingText}>Loading sessions from Antigravity runtime...</Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No sessions found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? `No sessions matching "${searchQuery}"` : 'No active workspace sessions detected on host'}
            </Text>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {filteredSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => handleCardPress(session)}
                activeOpacity={0.7}
              >
                <View style={styles.sessionCardTop}>
                  <View style={styles.sessionHeaderRow}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={styles.sessionTimeAgo}>{formatTimeAgo(session.updatedAt)}</Text>
                  </View>
                  <Text style={styles.sessionSub} numberOfLines={1}>
                    {session.workspaceName} • {session.workspacePath}
                  </Text>
                </View>

                {/* Metadata Strip */}
                <View style={styles.metaStrip}>
                  <View style={styles.metaItem}>
                    <Play size={10} color={colors.green} />
                    <Text style={styles.metaItemText}>
                      {session.messageCount} messages
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <Clock size={10} color={colors.textMuted} />
                    <Text style={[styles.metaItemText, { color: colors.textMuted }]}>
                      {formatTimeAgo(session.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <GitBranch size={10} color={colors.blue} />
                    <Text style={[styles.metaItemText, { color: colors.blue }]}>
                      {session.id.slice(0, 7)}
                    </Text>
                  </View>

                  <View style={[styles.metaItem, styles.metaItemRight]}>
                    <Sparkles size={10} color={colors.purple} />
                    <Text style={[styles.metaItemText, { color: colors.purple }]}>
                      {session.model || 'Antigravity'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  microBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  microBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.green,
  },
  microBarTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  microBarSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditsText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
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
  chipsScroll: {
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  filterChipActive: {
    backgroundColor: colors.blueBg,
    borderColor: colors.blueBg,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  chipCountBadge: {
    backgroundColor: colors.borderDefault,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  chipCountText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  counterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  counterDot: {
    fontSize: 11,
    color: colors.textMuted,
  },
  counterNumber: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  sessionsList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    padding: 12,
  },
  sessionCardTop: {
    marginBottom: 8,
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  sessionTimeAgo: {
    fontSize: 11,
    color: colors.textMuted,
  },
  sessionSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgHover,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  metaItemRight: {
    marginLeft: 'auto',
  },
  metaItemText: {
    fontSize: 10,
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

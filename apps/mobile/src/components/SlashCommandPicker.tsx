import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Terminal,
  Brain,
  Sparkles,
  Clock,
  Compass,
  Wrench,
  Search,
  X,
  Play,
  Command,
  Zap,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';

export interface SlashCommandItem {
  command: string;
  category: 'workflow' | 'context' | 'cli';
  title: string;
  description: string;
  template: string;
  immediate?: boolean;
}

export const ANTIGRAVITY_COMMANDS: SlashCommandItem[] = [
  // 1. Agent Workflows & Strategy
  {
    command: '/plan',
    category: 'workflow',
    title: 'Plan Strategy',
    description: 'Draft step-by-step implementation plan before modifying files',
    template: '/plan ',
  },
  {
    command: '/goal',
    category: 'workflow',
    title: 'Autonomous Goal',
    description: 'Execute long-running task thoroughly until completion',
    template: '/goal ',
  },
  {
    command: '/boost',
    category: 'workflow',
    title: 'Deep Thinking',
    description: 'Enable deep strategic planning, multiple perspectives & rigor',
    template: '/boost ',
  },
  {
    command: '/grill-me',
    category: 'workflow',
    title: 'Interactive Interview',
    description: 'Agent asks targeted questions to resolve architectural trade-offs',
    template: '/grill-me ',
  },
  {
    command: '/teamwork',
    category: 'workflow',
    title: 'Multi-Agent Team',
    description: 'Coordinate a team of specialized subagents on large tasks',
    template: '/teamwork ',
  },
  {
    command: '/browser',
    category: 'workflow',
    title: 'Browser Automation',
    description: 'Drive web navigation, search, and page interaction',
    template: '/browser ',
  },

  // 2. Context & Learning
  {
    command: '/artifact',
    category: 'context',
    title: 'Artifacts & Plans',
    description: 'Browse, preview & inspect session artifacts, plans, and reports',
    template: '/artifact',
    immediate: true,
  },
  {
    command: '/artifacts',
    category: 'context',
    title: 'All Artifacts',
    description: 'View all session artifacts, plans, diffs, and generated documents',
    template: '/artifacts',
    immediate: true,
  },
  {
    command: '/compact',
    category: 'context',
    title: 'Compact Context',
    description: 'Summarize transcript history to reclaim context window space',
    template: '/compact',
    immediate: true,
  },
  {
    command: '/learn',
    category: 'context',
    title: 'Persist Learnings',
    description: 'Record user instructions & setup rules for future turns',
    template: '/learn ',
  },
  {
    command: '/schedule',
    category: 'context',
    title: 'Schedule Timer/Cron',
    description: 'Set a one-time timer or recurring cron background job',
    template: '/schedule ',
  },

  // 3. CLI Utilities & Information
  {
    command: '/skills',
    category: 'cli',
    title: 'List Skills',
    description: 'Display all installed & loaded agent skills',
    template: '/skills',
    immediate: true,
  },
  {
    command: '/models',
    category: 'cli',
    title: 'Available Models',
    description: 'List accessible AI models (Gemini, Claude, GPT)',
    template: '/models',
    immediate: true,
  },
  {
    command: '/mcp',
    category: 'cli',
    title: 'MCP Servers',
    description: 'List active Model Context Protocol server integrations',
    template: '/mcp list',
    immediate: true,
  },
  {
    command: '/usage',
    category: 'cli',
    title: 'Quota & Usage',
    description: 'View current token consumption and remaining limits',
    template: '/usage',
    immediate: true,
  },
  {
    command: '/help',
    category: 'cli',
    title: 'Help & Commands',
    description: 'Show all available Antigravity CLI commands and shortcuts',
    template: '/help',
    immediate: true,
  },
  {
    command: '/changelog',
    category: 'cli',
    title: 'Changelog',
    description: 'View latest Antigravity CLI release notes',
    template: '/changelog',
    immediate: true,
  },
];

interface SlashCommandPickerProps {
  visible: boolean;
  searchQuery: string;
  onSelect: (item: SlashCommandItem, immediate?: boolean) => void;
  onClose: () => void;
}

export const SlashCommandPicker: React.FC<SlashCommandPickerProps> = ({
  visible,
  searchQuery,
  onSelect,
  onClose,
}) => {
  if (!visible) return null;

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    const rawQuery = searchQuery.trim().toLowerCase();
    const query = rawQuery.startsWith('/') ? rawQuery.slice(1) : rawQuery;

    if (!query) return ANTIGRAVITY_COMMANDS;

    return ANTIGRAVITY_COMMANDS.filter((cmd) => {
      const cleanCmd = cmd.command.slice(1).toLowerCase();
      return (
        cleanCmd.includes(query) ||
        cmd.title.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const renderIcon = (cmd: SlashCommandItem) => {
    switch (cmd.category) {
      case 'workflow':
        return <Sparkles size={14} color="#ffffff" />;
      case 'context':
        return <Brain size={14} color="#ffffff" />;
      case 'cli':
      default:
        return <Terminal size={14} color="#ffffff" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Command size={13} color={colors.green} />
          <Text style={styles.headerTitle}>ANTIGRAVITY COMMANDS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredCommands.length}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Commands List */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {filteredCommands.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No matching Antigravity commands</Text>
          </View>
        ) : (
          filteredCommands.map((item) => (
            <TouchableOpacity
              key={item.command}
              style={styles.itemRow}
              activeOpacity={0.7}
              onPress={() => onSelect(item, false)}
            >
              {/* Category Icon */}
              <View style={styles.iconBox}>{renderIcon(item)}</View>

              {/* Command Info */}
              <View style={styles.infoCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.commandTag}>{item.command}</Text>
                  <Text style={styles.titleText}>{item.title}</Text>
                </View>
                <Text style={styles.descText} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>

              {/* Immediate Run Action (if self-contained command) */}
              {item.immediate ? (
                <TouchableOpacity
                  style={styles.runNowBtn}
                  activeOpacity={0.8}
                  onPress={() => onSelect(item, true)}
                >
                  <Play size={10} color="#ffffff" />
                  <Text style={styles.runNowText}>Run</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    maxHeight: 250,
    marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    backgroundColor: colors.bgCanvasInset,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: colors.bgHover,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  countBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },
  closeBtn: {
    padding: 2,
  },
  listScroll: {
    maxHeight: 210,
  },
  listContent: {
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 38, 45, 0.4)',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoCol: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  commandTag: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.green,
    fontFamily: typography.mono,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  descText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  runNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.greenBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  runNowText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card, Badge, Button, Text } from 'panelui-native';
import {
  Terminal,
  Brain,
  Sparkles,
  Command,
  X,
  Play,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

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
    title: 'Grill Me',
    description: 'Interactive interview to resolve design decisions',
    template: '/grill-me ',
  },
  {
    command: '/learn',
    category: 'workflow',
    title: 'Learn Memory',
    description: 'Persist architectural corrections into project AGENTS.md rules',
    template: '/learn ',
  },
  {
    command: '/teamwork',
    category: 'workflow',
    title: 'Team Swarm',
    description: 'Deploy coordinator and autonomous specialist workers',
    template: '/teamwork ',
  },

  // 2. Context & Diagnostics
  {
    command: '/compact',
    category: 'context',
    title: 'Compact Transcript',
    description: 'Summarize transcript and free up LLM context window tokens',
    template: '/compact',
    immediate: true,
  },
  {
    command: '/schedule',
    category: 'context',
    title: 'Schedule Timer',
    description: 'Schedule one-shot timer or recurring cron check',
    template: '/schedule ',
  },
  {
    command: '/browser',
    category: 'context',
    title: 'Web Browser',
    description: 'Search documentation or interact with external services',
    template: '/browser ',
  },
  {
    command: '/artifacts',
    category: 'context',
    title: 'Artifacts Browser',
    description: 'View implementation plans, diffs, and walkthrough documents',
    template: '/artifacts',
    immediate: true,
  },

  // 3. Command Line & Runtime
  {
    command: '/terminal',
    category: 'cli',
    title: 'Interactive Terminal',
    description: 'Open full-screen host bash console with ANSI streaming',
    template: '/terminal',
    immediate: true,
  },
  {
    command: '/healer',
    category: 'cli',
    title: 'Auto-Healer',
    description: 'Inspect auto-healing proposals and patch review',
    template: '/healer',
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!visible) return ANTIGRAVITY_COMMANDS;
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
  }, [searchQuery, visible]);

  if (!visible) return null;

  const renderIcon = (cmd: SlashCommandItem) => {
    const iconColor = isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5';
    switch (cmd.category) {
      case 'workflow':
        return <Sparkles size={14} color={iconColor} />;
      case 'context':
        return <Brain size={14} color={iconColor} />;
      case 'cli':
      default:
        return <Terminal size={14} color={iconColor} />;
    }
  };

  return (
    <Card className="absolute left-3 right-3 bottom-20 z-50 bg-popover border border-border p-0 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <View className="px-3.5 py-2.5 bg-surface border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Command size={13} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
          <Text className="text-xs font-semibold text-foreground tracking-wider uppercase">
            Commands
          </Text>
          <Badge variant="outline" size="sm" className="px-1.5 py-0">
            <Text className="text-[10px] font-mono text-muted-foreground">
              {filteredCommands.length}
            </Text>
          </Badge>
        </View>

        <Button
          variant="ghost"
          size="sm"
          className="w-6 h-6 p-0 items-center justify-center rounded-lg"
          onPress={onClose}
        >
          <X size={13} color={isLight ? '#686868' : '#a3a3a3'} />
        </Button>
      </View>

      {/* Commands List */}
      <ScrollView
        style={{ maxHeight: 240 }}
        contentContainerStyle={{ padding: 6 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {filteredCommands.length === 0 ? (
          <View className="py-6 items-center justify-center">
            <Text className="text-xs text-muted-foreground">
              No matching commands
            </Text>
          </View>
        ) : (
          filteredCommands.map((item) => (
            <TouchableOpacity
              key={item.command}
              className="px-2.5 py-2 rounded-xl flex-row items-center gap-2.5 my-0.5 active:bg-surface-secondary"
              activeOpacity={0.7}
              onPress={() => onSelect(item, false)}
            >
              {/* Category Icon */}
              <View className="w-7 h-7 rounded-lg bg-surface-secondary border border-border items-center justify-center">
                {renderIcon(item)}
              </View>

              {/* Command Info */}
              <View className="flex-1 mr-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-mono font-bold text-foreground">
                    {item.command}
                  </Text>
                  <Text className="text-xs font-medium text-muted-foreground">
                    {item.title}
                  </Text>
                </View>
                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                  {item.description}
                </Text>
              </View>

              {/* Run Immediately Button */}
              {item.immediate ? (
                <Button
                  variant="primary"
                  size="xs"
                  className="px-2 py-0.5 h-6 flex-row items-center gap-1"
                  onPress={() => onSelect(item, true)}
                >
                  <Play size={9} color={isLight ? '#fafafa' : '#262626'} />
                  <Text className="text-[10px] font-semibold text-primary-foreground">Run</Text>
                </Button>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Card>
  );
};

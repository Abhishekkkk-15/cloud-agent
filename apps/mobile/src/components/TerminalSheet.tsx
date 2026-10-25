import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Terminal, X, Trash2, Play, Square, RefreshCw } from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, type TerminalOutputLine } from '../stores/useDaemonStore';

interface TerminalSheetProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'git status',
  'git diff --stat',
  'ls -la',
  'pwd',
  'git log -n 3 --oneline',
  'pnpm test',
];

interface TextSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

const ANSI_COLOR_MAP: Record<number, string> = {
  30: '#6e7681',
  31: '#f85149',
  32: '#3fb950',
  33: '#d29922',
  34: '#58a6ff',
  35: '#bc8cff',
  36: '#39c5cf',
  37: '#f0f6fc',
  90: '#8b949e',
  91: '#ffa198',
  92: '#56d364',
  93: '#e3b341',
  94: '#79c0ff',
  95: '#d2a8ff',
  96: '#56d4dd',
  97: '#ffffff',
};

function parseAnsi(raw: string, defaultColor: string): TextSegment[] {
  // Regex matches ANSI escape codes like \x1b[32m or \x1b[0m or \x1b[1;31m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  const segments: TextSegment[] = [];
  let currentColor = defaultColor;
  let currentBold = false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: raw.slice(lastIndex, match.index),
        color: currentColor,
        bold: currentBold,
      });
    }

    const codes = match[1] ? match[1].split(';').map(Number) : [0];
    for (const code of codes) {
      if (code === 0) {
        currentColor = defaultColor;
        currentBold = false;
      } else if (code === 1) {
        currentBold = true;
      } else if (code === 22) {
        currentBold = false;
      } else if (ANSI_COLOR_MAP[code]) {
        currentColor = ANSI_COLOR_MAP[code];
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({
      text: raw.slice(lastIndex),
      color: currentColor,
      bold: currentBold,
    });
  }

  return segments;
}

export const TerminalSheet: React.FC<TerminalSheetProps> = ({ visible, onClose }) => {
  const terminalLines = useDaemonStore((s) => s.terminalLines);
  const isTerminalRunning = useDaemonStore((s) => s.isTerminalRunning);
  const execTerminalCommand = useDaemonStore((s) => s.execTerminalCommand);
  const clearTerminal = useDaemonStore((s) => s.clearTerminal);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);

  const [inputCommand, setInputCommand] = useState('');
  const scrollRef = useRef<any>(null);

  const activeCwd = useMemo(() => {
    const raw = activeSession?.workspacePath || targetWorkspacePath || '';
    if (!raw) return 'workspace';
    const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || raw;
  }, [activeSession, targetWorkspacePath]);

  // Auto-scroll to bottom whenever new lines arrive
  useEffect(() => {
    if (visible && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [terminalLines, visible]);

  const handleRun = async (cmd?: string) => {
    const commandToRun = (cmd ?? inputCommand).trim();
    if (!commandToRun || isTerminalRunning) return;

    if (!cmd) {
      setInputCommand('');
    }
    await execTerminalCommand(commandToRun);
  };

  const renderLine = (line: TerminalOutputLine) => {
    if (line.stream === 'info') {
      const isCmd = line.text.startsWith('$ ');
      return (
        <View key={line.id} style={styles.lineWrapper}>
          <Text
            style={[
              styles.monoText,
              isCmd ? styles.commandPromptText : styles.systemInfoText,
            ]}
          >
            {line.text}
          </Text>
        </View>
      );
    }

    const defaultColor = line.stream === 'stderr' ? '#f85149' : '#c9d1d9';
    const segments = parseAnsi(line.text, defaultColor);

    return (
      <View key={line.id} style={styles.lineWrapper}>
        <Text style={styles.monoText}>
          {segments.map((seg, idx) => (
            <Text
              key={idx}
              style={{
                color: seg.color || defaultColor,
                fontWeight: seg.bold ? '700' : '400',
              }}
            >
              {seg.text}
            </Text>
          ))}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Terminal size={16} color="#0077b6" />
              </View>
              <View style={styles.titleCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>Terminal</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isTerminalRunning ? '#0077b6' : '#238636' },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {isTerminalRunning ? 'Executing...' : 'Ready'}
                  </Text>
                </View>
                <Text style={styles.subtitle} numberOfLines={1}>
                  cwd: ~/{activeCwd}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={clearTerminal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear terminal"
              >
                <Trash2 size={16} color="#8b949e" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close terminal"
              >
                <X size={18} color="#f0f6fc" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Command Pills */}
          <View style={styles.quickBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickBarContent}
            >
              {QUICK_COMMANDS.map((cmd) => (
                <TouchableOpacity
                  key={cmd}
                  style={styles.quickPill}
                  onPress={() => handleRun(cmd)}
                  disabled={isTerminalRunning}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickPillText}>{cmd}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Terminal Console Output */}
          <View style={styles.consoleContainer}>
            <ScrollView
              ref={scrollRef}
              style={styles.consoleScroll}
              contentContainerStyle={styles.consoleContent}
              indicatorStyle="white"
            >
              {terminalLines.length === 0 ? (
                <View style={styles.emptyState}>
                  <Terminal size={28} color="#30363d" />
                  <Text style={styles.emptyStateTitle}>Daemon Shell Ready</Text>
                  <Text style={styles.emptyStateSub}>
                    Commands execute directly in your workspace environment on the host machine.
                  </Text>
                </View>
              ) : (
                terminalLines.map(renderLine)
              )}
            </ScrollView>
          </View>

          {/* Command Input Bar */}
          <View style={styles.inputBar}>
            <Text style={styles.promptSymbol}>$</Text>
            <TextInput
              style={styles.textInput}
              value={inputCommand}
              onChangeText={setInputCommand}
              placeholder="Enter bash command..."
              placeholderTextColor="#6e7681"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => handleRun()}
              editable={!isTerminalRunning}
            />
            <TouchableOpacity
              style={[
                styles.runBtn,
                (!inputCommand.trim() || isTerminalRunning) && styles.runBtnDisabled,
              ]}
              onPress={() => handleRun()}
              disabled={!inputCommand.trim() || isTerminalRunning}
              activeOpacity={0.8}
            >
              {isTerminalRunning ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Play size={14} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '500',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21262d',
  },
  quickBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#0d1117',
    paddingVertical: 8,
  },
  quickBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickPill: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickPillText: {
    color: '#c9d1d9',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  consoleContainer: {
    flex: 1,
    backgroundColor: '#010409',
  },
  consoleScroll: {
    flex: 1,
  },
  consoleContent: {
    padding: 12,
    paddingBottom: 24,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    color: '#8b949e',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSub: {
    color: '#6e7681',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  lineWrapper: {
    marginBottom: 3,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#c9d1d9',
  },
  commandPromptText: {
    color: '#48cae4',
    fontWeight: '700',
  },
  systemInfoText: {
    color: '#8b949e',
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptSymbol: {
    color: '#0077b6',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 38,
    color: '#f0f6fc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  runBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0077b6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  runBtnDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
});

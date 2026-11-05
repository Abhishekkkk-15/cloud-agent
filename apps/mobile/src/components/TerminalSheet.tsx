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
  30: '#737373',
  31: '#f85149',
  32: '#fafafa',
  33: '#d29922',
  34: '#58a6ff',
  35: '#bc8cff',
  36: '#39c5cf',
  37: '#fafafa',
  90: '#a3a3a3',
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

    const defaultColor = line.stream === 'stderr' ? '#f85149' : '#d4d4d4';
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
                <Terminal size={16} color="#fafafa" />
              </View>
              <View style={styles.titleCol}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>Terminal</Text>

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
                <Trash2 size={16} color="#a3a3a3" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close terminal"
              >
                <X size={18} color="#fafafa" />
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
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {terminalLines.length === 0 ? (
                <View style={styles.emptyState}>
                  <Terminal size={28} color="rgba(255, 255, 255, 0.10)" />
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
              placeholderTextColor="#737373"
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
                <ActivityIndicator size="small" color="#0a0a0a" />
              ) : (
                <Play size={14} color={!inputCommand.trim() ? '#737373' : '#0a0a0a'} />
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
    backgroundColor: '#0a0a0a',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#161616',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
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
    color: '#fafafa',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  statusText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
  },
  subtitle: {
    color: '#a3a3a3',
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
    backgroundColor: '#262626',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  quickBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#0a0a0a',
    paddingVertical: 8,
  },
  quickBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickPill: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickPillText: {
    color: '#d4d4d4',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  consoleContainer: {
    flex: 1,
    backgroundColor: '#121212',
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
    color: '#a3a3a3',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSub: {
    color: '#737373',
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
    color: '#d4d4d4',
  },
  commandPromptText: {
    color: '#fafafa',
    fontWeight: '700',
  },
  systemInfoText: {
    color: '#a3a3a3',
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptSymbol: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 38,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  runBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  runBtnDisabled: {
    backgroundColor: '#262626',
    opacity: 0.6,
  },
});

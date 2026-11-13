import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
  StatusBar,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Terminal,
  X,
  Trash2,
  Play,
  Square,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
} from './Icons';
import { useDaemonStore, type TerminalOutputLine } from '../stores/useDaemonStore';
import { copyToClipboard } from '../lib/clipboard';

interface TerminalSheetProps {
  visible: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  'git status',
  'git diff --stat',
  'ls -la',
  'pwd',
  'git log -n 5 --oneline',
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
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);

  const terminalLines = useDaemonStore((s) => s.terminalLines);
  const isTerminalRunning = useDaemonStore((s) => s.isTerminalRunning);
  const terminalHistory = useDaemonStore((s) => s.terminalHistory);
  const execTerminalCommand = useDaemonStore((s) => s.execTerminalCommand);
  const killTerminalCommand = useDaemonStore((s) => s.killTerminalCommand);
  const clearTerminal = useDaemonStore((s) => s.clearTerminal);
  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const [inputCommand, setInputCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<any>(null);

  const activeCwd = useMemo(() => {
    const raw = activeSession?.workspacePath || targetWorkspacePath || '';
    if (!raw) return 'workspace';
    const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || raw;
  }, [activeSession, targetWorkspacePath]);

  // Keyboard avoidance handler for both iOS & Android in full-screen modals
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const height = e.endCoordinates ? e.endCoordinates.height : 0;
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext({
          duration: e.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setKeyboardHeight(height);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    };

    const onHide = (e?: any) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext({
          duration: e?.duration || 200,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  // Auto-scroll to bottom whenever new lines arrive
  useEffect(() => {
    if (visible && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [terminalLines, visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    setKeyboardHeight(0);
    onClose();
  };

  const handleRun = async (cmd?: string) => {
    const commandToRun = (cmd ?? inputCommand).trim();
    if (!commandToRun || isTerminalRunning) return;

    setHistoryIndex(-1);
    if (!cmd) {
      setInputCommand('');
    }
    await execTerminalCommand(commandToRun);
  };

  const handleHistoryUp = () => {
    if (terminalHistory.length === 0) return;
    const nextIdx = Math.min(historyIndex + 1, terminalHistory.length - 1);
    setHistoryIndex(nextIdx);
    setInputCommand(terminalHistory[nextIdx] || '');
  };

  const handleHistoryDown = () => {
    if (historyIndex <= 0) {
      setHistoryIndex(-1);
      setInputCommand('');
      return;
    }
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    setInputCommand(terminalHistory[nextIdx] || '');
  };

  const handleCopyOutput = () => {
    const text = terminalLines.map((l) => l.text).join('\n');
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderLine = (line: TerminalOutputLine) => {
    if (line.stream === 'info') {
      const isCmd = line.text.startsWith('$ ');
      return (
        <View key={line.id} style={styles.lineWrapper}>
          <Text
            style={[
              styles.monoText,
              isCmd
                ? [styles.commandPromptText, isSwiss ? { color: '#DC201E' } : isLight && { color: '#0969da' }]
                : [styles.systemInfoText, isSwiss ? { color: '#6B665E' } : isLight && { color: '#57606a' }],
            ]}
          >
            {line.text}
          </Text>
        </View>
      );
    }

    const defaultColor = line.stream === 'stderr' ? '#f85149' : (isSwiss ? '#111010' : isLight ? '#1f2328' : '#d4d4d4');
    const segments = parseAnsi(line.text, defaultColor);

    return (
      <View key={line.id} style={styles.lineWrapper}>
        <Text style={[styles.monoText, isSwiss && { color: '#111010' }]}>
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
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />
      <View
        style={[
          styles.container,
          isLight && { backgroundColor: isSwiss ? '#F8F3EC' : '#ffffff' },
          {
            paddingBottom: keyboardHeight,
          },
        ]}
      >
        {/* Header with notch & status bar clearance */}
        <View
          style={[
            styles.header,
            {
              paddingTop: topInset + (Platform.OS === 'ios' ? 8 : 10),
            },
            isLight && styles.headerLight,
            isSwiss && styles.headerSwiss,
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.iconCircle, isLight && styles.iconCircleLight, isSwiss && styles.iconCircleSwiss]}>
              <Terminal size={16} color={isSwiss ? '#DC201E' : isLight ? '#0969da' : '#fafafa'} />
            </View>
            <View style={styles.titleCol}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, isLight && { color: isSwiss ? '#111010' : '#1f2328' }]}>Terminal</Text>
                <Text style={[styles.statusText, isLight && { color: isSwiss ? '#6B665E' : '#57606a' }]}>
                  {isTerminalRunning ? 'Executing...' : 'Ready'}
                </Text>
              </View>
              <Text style={[styles.subtitle, isLight && { color: isSwiss ? '#6B665E' : '#57606a' }]} numberOfLines={1}>
                cwd: ~/{activeCwd}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.actionBtn, isLight && styles.actionBtnLight, isSwiss && styles.actionBtnSwiss]}
              onPress={handleCopyOutput}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Copy all terminal output"
            >
              {copied ? (
                <Check size={15} color="#56d364" />
              ) : (
                <Copy size={15} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isLight && styles.actionBtnLight, isSwiss && styles.actionBtnSwiss]}
              onPress={clearTerminal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear terminal"
            >
              <Trash2 size={16} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.closeBtn, isLight && styles.closeBtnLight, isSwiss && styles.closeBtnSwiss]}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close terminal"
            >
              <X size={18} color={isSwiss ? '#111010' : isLight ? '#1f2328' : '#fafafa'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Command Pills */}
        <View style={[styles.quickBar, isLight && styles.quickBarLight, isSwiss && styles.quickBarSwiss]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.quickBarContent}
          >
            {QUICK_COMMANDS.map((cmd) => (
              <TouchableOpacity
                key={cmd}
                style={[styles.quickPill, isLight && styles.quickPillLight, isSwiss && styles.quickPillSwiss]}
                onPress={() => handleRun(cmd)}
                disabled={isTerminalRunning}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickPillText, isLight && styles.quickPillTextLight, isSwiss && styles.quickPillTextSwiss]}>
                  {cmd}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Terminal Console Output */}
        <View style={[styles.consoleContainer, isLight && styles.consoleContainerLight, isSwiss && styles.consoleContainerSwiss]}>
          <ScrollView
            ref={scrollRef}
            style={styles.consoleScroll}
            contentContainerStyle={styles.consoleContent}
            indicatorStyle={isLight ? 'black' : 'white'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {terminalLines.length === 0 ? (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.emptyState}>
                  <Terminal size={28} color={isSwiss ? 'rgba(17, 16, 16, 0.20)' : isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.10)'} />
                  <Text style={[styles.emptyStateTitle, isLight && { color: isSwiss ? '#6B665E' : '#57606a' }]}>
                    Daemon Shell Ready
                  </Text>
                  <Text style={[styles.emptyStateSub, isLight && { color: isSwiss ? '#9C9589' : '#8c959f' }]}>
                    Commands execute directly in your workspace environment on the host machine.
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            ) : (
              terminalLines.map(renderLine)
            )}
          </ScrollView>
        </View>

        {/* Command Input Bar */}
        <View
          style={[
            styles.inputBar,
            isLight && styles.inputBarLight,
            isSwiss && styles.inputBarSwiss,
            {
              paddingBottom: keyboardHeight > 0
                ? 8
                : Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) + 4,
            },
          ]}
        >
          <Text style={[styles.promptSymbol, isSwiss ? { color: '#DC201E' } : isLight && { color: '#0969da' }]}>$</Text>
          <TextInput
            style={[styles.textInput, isLight && styles.textInputLight, isSwiss && styles.textInputSwiss]}
            value={inputCommand}
            onChangeText={setInputCommand}
            placeholder={isTerminalRunning ? 'Process running...' : 'Enter bash command...'}
            placeholderTextColor={isSwiss ? '#9C9589' : isLight ? '#8c959f' : '#737373'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={() => handleRun()}
            editable={!isTerminalRunning}
          />

          {/* History Stepper Buttons */}
          <View style={styles.historyBtnGroup}>
            <TouchableOpacity
              style={[styles.historyBtn, isLight && styles.historyBtnLight, isSwiss && styles.historyBtnSwiss]}
              onPress={handleHistoryUp}
              disabled={terminalHistory.length === 0}
              accessibilityLabel="Previous command"
            >
              <ChevronUp size={14} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.historyBtn, isLight && styles.historyBtnLight, isSwiss && styles.historyBtnSwiss]}
              onPress={handleHistoryDown}
              disabled={historyIndex < 0}
              accessibilityLabel="Next command"
            >
              <ChevronDown size={14} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
            </TouchableOpacity>
          </View>

          {/* Run or Kill Action */}
          {isTerminalRunning ? (
            <TouchableOpacity
              style={styles.killBtn}
              onPress={killTerminalCommand}
              activeOpacity={0.8}
              accessibilityLabel="Kill running process"
            >
              <Square size={12} color="#ffffff" />
              <Text style={styles.killBtnText}>KILL</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.runBtn,
                !inputCommand.trim() && (isSwiss ? styles.runBtnDisabledSwiss : styles.runBtnDisabled),
                isSwiss && inputCommand.trim() && { backgroundColor: '#DC201E' },
                !isSwiss && isLight && inputCommand.trim() && { backgroundColor: '#0969da' },
              ]}
              onPress={() => handleRun()}
              disabled={!inputCommand.trim()}
              activeOpacity={0.8}
            >
              <Play size={13} color={!inputCommand.trim() ? (isSwiss ? '#9C9589' : '#737373') : '#ffffff'} />
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#161616',
  },
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#d0d7de',
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
  iconCircleLight: {
    backgroundColor: 'rgba(9, 105, 218, 0.08)',
    borderColor: 'rgba(9, 105, 218, 0.20)',
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
  actionBtnLight: {
    backgroundColor: '#f6f8fa',
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  closeBtnLight: {
    backgroundColor: '#f6f8fa',
    borderWidth: 1,
    borderColor: '#d0d7de',
  },
  quickBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#0a0a0a',
    paddingVertical: 8,
  },
  quickBarLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
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
  quickPillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  quickPillText: {
    color: '#d4d4d4',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  quickPillTextLight: {
    color: '#1f2328',
  },
  consoleContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  consoleContainerLight: {
    backgroundColor: '#f6f8fa',
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
  inputBarLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d0d7de',
  },
  promptSymbol: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    height: 38,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  textInputLight: {
    color: '#1f2328',
  },
  historyBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 6,
  },
  historyBtn: {
    width: 26,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBtnLight: {
    backgroundColor: '#eaeef2',
  },
  runBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBtnDisabled: {
    backgroundColor: '#262626',
    opacity: 0.6,
  },
  killBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
  },
  killBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Swiss Theme Overrides
  headerSwiss: {
    backgroundColor: '#F1EBE1',
    borderBottomColor: 'rgba(17, 16, 16, 0.14)',
  },
  iconCircleSwiss: {
    backgroundColor: '#EBE4D8',
    borderColor: 'rgba(17, 16, 16, 0.16)',
  },
  actionBtnSwiss: {
    backgroundColor: '#EBE4D8',
    borderWidth: 1,
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  closeBtnSwiss: {
    backgroundColor: '#EBE4D8',
    borderWidth: 1,
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  quickBarSwiss: {
    backgroundColor: '#F8F3EC',
    borderBottomColor: 'rgba(17, 16, 16, 0.14)',
  },
  quickPillSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.16)',
  },
  quickPillTextSwiss: {
    color: '#111010',
  },
  consoleContainerSwiss: {
    backgroundColor: '#F1EBE1',
  },
  inputBarSwiss: {
    backgroundColor: '#F8F3EC',
    borderTopColor: 'rgba(17, 16, 16, 0.14)',
  },
  textInputSwiss: {
    color: '#111010',
  },
  historyBtnSwiss: {
    backgroundColor: '#EBE4D8',
  },
  runBtnDisabledSwiss: {
    backgroundColor: '#EBE4D8',
    opacity: 0.7,
  },
});

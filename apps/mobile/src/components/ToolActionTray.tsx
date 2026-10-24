import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import {
  Terminal,
  FileText,
  FileCode,
  Link,
  GitFork,
  Search,
  Sparkles,
  Clock,
  Check,
  Copy,
  X,
  FolderGit2,
  CheckCircle2,
  XCircle,
  Folder,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { MarkdownText, JsonViewer } from './MarkdownText';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ActionStep {
  id: string;
  title: string;
  category: 'repo' | 'mcp' | 'skill' | 'terminal' | 'file' | 'search';
  duration?: string;
  hasDetails?: boolean;
  details?: string;
  toolName?: string;
  args?: Record<string, any>;
  output?: string;
  status?: 'success' | 'running' | 'error';
  exitCode?: number;
}

interface ToolActionTrayProps {
  visible: boolean;
  action: ActionStep | null;
  onClose: () => void;
}

export const ToolActionTray: React.FC<ToolActionTrayProps> = ({ visible, action, onClose }) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // PanResponder to handle dragging from top to bottom
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture downward dragging
        return gestureState.dy > 4;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down past 110px or fast downward velocity, dismiss
        if (gestureState.dy > 110 || gestureState.vy > 0.45) {
          handleClose();
        } else {
          // Snap back up
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleCopyInput = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  };

  const handleCopyOutput = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  if (!visible || !action) {
    return null;
  }

  const renderCategoryIcon = (category: ActionStep['category'], size = 16) => {
    switch (category) {
      case 'repo':
        return <FolderGit2 size={size} color="#58a6ff" />;
      case 'mcp':
        return <Link size={size} color="#58a6ff" />;
      case 'skill':
        return <GitFork size={size} color="#d2a8ff" />;
      case 'file':
        return <FileText size={size} color="#58a6ff" />;
      case 'search':
        return <Search size={size} color="#79c0ff" />;
      case 'terminal':
      default:
        return <Terminal size={size} color="#3fb950" />;
    }
  };

  const getCategoryLabel = (category: ActionStep['category']) => {
    switch (category) {
      case 'repo':
        return 'Git Repository';
      case 'mcp':
        return 'MCP Protocol';
      case 'skill':
        return 'Agent Skill';
      case 'file':
        return 'File System';
      case 'search':
        return 'Web Search';
      case 'terminal':
      default:
        return 'Terminal Execution';
    }
  };

  // Extract display values
  const toolName = action.toolName || (action.category === 'terminal' ? 'run_command' : action.id);
  const args = action.args || {};
  const hasCommandLine = Boolean(args.CommandLine);
  const commandLine = args.CommandLine ? String(args.CommandLine).replace(/^"|"$/g, '') : '';
  const filePath = args.Path || args.AbsolutePath ? String(args.Path || args.AbsolutePath).replace(/^"|"$/g, '') : '';
  const isSuccess = action.status !== 'error' && (action.exitCode === undefined || action.exitCode === 0);

  // Prepare input text for raw copy
  const rawInputStr = commandLine || (args && Object.keys(args).length > 0 ? JSON.stringify(args, null, 2) : action.details || '');
  const rawOutputStr = action.output || (action.details && action.details !== rawInputStr ? action.details : '');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop overlay */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Animated Slide Tray */}
        <Animated.View
          style={[
            styles.traySheet,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Draggable Top Handle Bar */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragPill} />
          </View>

          {/* Tray Header */}
          <View style={styles.trayHeader}>
            <View style={styles.trayHeaderLeft}>
              <View style={styles.iconCircle}>
                {renderCategoryIcon(action.category, 18)}
              </View>
              <View style={styles.titleColumn}>
                <View style={styles.titleRow}>
                  <Text style={styles.toolNameText} numberOfLines={1}>
                    {toolName}
                  </Text>
                  {/* Status Pill */}
                  <View
                    style={[
                      styles.statusPill,
                      isSuccess ? styles.statusPillSuccess : styles.statusPillError,
                    ]}
                  >
                    {isSuccess ? (
                      <CheckCircle2 size={11} color={colors.green} />
                    ) : (
                      <XCircle size={11} color={colors.red} />
                    )}
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isSuccess ? colors.green : colors.red },
                      ]}
                    >
                      {action.exitCode !== undefined ? `Exit ${action.exitCode}` : isSuccess ? 'Success' : 'Failed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.categorySubtext}>
                  {getCategoryLabel(action.category)}
                  {action.duration ? ` • ${action.duration}` : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Tray Scrollable Content */}
          <ScrollView
            style={styles.trayScroll}
            contentContainerStyle={styles.trayScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Tool Purpose / Summary */}
            {action.title ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>ACTION DESCRIPTION</Text>
                <Text style={styles.summaryTitle}>{action.title}</Text>
              </View>
            ) : null}

            {/* If there is a command line, highlight it */}
            {hasCommandLine ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Terminal size={13} color={colors.textMuted} />
                    <Text style={styles.sectionHeaderTitle}>COMMAND EXECUTED</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copySmallBtn}
                    onPress={() => handleCopyInput(commandLine)}
                    activeOpacity={0.7}
                  >
                    {copiedInput ? (
                      <>
                        <Check size={11} color={colors.green} />
                        <Text style={[styles.copySmallText, { color: colors.green }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={11} color={colors.textMuted} />
                        <Text style={styles.copySmallText}>Copy</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.commandBox}>
                  <Text style={styles.commandPromptPrefix}>$ </Text>
                  <Text style={styles.commandText} selectable>
                    {commandLine}
                  </Text>
                </View>
                {args.Cwd ? (
                  <View style={styles.cwdRow}>
                    <Folder size={11} color={colors.textMuted} />
                    <Text style={styles.cwdText}>cwd: {String(args.Cwd)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* If there is a file path, highlight it */}
            {filePath ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <FileCode size={13} color={colors.textMuted} />
                    <Text style={styles.sectionHeaderTitle}>TARGET FILE</Text>
                  </View>
                </View>
                <View style={styles.filePathBox}>
                  <Text style={styles.filePathText} selectable numberOfLines={2}>
                    {filePath}
                  </Text>
                  {args.StartLine || args.EndLine ? (
                    <Text style={styles.fileLineRange}>
                      Lines {args.StartLine ?? 1} - {args.EndLine ?? 'end'}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Input Arguments (rendered as formatted JSON) */}
            {args && Object.keys(args).length > 0 && !hasCommandLine && !filePath ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>INPUT ARGUMENTS</Text>
                </View>
                <JsonViewer data={args} title="Arguments" />
              </View>
            ) : null}

            {/* Tool Output / Result Section */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <Text style={styles.sectionHeaderTitle}>OUTPUT / RESULT</Text>
                </View>
                {rawOutputStr ? (
                  <TouchableOpacity
                    style={styles.copySmallBtn}
                    onPress={() => handleCopyOutput(rawOutputStr)}
                    activeOpacity={0.7}
                  >
                    {copiedOutput ? (
                      <>
                        <Check size={11} color={colors.green} />
                        <Text style={[styles.copySmallText, { color: colors.green }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={11} color={colors.textMuted} />
                        <Text style={styles.copySmallText}>Copy Output</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              {rawOutputStr ? (
                <View style={styles.outputBox}>
                  <MarkdownText content={rawOutputStr} isUser={false} />
                </View>
              ) : (
                <View style={styles.emptyOutputBox}>
                  <Check size={14} color={colors.green} />
                  <Text style={styles.emptyOutputText}>Executed successfully with no terminal output.</Text>
                </View>
              )}
            </View>

            {/* Bottom Dismiss Drag Hint */}
            <View style={styles.dragHintRow}>
              <Text style={styles.dragHintText}>Swipe down to dismiss</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(1, 4, 9, 0.72)',
  },
  traySheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl + 4,
    borderTopRightRadius: radii.xl + 4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderBottomWidth: 0,
    maxHeight: '85%',
    minHeight: 380,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  handleContainer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 38,
    height: 4.5,
    borderRadius: radii.full,
    backgroundColor: '#30363d',
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  trayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  statusPillSuccess: {
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },
  statusPillError: {
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: typography.mono,
  },
  categorySubtext: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayScroll: {
    flex: 1,
  },
  trayScrollContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  summaryBox: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textMuted,
    fontFamily: typography.mono,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  copySmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    backgroundColor: colors.bgHover,
  },
  copySmallText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  commandBox: {
    flexDirection: 'row',
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    padding: 10,
  },
  commandPromptPrefix: {
    color: colors.green,
    fontFamily: typography.mono,
    fontSize: 12.5,
    fontWeight: '700',
  },
  commandText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontSize: 12.5,
    lineHeight: 18,
  },
  cwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  cwdText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  filePathBox: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    padding: 10,
  },
  filePathText: {
    color: colors.blue,
    fontFamily: typography.mono,
    fontSize: 12,
    lineHeight: 17,
  },
  fileLineRange: {
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontSize: 11,
    marginTop: 4,
  },
  outputBox: {
    marginTop: 2,
  },
  emptyOutputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 12,
  },
  emptyOutputText: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  dragHintRow: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  dragHintText: {
    fontSize: 11,
    color: colors.textDisabled,
    fontFamily: typography.mono,
  },
});

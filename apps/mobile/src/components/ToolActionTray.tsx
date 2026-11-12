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
  ActivityIndicator,
  StatusBar,
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
  GitBranch,
  Pencil,
  BookOpen,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { MarkdownText, JsonViewer } from './MarkdownText';
import { DiffViewer } from './DiffViewer';
import { useDaemonStore } from '../stores/useDaemonStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 28);
const FULL_HEIGHT = SCREEN_HEIGHT - TOP_INSET;
const DEFAULT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 600);
const SNAP_TOP = 0;
const SNAP_DEFAULT = Math.round(FULL_HEIGHT - DEFAULT_HEIGHT);
const SNAP_CLOSED = FULL_HEIGHT + 60;

export interface ActionStep {
  id: string;
  title: string;
  category: 'repo' | 'git' | 'mcp' | 'skill' | 'terminal' | 'file' | 'edit' | 'search';
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [copiedInput, setCopiedInput] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;

  const currentY = useRef(SNAP_DEFAULT);
  const startDragY = useRef(SNAP_DEFAULT);

  const snapTo = (toValue: number, expanded: boolean) => {
    currentY.current = toValue;
    setIsExpanded(expanded);
    Animated.spring(translateY, {
      toValue,
      damping: 24,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handleToggleExpand = () => {
    if (isExpandedRef.current) {
      snapTo(SNAP_DEFAULT, false);
    } else {
      snapTo(SNAP_TOP, true);
    }
  };

  // PanResponder to handle dragging up to expand full screen, or down to collapse/dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        startDragY.current = currentY.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextY = Math.max(SNAP_TOP, startDragY.current + gestureState.dy);
        currentY.current = nextY;
        translateY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isExpandedRef.current) {
          if (gestureState.dy < -40 || gestureState.vy < -0.3) {
            snapTo(SNAP_TOP, true);
          } else if (gestureState.dy > 90 || gestureState.vy > 0.45) {
            handleClose();
          } else {
            snapTo(SNAP_DEFAULT, false);
          }
        } else {
          if (gestureState.dy > 60 || gestureState.vy > 0.35) {
            snapTo(SNAP_DEFAULT, false);
          } else {
            snapTo(SNAP_TOP, true);
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setIsExpanded(false);
      currentY.current = SNAP_DEFAULT;
      translateY.setValue(SNAP_CLOSED);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: SNAP_DEFAULT,
          damping: 24,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      currentY.current = SNAP_CLOSED;
      translateY.setValue(SNAP_CLOSED);
      backdropOpacity.setValue(0);
      setIsExpanded(false);
    }
  }, [visible]);

  const handleClose = () => {
    currentY.current = SNAP_CLOSED;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SNAP_CLOSED,
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
    const iconColor = isSwiss ? '#DC201E' : isLight ? '#262626' : '#ffffff';
    switch (category) {
      case 'git':
        return <GitBranch size={size} color={iconColor} />;
      case 'edit':
        return <Pencil size={size} color={iconColor} />;
      case 'repo':
        return <FolderGit2 size={size} color={iconColor} />;
      case 'mcp':
        return <BookOpen size={size} color={iconColor} />;
      case 'skill':
        return <GitFork size={size} color={iconColor} />;
      case 'file':
        return <FileText size={size} color={iconColor} />;
      case 'search':
        return <Search size={size} color={iconColor} />;
      case 'terminal':
      default:
        return <Terminal size={size} color={iconColor} />;
    }
  };

  const getCategoryLabel = (category: ActionStep['category']) => {
    switch (category) {
      case 'git':
        return 'Git Operation';
      case 'edit':
        return 'File Edit';
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
  const isRunning = action.status === 'running';
  const isSuccess = !isRunning && action.status !== 'error' && (action.exitCode === undefined || action.exitCode === 0);
  const isError = !isRunning && (action.status === 'error' || (action.exitCode !== undefined && action.exitCode !== 0));

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
            isLight && styles.traySheetLight,
            isSwiss && styles.traySheetSwiss,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Draggable Top Handle & Header Zone */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <TouchableOpacity
              style={styles.handleContainer}
              activeOpacity={0.8}
              onPress={handleToggleExpand}
            >
              <View style={[styles.dragPill, isLight && styles.dragPillLight, isSwiss && styles.dragPillSwiss]} />
            </TouchableOpacity>

            {/* Tray Header */}
            <View style={[styles.trayHeader, isLight && styles.trayHeaderLight, isSwiss && styles.trayHeaderSwiss]}>
              <View style={styles.trayHeaderLeft}>
                <View style={[styles.iconCircle, isLight && styles.iconCircleLight, isSwiss && styles.iconCircleSwiss]}>
                  {renderCategoryIcon(action.category, 18)}
                </View>
                <View style={styles.titleColumn}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.toolNameText, isLight && styles.toolNameTextLight, isSwiss && styles.toolNameTextSwiss]} numberOfLines={1}>
                      {toolName}
                    </Text>
                    {/* Status Pill */}
                    <View
                      style={[
                        styles.statusPill,
                        isRunning
                          ? (isSwiss ? styles.statusPillRunningSwiss : styles.statusPillRunning)
                          : isSuccess
                          ? (isSwiss ? styles.statusPillSuccessSwiss : isLight ? styles.statusPillSuccessLight : styles.statusPillSuccess)
                          : (isSwiss ? styles.statusPillErrorSwiss : isLight ? styles.statusPillErrorLight : styles.statusPillError),
                      ]}
                    >
                      {isRunning ? (
                        <ActivityIndicator size="small" color={isSwiss ? '#DC201E' : isLight ? '#262626' : colors.primary} style={{ transform: [{ scale: 0.65 }] }} />
                      ) : isSuccess ? (
                        <CheckCircle2 size={11} color={isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green} />
                      ) : (
                        <XCircle size={11} color={isSwiss ? '#DC201E' : isLight ? '#cf222e' : colors.red} />
                      )}
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: isRunning
                              ? (isSwiss ? '#DC201E' : isLight ? '#262626' : colors.primary)
                              : isSuccess
                              ? (isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green)
                              : (isSwiss ? '#DC201E' : isLight ? '#cf222e' : colors.red),
                          },
                        ]}
                      >
                        {isRunning
                          ? 'Running...'
                          : action.exitCode !== undefined
                          ? `Exit ${action.exitCode}`
                          : isSuccess
                          ? 'Success'
                          : 'Failed'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.categorySubtext, isLight && styles.categorySubtextLight, isSwiss && styles.categorySubtextSwiss]}>
                    {getCategoryLabel(action.category)}
                    {action.duration ? ` • ${action.duration}` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.closeBtn, isLight && styles.closeBtnLight, isSwiss && styles.closeBtnSwiss]} onPress={handleClose} activeOpacity={0.7}>
                <X size={16} color={isSwiss ? '#111010' : isLight ? '#57606a' : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tray Scrollable Content */}
          <ScrollView
            style={[styles.trayScroll, isLight && styles.trayScrollLight, isSwiss && styles.trayScrollSwiss]}
            contentContainerStyle={styles.trayScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Tool Purpose / Summary */}
            {action.title ? (
              <View style={[styles.summaryBox, isLight && styles.summaryBoxLight, isSwiss && styles.summaryBoxSwiss]}>
                <Text style={[styles.summaryLabel, isLight && styles.summaryLabelLight, isSwiss && styles.summaryLabelSwiss]}>ACTION DESCRIPTION</Text>
                <Text style={[styles.summaryTitle, isLight && styles.summaryTitleLight, isSwiss && styles.summaryTitleSwiss]}>{action.title}</Text>
              </View>
            ) : null}

            {/* If there is a command line, highlight it */}
            {hasCommandLine ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <Terminal size={13} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#ffffff'} />
                    <Text style={[styles.sectionHeaderTitle, isLight && styles.sectionHeaderTitleLight, isSwiss && styles.sectionHeaderTitleSwiss]}>COMMAND EXECUTED</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.copySmallBtn, isLight && styles.copySmallBtnLight, isSwiss && styles.copySmallBtnSwiss]}
                    onPress={() => handleCopyInput(commandLine)}
                    activeOpacity={0.7}
                  >
                    {copiedInput ? (
                      <>
                        <Check size={11} color={isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green} />
                        <Text style={[styles.copySmallText, { color: isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={11} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : colors.textMuted} />
                        <Text style={[styles.copySmallText, isLight && styles.copySmallTextLight, isSwiss && styles.copySmallTextSwiss]}>Copy</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={[styles.commandBox, isLight && styles.commandBoxLight, isSwiss && styles.commandBoxSwiss]}>
                  <Text style={[styles.commandPromptPrefix, isLight && styles.commandPromptPrefixLight, isSwiss && styles.commandPromptPrefixSwiss]}>$ </Text>
                  <Text style={[styles.commandText, isLight && styles.commandTextLight, isSwiss && styles.commandTextSwiss]} selectable>
                    {commandLine}
                  </Text>
                </View>
                {args.Cwd ? (
                  <View style={styles.cwdRow}>
                    <Folder size={11} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : colors.textMuted} />
                    <Text style={[styles.cwdText, isLight && styles.cwdTextLight, isSwiss && styles.cwdTextSwiss]}>cwd: {String(args.Cwd)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* If there is a file path, highlight it */}
            {filePath ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderLeft}>
                    <FileCode size={13} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#ffffff'} />
                    <Text style={[styles.sectionHeaderTitle, isLight && styles.sectionHeaderTitleLight, isSwiss && styles.sectionHeaderTitleSwiss]}>TARGET FILE</Text>
                  </View>
                </View>
                <View style={[styles.filePathBox, isLight && styles.filePathBoxLight, isSwiss && styles.filePathBoxSwiss]}>
                  <Text style={[styles.filePathText, isLight && styles.filePathTextLight, isSwiss && styles.filePathTextSwiss]} selectable numberOfLines={2}>
                    {filePath}
                  </Text>
                  {args.StartLine || args.EndLine ? (
                    <Text style={[styles.fileLineRange, isLight && styles.fileLineRangeLight, isSwiss && styles.fileLineRangeSwiss]}>
                      Lines {args.StartLine ?? 1} - {args.EndLine ?? 'end'}
                    </Text>
                  ) : null}
                </View>

                {/* If this is a file edit or creation, render the GitHub-Style Diff Viewer */}
                {(args.Target !== undefined || args.Replacement !== undefined || args.Content !== undefined || (action.output && action.output.includes('@@'))) ? (
                  <View style={{ marginTop: 10 }}>
                    <DiffViewer
                      filePath={filePath}
                      target={typeof args.Target === 'string' ? args.Target : undefined}
                      replacement={typeof args.Replacement === 'string' ? args.Replacement : undefined}
                      content={typeof args.Content === 'string' && toolName === 'write_file' ? args.Content : undefined}
                      diffText={action.output && action.output.includes('@@') ? action.output : undefined}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Input Arguments (rendered as formatted JSON) */}
            {args && Object.keys(args).length > 0 && !hasCommandLine && !filePath ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeaderTitle, isLight && styles.sectionHeaderTitleLight, isSwiss && styles.sectionHeaderTitleSwiss]}>INPUT ARGUMENTS</Text>
                </View>
                <JsonViewer data={args} title="Arguments" />
              </View>
            ) : null}

            {/* Tool Output / Result Section */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderLeft}>
                  <Text style={[styles.sectionHeaderTitle, isLight && styles.sectionHeaderTitleLight, isSwiss && styles.sectionHeaderTitleSwiss]}>OUTPUT / RESULT</Text>
                </View>
                {rawOutputStr ? (
                  <TouchableOpacity
                    style={[styles.copySmallBtn, isLight && styles.copySmallBtnLight, isSwiss && styles.copySmallBtnSwiss]}
                    onPress={() => handleCopyOutput(rawOutputStr)}
                    activeOpacity={0.7}
                  >
                    {copiedOutput ? (
                      <>
                        <Check size={11} color={isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green} />
                        <Text style={[styles.copySmallText, { color: isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green }]}>Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={11} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : colors.textMuted} />
                        <Text style={[styles.copySmallText, isLight && styles.copySmallTextLight, isSwiss && styles.copySmallTextSwiss]}>Copy Output</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              {rawOutputStr ? (
                <View style={styles.outputBox}>
                  <MarkdownText content={rawOutputStr} isUser={false} />
                </View>
              ) : isRunning ? (
                <View style={[styles.runningOutputBox, isLight && styles.runningOutputBoxLight, isSwiss && styles.runningOutputBoxSwiss]}>
                  <ActivityIndicator size="small" color={isSwiss ? '#DC201E' : isLight ? '#262626' : colors.primary} />
                  <Text style={[styles.runningOutputText, isLight && styles.runningOutputTextLight, isSwiss && styles.runningOutputTextSwiss]}>Tool execution in progress...</Text>
                </View>
              ) : (
                <View style={[styles.emptyOutputBox, isLight && styles.emptyOutputBoxLight, isSwiss && styles.emptyOutputBoxSwiss]}>
                  <Check size={14} color={isSwiss ? '#10b981' : isLight ? '#1a7f37' : colors.green} />
                  <Text style={[styles.emptyOutputText, isLight && styles.emptyOutputTextLight, isSwiss && styles.emptyOutputTextSwiss]}>Executed successfully with no terminal output.</Text>
                </View>
              )}
            </View>

            {/* Bottom Dismiss Drag Hint */}
            <View style={styles.dragHintRow}>
              <Text style={[styles.dragHintText, isLight && styles.dragHintTextLight, isSwiss && styles.dragHintTextSwiss]}>Swipe down to dismiss</Text>
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
    height: FULL_HEIGHT,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl + 4,
    borderTopRightRadius: radii.xl + 4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderBottomWidth: 0,
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
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
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
  statusPillRunning: {
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 185, 80, 0.3)',
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
    color: colors.green,
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
  runningOutputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(35, 134, 54, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 185, 80, 0.25)',
    borderRadius: radii.md,
    padding: 14,
  },
  runningOutputText: {
    fontSize: 12.5,
    color: colors.green,
    fontWeight: '500',
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
  dragHintTextLight: {
    color: '#8c959f',
  },

  // Light Theme Overrides
  traySheetLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
    shadowOpacity: 0.12,
  },
  dragPillLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  trayHeaderLight: {
    borderBottomColor: '#e1e4e8',
  },
  iconCircleLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  toolNameTextLight: {
    color: '#1f2328',
  },
  categorySubtextLight: {
    color: '#6e7681',
  },
  closeBtnLight: {
    backgroundColor: '#eaeef2',
  },
  statusPillSuccessLight: {
    backgroundColor: '#dafbe1',
    borderWidth: 1,
    borderColor: 'rgba(26, 127, 55, 0.25)',
  },
  statusPillErrorLight: {
    backgroundColor: '#ffebe9',
    borderWidth: 1,
    borderColor: 'rgba(207, 34, 46, 0.25)',
  },
  trayScrollLight: {
    backgroundColor: '#ffffff',
  },
  summaryBoxLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#e1e4e8',
  },
  summaryLabelLight: {
    color: '#6e7681',
  },
  summaryTitleLight: {
    color: '#1f2328',
  },
  sectionHeaderTitleLight: {
    color: '#6e7681',
  },
  copySmallBtnLight: {
    backgroundColor: '#eaeef2',
  },
  copySmallTextLight: {
    color: '#57606a',
  },
  commandBoxLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  commandPromptPrefixLight: {
    color: '#262626',
  },
  commandTextLight: {
    color: '#1f2328',
  },
  cwdTextLight: {
    color: '#6e7681',
  },
  filePathBoxLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  filePathTextLight: {
    color: '#262626',
  },
  fileLineRangeLight: {
    color: '#6e7681',
  },
  runningOutputBoxLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  runningOutputTextLight: {
    color: '#262626',
  },
  emptyOutputBoxLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#e1e4e8',
  },
  emptyOutputTextLight: {
    color: '#57606a',
  },

  // Swiss Theme Overrides
  traySheetSwiss: {
    backgroundColor: '#F8F3EC',
    borderColor: 'rgba(17, 16, 16, 0.16)',
    shadowOpacity: 0.1,
  },
  dragPillSwiss: {
    backgroundColor: 'rgba(17, 16, 16, 0.20)',
  },
  trayHeaderSwiss: {
    backgroundColor: '#F8F3EC',
    borderBottomColor: 'rgba(17, 16, 16, 0.12)',
  },
  iconCircleSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  toolNameTextSwiss: {
    color: '#111010',
  },
  categorySubtextSwiss: {
    color: '#6B665E',
  },
  closeBtnSwiss: {
    backgroundColor: '#F1EBE1',
  },
  statusPillRunningSwiss: {
    backgroundColor: 'rgba(220, 32, 30, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 32, 30, 0.25)',
  },
  statusPillSuccessSwiss: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusPillErrorSwiss: {
    backgroundColor: 'rgba(220, 32, 30, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 32, 30, 0.25)',
  },
  trayScrollSwiss: {
    backgroundColor: '#F8F3EC',
  },
  summaryBoxSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  summaryLabelSwiss: {
    color: '#6B665E',
  },
  summaryTitleSwiss: {
    color: '#111010',
  },
  sectionHeaderTitleSwiss: {
    color: '#6B665E',
  },
  copySmallBtnSwiss: {
    backgroundColor: '#EBE4D8',
  },
  copySmallTextSwiss: {
    color: '#6B665E',
  },
  commandBoxSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  commandPromptPrefixSwiss: {
    color: '#DC201E',
  },
  commandTextSwiss: {
    color: '#111010',
  },
  cwdTextSwiss: {
    color: '#6B665E',
  },
  filePathBoxSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  filePathTextSwiss: {
    color: '#111010',
  },
  fileLineRangeSwiss: {
    color: '#6B665E',
  },
  runningOutputBoxSwiss: {
    backgroundColor: 'rgba(220, 32, 30, 0.08)',
    borderColor: 'rgba(220, 32, 30, 0.20)',
  },
  runningOutputTextSwiss: {
    color: '#DC201E',
  },
  emptyOutputBoxSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.14)',
  },
  emptyOutputTextSwiss: {
    color: '#6B665E',
  },
  dragHintTextSwiss: {
    color: '#9C9589',
  },
});

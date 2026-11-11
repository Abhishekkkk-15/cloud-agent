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
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import {
  X,
  SlidersHorizontal,
  Bot,
  Zap,
  Flame,
  Check,
  Shield,
  Layers,
  ShieldCheck,
  ShieldAlert,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import {
  useDaemonStore,
  type ReasoningEffort,
  type ExecutionMode,
} from '../stores/useDaemonStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 28);
const FULL_HEIGHT = SCREEN_HEIGHT - TOP_INSET;
const DEFAULT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 640);
const SNAP_TOP = 0;
const SNAP_DEFAULT = Math.round(FULL_HEIGHT - DEFAULT_HEIGHT);
const SNAP_CLOSED = FULL_HEIGHT + 60;

interface SessionConfigSheetProps {
  visible: boolean;
  onClose: () => void;
}

const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.8-flash-high',
    name: 'Gemini 3.8 Flash (High)',
    desc: 'Recommended default: high speed, deep coding comprehension',
    provider: 'Google',
  },
  {
    id: 'gemini-3.8-flash-medium',
    name: 'Gemini 3.8 Flash (Medium)',
    desc: 'Balanced reasoning for quick edits and queries',
    provider: 'Google',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Thinking)',
    desc: 'Extended chain-of-thought and architectural planning',
    provider: 'Anthropic',
  },
  {
    id: 'claude-opus-4-6-thinking',
    name: 'Claude Opus 4.6 (Thinking)',
    desc: 'Maximum depth reasoning for complex refactoring',
    provider: 'Anthropic',
  },
  {
    id: 'gpt-oss-120b-medium',
    name: 'GPT-OSS 120B (Medium)',
    desc: 'Open weights model running locally/hybrid',
    provider: 'OSS',
  },
];

const EFFORT_LEVELS: { id: ReasoningEffort; label: string; desc: string }[] = [
  { id: 'low', label: 'Low', desc: 'Fastest turns, minimal thinking tokens' },
  { id: 'medium', label: 'Medium', desc: 'Balanced reasoning for standard tasks' },
  { id: 'high', label: 'High', desc: 'In-depth multi-step verification (Recommended)' },
  { id: 'max', label: 'Max', desc: 'Exhaustive deliberation on critical code' },
];

const EXECUTION_MODES: { id: ExecutionMode; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto', desc: 'Directly edit files & execute tools' },
  { id: 'plan', label: 'Plan Only', desc: 'Agent produces implementation plan without modifying code' },
  { id: 'accept-edits', label: 'Review Edits', desc: 'Step-by-step confirmation for file modifications' },
];

export const SessionConfigSheet: React.FC<SessionConfigSheetProps> = ({
  visible,
  onClose,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const setSessionConfig = useDaemonStore((s) => s.setSessionConfig);

  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
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
          duration: 200,
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

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Animated Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            isLight && styles.sheetContainerLight,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Top Drag Handle & Header Zone */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.handleContainer}
              onPress={handleToggleExpand}
            >
              <View style={[styles.dragPill, isLight && styles.dragPillLight]} />
            </TouchableOpacity>

            {/* Header */}
            <View style={[styles.header, isLight && styles.headerLight]}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconCircle, isLight && styles.iconCircleLight]}>
                  <SlidersHorizontal size={16} color={isLight ? '#0077b6' : '#ffffff'} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, isLight && styles.headerTitleLight]}>SESSION PARAMETERS</Text>
                  <Text style={[styles.headerSubtitle, isLight && styles.headerSubtitleLight]}>Configure model, reasoning, and execution mode</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.closeBtn, isLight && styles.closeBtnLight]} onPress={handleClose} activeOpacity={0.7}>
                <X size={16} color={isLight ? '#57606a' : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Form */}
          <ScrollView
            style={[styles.scroll, isExpanded && { flex: 1 }, isLight && styles.scrollLight]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Reasoning Effort */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Flame size={13} color={isLight ? '#0077b6' : colors.green} />
                <Text style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>REASONING EFFORT</Text>
              </View>

              <View style={[styles.segmentedRow, isLight && styles.segmentedRowLight]}>
                {EFFORT_LEVELS.map((eff) => {
                  const isSelected = (sessionConfig.effort || 'high') === eff.id;
                  return (
                    <TouchableOpacity
                      key={eff.id}
                      style={[
                        styles.segmentBtn,
                        isLight && styles.segmentBtnLight,
                        isSelected && (isLight ? styles.segmentBtnActiveLight : styles.segmentBtnActive),
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ effort: eff.id })}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          isLight && styles.segmentBtnTextLight,
                          isSelected && (isLight ? styles.segmentBtnTextActiveLight : styles.segmentBtnTextActive),
                        ]}
                      >
                        {eff.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.effortDescription, isLight && styles.effortDescriptionLight]}>
                {EFFORT_LEVELS.find((e) => e.id === (sessionConfig.effort || 'high'))?.desc}
              </Text>
            </View>

            {/* 2. Execution Mode */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Layers size={13} color={isLight ? '#0077b6' : colors.green} />
                <Text style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>EXECUTION MODE</Text>
              </View>

              <View style={styles.modeCardsCol}>
                {EXECUTION_MODES.map((m) => {
                  const isSelected = (sessionConfig.mode || 'auto') === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.modeCard,
                        isLight && styles.modeCardLight,
                        isSelected && (isLight ? styles.modeCardActiveLight : styles.modeCardActive),
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ mode: m.id })}
                    >
                      <View style={styles.modeCardLeft}>
                        <View
                          style={[
                            styles.radioCircle,
                            isLight && styles.radioCircleLight,
                            isSelected && (isLight ? styles.radioCircleActiveLight : styles.radioCircleActive),
                          ]}
                        >
                          {isSelected && <View style={[styles.radioDot, isLight && styles.radioDotLight]} />}
                        </View>
                        <View style={styles.modeCardTextCol}>
                          <Text
                            style={[
                              styles.modeCardLabel,
                              isLight && styles.modeCardLabelLight,
                              isSelected && (isLight ? styles.modeCardLabelActiveLight : styles.modeCardLabelActive),
                            ]}
                          >
                            {m.label}
                          </Text>
                          <Text style={[styles.modeCardDesc, isLight && styles.modeCardDescLight]}>{m.desc}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. AI Model Selector */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Bot size={13} color={isLight ? '#0077b6' : colors.green} />
                <Text style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>ACTIVE MODEL</Text>
              </View>

              <View style={styles.modelsList}>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = (sessionConfig.model || 'gemini-3.8-flash-high') === model.id;
                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelCard,
                        isLight && styles.modelCardLight,
                        isSelected && (isLight ? styles.modelCardActiveLight : styles.modelCardActive),
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ model: model.id })}
                    >
                      <View style={styles.modelCardLeft}>
                        <View
                          style={[
                            styles.radioCircle,
                            isLight && styles.radioCircleLight,
                            isSelected && (isLight ? styles.radioCircleActiveLight : styles.radioCircleActive),
                          ]}
                        >
                          {isSelected && <View style={[styles.radioDot, isLight && styles.radioDotLight]} />}
                        </View>
                        <View style={styles.modelCardTextCol}>
                          <View style={styles.modelTitleRow}>
                            <Text
                              style={[
                                styles.modelName,
                                isLight && styles.modelNameLight,
                                isSelected && (isLight ? styles.modelNameActiveLight : styles.modelNameActive),
                              ]}
                            >
                              {model.name}
                            </Text>
                            <View style={[styles.providerBadge, isLight && styles.providerBadgeLight]}>
                              <Text style={[styles.providerBadgeText, isLight && styles.providerBadgeTextLight]}>{model.provider}</Text>
                            </View>
                          </View>
                          <Text style={[styles.modelDesc, isLight && styles.modelDescLight]}>{model.desc}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Tool Permissions */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ShieldCheck size={13} color={isLight ? '#0077b6' : colors.primary} />
                <Text style={[styles.sectionTitle, isLight && styles.sectionTitleLight]}>TOOL PERMISSIONS</Text>
              </View>

              <View style={styles.modeCardsCol}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    isLight && styles.modeCardLight,
                    sessionConfig.dangerouslySkipPermissions !== false && (isLight ? styles.modeCardActiveLight : styles.modeCardActive),
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSessionConfig({ dangerouslySkipPermissions: true })}
                >
                  <View style={styles.modeCardLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        isLight && styles.radioCircleLight,
                        sessionConfig.dangerouslySkipPermissions !== false && (isLight ? styles.radioCircleActiveLight : styles.radioCircleActive),
                      ]}
                    >
                      {sessionConfig.dangerouslySkipPermissions !== false && <View style={[styles.radioDot, isLight && styles.radioDotLight]} />}
                    </View>
                    <View style={styles.modeCardTextCol}>
                      <View style={styles.permissionTitleRow}>
                        <Text
                          style={[
                            styles.modeCardLabel,
                            isLight && styles.modeCardLabelLight,
                            sessionConfig.dangerouslySkipPermissions !== false && (isLight ? styles.modeCardLabelActiveLight : styles.modeCardLabelActive),
                          ]}
                        >
                          Auto-Approve All (Default)
                        </Text>
                        <View style={[styles.badgeRecommended, isLight && styles.badgeRecommendedLight]}>
                          <Text style={[styles.badgeRecommendedText, isLight && styles.badgeRecommendedTextLight]}>Recommended</Text>
                        </View>
                      </View>
                      <Text style={[styles.modeCardDesc, isLight && styles.modeCardDescLight]}>
                        Skips confirmation prompts for automated tool execution.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    isLight && styles.modeCardLight,
                    sessionConfig.dangerouslySkipPermissions === false && (isLight ? styles.modeCardActiveLight : styles.modeCardActive),
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSessionConfig({ dangerouslySkipPermissions: false })}
                >
                  <View style={styles.modeCardLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        isLight && styles.radioCircleLight,
                        sessionConfig.dangerouslySkipPermissions === false && (isLight ? styles.radioCircleActiveLight : styles.radioCircleActive),
                      ]}
                    >
                      {sessionConfig.dangerouslySkipPermissions === false && <View style={[styles.radioDot, isLight && styles.radioDotLight]} />}
                    </View>
                    <View style={styles.modeCardTextCol}>
                      <Text
                        style={[
                          styles.modeCardLabel,
                          isLight && styles.modeCardLabelLight,
                          sessionConfig.dangerouslySkipPermissions === false && (isLight ? styles.modeCardLabelActiveLight : styles.modeCardLabelActive),
                        ]}
                      >
                        Ask for Confirmation
                      </Text>
                      <Text style={[styles.modeCardDesc, isLight && styles.modeCardDescLight]}>
                        Strict review. Elevated commands and sensitive tool calls will await your approval on mobile.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Save Bar */}
          <View style={[styles.bottomBar, isLight && styles.bottomBarLight]}>
            <TouchableOpacity style={[styles.applyBtn, isLight && styles.applyBtnLight]} onPress={handleClose} activeOpacity={0.85}>
              <Check size={16} color="#ffffff" />
              <Text style={styles.applyBtnText}>Apply Settings</Text>
            </TouchableOpacity>
          </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(1, 4, 9, 0.75)',
  },
  sheetContainer: {
    height: FULL_HEIGHT,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.bgHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    fontFamily: typography.mono,
    letterSpacing: 0.5,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCanvasInset,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: 'rgba(126, 231, 135, 0.4)',
  },
  segmentBtnText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.textMuted,
  },
  segmentBtnTextActive: {
    color: colors.green,
    fontWeight: '700',
  },
  effortDescription: {
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 2,
  },
  modeCardsCol: {
    gap: 6,
  },
  modeCard: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 10,
  },
  modeCardActive: {
    borderColor: 'rgba(126, 231, 135, 0.4)',
    backgroundColor: 'rgba(35, 134, 54, 0.08)',
  },
  modeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeCardTextCol: {
    flex: 1,
  },
  modeCardLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modeCardLabelActive: {
    color: colors.green,
  },
  modeCardDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  modelsList: {
    gap: 6,
  },
  modelCard: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 10,
  },
  modelCardActive: {
    borderColor: 'rgba(126, 231, 135, 0.4)',
    backgroundColor: 'rgba(35, 134, 54, 0.08)',
  },
  modelCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modelCardTextCol: {
    flex: 1,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  modelName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  modelNameActive: {
    color: colors.green,
  },
  providerBadge: {
    backgroundColor: colors.bgHover,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  providerBadgeText: {
    fontSize: 9.5,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  modelDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.green,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    backgroundColor: colors.bgCard,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.greenBg,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeRecommended: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginLeft: 8,
  },
  badgeRecommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fafafa',
  },

  // Light Theme Overrides
  sheetContainerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  dragPillLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  headerLight: {
    borderBottomColor: '#e1e4e8',
  },
  iconCircleLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: '#d0d7de',
  },
  headerTitleLight: {
    color: '#1f2328',
  },
  headerSubtitleLight: {
    color: '#6e7681',
  },
  closeBtnLight: {
    backgroundColor: '#eaeef2',
  },
  scrollLight: {
    backgroundColor: '#ffffff',
  },
  sectionTitleLight: {
    color: '#6e7681',
  },
  segmentedRowLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  segmentBtnLight: {
    backgroundColor: 'transparent',
  },
  segmentBtnActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentBtnTextLight: {
    color: '#57606a',
  },
  segmentBtnTextActiveLight: {
    color: '#0077b6',
    fontWeight: '700',
  },
  effortDescriptionLight: {
    color: '#6e7681',
  },
  modeCardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  modeCardActiveLight: {
    borderColor: '#0077b6',
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
  },
  radioCircleLight: {
    borderColor: '#8c959f',
  },
  radioCircleActiveLight: {
    borderColor: '#0077b6',
  },
  radioDotLight: {
    backgroundColor: '#0077b6',
  },
  modeCardLabelLight: {
    color: '#1f2328',
  },
  modeCardLabelActiveLight: {
    color: '#0077b6',
  },
  modeCardDescLight: {
    color: '#6e7681',
  },
  modelCardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  modelCardActiveLight: {
    borderColor: '#0077b6',
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
  },
  modelNameLight: {
    color: '#1f2328',
  },
  modelNameActiveLight: {
    color: '#0077b6',
  },
  providerBadgeLight: {
    backgroundColor: '#eaeef2',
  },
  providerBadgeTextLight: {
    color: '#57606a',
  },
  modelDescLight: {
    color: '#6e7681',
  },
  badgeRecommendedLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  badgeRecommendedTextLight: {
    color: '#0077b6',
  },
  bottomBarLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e1e4e8',
  },
  applyBtnLight: {
    backgroundColor: '#0077b6',
  },
  applyBtnTextLight: {
    color: '#ffffff',
  },
});

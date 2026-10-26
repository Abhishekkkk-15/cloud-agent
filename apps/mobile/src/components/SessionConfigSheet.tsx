import React, { useRef, useEffect } from 'react';
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
  { id: 'auto', label: 'Auto (Autonomous)', desc: 'Agent directly edits files & executes tools' },
  { id: 'plan', label: 'Plan Only', desc: 'Agent produces implementation plan without modifying code' },
  { id: 'accept-edits', label: 'Review Edits', desc: 'Step-by-step confirmation for file modifications' },
];

export const SessionConfigSheet: React.FC<SessionConfigSheetProps> = ({
  visible,
  onClose,
}) => {
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const setSessionConfig = useDaemonStore((s) => s.setSessionConfig);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // PanResponder to handle dragging from top to bottom
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.45) {
          handleClose();
        } else {
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
          duration: 200,
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
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          {/* Drag Handle */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragPill} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <SlidersHorizontal size={16} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>SESSION PARAMETERS</Text>
                <Text style={styles.headerSubtitle}>Configure model, reasoning, and execution mode</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Reasoning Effort */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Flame size={13} color={colors.green} />
                <Text style={styles.sectionTitle}>REASONING EFFORT</Text>
              </View>

              <View style={styles.segmentedRow}>
                {EFFORT_LEVELS.map((eff) => {
                  const isSelected = (sessionConfig.effort || 'high') === eff.id;
                  return (
                    <TouchableOpacity
                      key={eff.id}
                      style={[
                        styles.segmentBtn,
                        isSelected && styles.segmentBtnActive,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ effort: eff.id })}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          isSelected && styles.segmentBtnTextActive,
                        ]}
                      >
                        {eff.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.effortDescription}>
                {EFFORT_LEVELS.find((e) => e.id === (sessionConfig.effort || 'high'))?.desc}
              </Text>
            </View>

            {/* 2. Execution Mode */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Layers size={13} color={colors.green} />
                <Text style={styles.sectionTitle}>EXECUTION MODE</Text>
              </View>

              <View style={styles.modeCardsCol}>
                {EXECUTION_MODES.map((m) => {
                  const isSelected = (sessionConfig.mode || 'auto') === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.modeCard,
                        isSelected && styles.modeCardActive,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ mode: m.id })}
                    >
                      <View style={styles.modeCardLeft}>
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.modeCardTextCol}>
                          <Text style={[styles.modeCardLabel, isSelected && styles.modeCardLabelActive]}>
                            {m.label}
                          </Text>
                          <Text style={styles.modeCardDesc}>{m.desc}</Text>
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
                <Bot size={13} color={colors.green} />
                <Text style={styles.sectionTitle}>ACTIVE MODEL</Text>
              </View>

              <View style={styles.modelsList}>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = (sessionConfig.model || 'gemini-3.8-flash-high') === model.id;
                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelCard,
                        isSelected && styles.modelCardActive,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setSessionConfig({ model: model.id })}
                    >
                      <View style={styles.modelCardLeft}>
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                        <View style={styles.modelCardTextCol}>
                          <View style={styles.modelTitleRow}>
                            <Text style={[styles.modelName, isSelected && styles.modelNameActive]}>
                              {model.name}
                            </Text>
                            <View style={styles.providerBadge}>
                              <Text style={styles.providerBadgeText}>{model.provider}</Text>
                            </View>
                          </View>
                          <Text style={styles.modelDesc}>{model.desc}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Tool Permissions & HITL Security */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <ShieldCheck size={13} color={colors.primary} />
                <Text style={styles.sectionTitle}>TOOL PERMISSIONS & HITL GATE</Text>
              </View>

              <View style={styles.modeCardsCol}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    sessionConfig.dangerouslySkipPermissions !== false && styles.modeCardActive,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSessionConfig({ dangerouslySkipPermissions: true })}
                >
                  <View style={styles.modeCardLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        sessionConfig.dangerouslySkipPermissions !== false && styles.radioCircleActive,
                      ]}
                    >
                      {sessionConfig.dangerouslySkipPermissions !== false && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.modeCardTextCol}>
                      <View style={styles.permissionTitleRow}>
                        <Text
                          style={[
                            styles.modeCardLabel,
                            sessionConfig.dangerouslySkipPermissions !== false && styles.modeCardLabelActive,
                          ]}
                        >
                          Auto-Approve All (Default)
                        </Text>
                        <View style={styles.badgeRecommended}>
                          <Text style={styles.badgeRecommendedText}>Recommended</Text>
                        </View>
                      </View>
                      <Text style={styles.modeCardDesc}>
                        Passes --dangerously-skip-permissions for uninterrupted autonomous tool runs.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    sessionConfig.dangerouslySkipPermissions === false && styles.modeCardActive,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setSessionConfig({ dangerouslySkipPermissions: false })}
                >
                  <View style={styles.modeCardLeft}>
                    <View
                      style={[
                        styles.radioCircle,
                        sessionConfig.dangerouslySkipPermissions === false && styles.radioCircleActive,
                      ]}
                    >
                      {sessionConfig.dangerouslySkipPermissions === false && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.modeCardTextCol}>
                      <Text
                        style={[
                          styles.modeCardLabel,
                          sessionConfig.dangerouslySkipPermissions === false && styles.modeCardLabelActive,
                        ]}
                      >
                        Ask for Confirmation (HITL Gate)
                      </Text>
                      <Text style={styles.modeCardDesc}>
                        Strict review. Elevated commands and sensitive tool calls will await your approval on mobile.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Save Bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.applyBtn} onPress={handleClose} activeOpacity={0.85}>
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
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: '#30363d',
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
    flexGrow: 0,
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
    backgroundColor: colors.green,
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
    backgroundColor: 'rgba(0, 119, 182, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.4)',
    marginLeft: 8,
  },
  badgeRecommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#48cae4',
  },
});

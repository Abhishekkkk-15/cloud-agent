import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
import {
  X,
  FolderGit2,
  Folder,
  Check,
  ChevronRight,
  Play,
  SlidersHorizontal,
  Layers,
  Cpu,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, ReasoningEffort, ExecutionMode } from '../stores/useDaemonStore';
import { FolderPickerModal } from './FolderPickerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 28);
const FULL_HEIGHT = SCREEN_HEIGHT - TOP_INSET;
const DEFAULT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 640);
const SNAP_TOP = 0;
const SNAP_DEFAULT = Math.round(FULL_HEIGHT - DEFAULT_HEIGHT);
const SNAP_CLOSED = FULL_HEIGHT + 60;

interface NewChatWorkspaceSheetProps {
  visible: boolean;
  onClose: () => void;
  onStartSession: (workspacePath: string) => void;
}

export const NewChatWorkspaceSheet: React.FC<NewChatWorkspaceSheetProps> = ({
  visible,
  onClose,
  onStartSession,
}) => {
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const knownWorkspaces = useDaemonStore((s) => s.knownWorkspaces);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const setSessionConfig = useDaemonStore((s) => s.setSessionConfig);
  const fetchKnownWorkspaces = useDaemonStore((s) => s.fetchKnownWorkspaces);
  const fetchDirectorySuggestions = useDaemonStore((s) => s.fetchDirectorySuggestions);

  const [pathInput, setPathInput] = useState<string>('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedModel, setSelectedModel] = useState(sessionConfig.model);
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort>(sessionConfig.effort);
  const [selectedMode, setSelectedMode] = useState<ExecutionMode>(sessionConfig.mode);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
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
      Animated.spring(translateY, {
        toValue: SNAP_DEFAULT,
        damping: 24,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
      fetchKnownWorkspaces();
      const defaultPath =
        targetWorkspacePath ||
        (knownWorkspaces.length > 0 ? knownWorkspaces[0].path : '/');
      setPathInput(defaultPath);
      loadSuggestions(defaultPath);
    } else {
      currentY.current = SNAP_CLOSED;
      translateY.setValue(SNAP_CLOSED);
      setIsExpanded(false);
    }
  }, [visible, targetWorkspacePath, knownWorkspaces.length]);

  const handleClose = () => {
    currentY.current = SNAP_CLOSED;
    Animated.timing(translateY, {
      toValue: SNAP_CLOSED,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const loadSuggestions = async (path: string) => {
    setIsLoadingSuggestions(true);
    const dirs = await fetchDirectorySuggestions(path);
    setSuggestions(dirs);
    setIsLoadingSuggestions(false);
  };

  const handlePathChange = (text: string) => {
    setPathInput(text);
    if (text.endsWith('/') || text.length % 5 === 0) {
      loadSuggestions(text);
    }
  };

  const handleSelectChip = (p: string) => {
    setPathInput(p);
    loadSuggestions(p);
  };

  const handleSelectSuggestion = (fullPath: string) => {
    setPathInput(fullPath);
    loadSuggestions(fullPath);
  };

  const handleConfirm = () => {
    const finalPath = pathInput.trim() || targetWorkspacePath || '/';
    setSessionConfig({
      model: selectedModel,
      effort: selectedEffort,
      mode: selectedMode,
    });
    onStartSession(finalPath);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Top Drag Handle & Header Zone */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <TouchableOpacity
              style={styles.handleContainer}
              activeOpacity={0.8}
              onPress={handleToggleExpand}
            >
              <View style={styles.dragPill} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBox}>
                  <FolderGit2 size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Start New Session</Text>
                  <Text style={styles.sheetSubtitle}>
                    Choose a project directory on{' '}
                    <Text style={styles.machineHighlight}>
                      {activeMachine?.name || daemonStatus?.hostname || 'Local Machine'}
                    </Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Quick Workspace Chips */}
            {knownWorkspaces.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>RECENT WORKSPACES</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  {knownWorkspaces.map((ws) => {
                    const isSelected = pathInput === ws.path;
                    return (
                      <TouchableOpacity
                        key={ws.path}
                        style={[styles.wsChip, isSelected && styles.wsChipActive]}
                        onPress={() => handleSelectChip(ws.path)}
                        activeOpacity={0.7}
                      >
                        <FolderGit2
                          size={13}
                          color={isSelected ? colors.primary : '#a3a3a3'}
                        />
                        <Text
                          style={[
                            styles.wsChipText,
                            isSelected && styles.wsChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {ws.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 2. Target Directory / Folder Picker */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>TARGET DIRECTORY (CWD)</Text>
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => setShowFolderPicker(true)}
                  activeOpacity={0.7}
                >
                  <Folder size={13} color={colors.primary} />
                  <Text style={styles.browseBtnText}>Browse Folders</Text>
                  <ChevronRight size={13} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Selected Folder Banner */}
              <TouchableOpacity
                style={styles.folderCard}
                onPress={() => setShowFolderPicker(true)}
                activeOpacity={0.8}
              >
                <View style={styles.folderCardLeft}>
                  <View style={styles.folderCardIconBox}>
                    <FolderGit2 size={18} color={colors.primary} />
                  </View>
                  <View style={styles.folderCardTextCol}>
                    <Text style={styles.folderCardName} numberOfLines={1}>
                      {pathInput.split(/[\\/]/).filter(Boolean).pop() || 'Root Directory'}
                    </Text>
                    <Text style={styles.folderCardPath} numberOfLines={1}>
                      {pathInput}
                    </Text>
                  </View>
                </View>
                <View style={styles.changeBadge}>
                  <Text style={styles.changeBadgeText}>Change</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 3. Session Model Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RUNTIME MODEL</Text>
              <View style={styles.optionRow}>
                {[
                  { id: 'gemini-3.8-flash-high', label: 'gemini flash' },
                  { id: 'claude-3-7-sonnet', label: 'sonnet 4.6' },
                  { id: 'claude-3-opus', label: 'opus 4.6' },
                ].map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.paramPill, isSelected && styles.paramPillActive]}
                      onPress={() => setSelectedModel(m.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.paramPillText,
                          isSelected && styles.paramPillTextActive,
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Reasoning Effort Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>REASONING EFFORT</Text>
              <View style={styles.optionRow}>
                {(['low', 'medium', 'high', 'xhigh'] as ReasoningEffort[]).map((eff) => {
                  const isSelected = selectedEffort === eff;
                  return (
                    <TouchableOpacity
                      key={eff}
                      style={[styles.paramPill, isSelected && styles.paramPillActive]}
                      onPress={() => setSelectedEffort(eff)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.paramPillText,
                          isSelected && styles.paramPillTextActive,
                        ]}
                      >
                        {eff}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Execution Mode */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EXECUTION MODE</Text>
              <View style={styles.optionRow}>
                {[
                  { id: 'auto' as ExecutionMode, label: 'Auto' },
                  { id: 'plan' as ExecutionMode, label: 'Plan' },
                  { id: 'accept-edits' as ExecutionMode, label: 'Accept Edits' },
                ].map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.paramPill, isSelected && styles.paramPillActive]}
                      onPress={() => setSelectedMode(mode.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.paramPillText,
                          isSelected && styles.paramPillTextActive,
                        ]}
                      >
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.sheetFooter}>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Play size={16} color="#0a0a0a" />
              <Text style={styles.startBtnText}>Start Session in Workspace</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Remote Folder Browser Modal */}
        <FolderPickerModal
          visible={showFolderPicker}
          initialPath={pathInput}
          onClose={() => setShowFolderPicker(false)}
          onSelectFolder={(selected) => setPathInput(selected)}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  handleContainer: {
    width: '100%',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3a',
  },
  sheetContainer: {
    height: FULL_HEIGHT,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 1,
  },
  machineHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a3a3a3',
    letterSpacing: 0.8,
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  wsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  wsChipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  wsChipText: {
    fontSize: 12.5,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  wsChipTextActive: {
    color: '#fafafa',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  browseBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.primary,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: radii.md,
    padding: 12,
  },
  folderCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  folderCardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderCardTextCol: {
    flex: 1,
  },
  folderCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
  },
  folderCardPath: {
    fontSize: 11.5,
    color: '#a3a3a3',
    fontFamily: typography.mono,
    marginTop: 2,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: '#262626',
  },
  changeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d4d4d4',
  },
  suggestionsHeader: {
    fontSize: 11,
    color: '#737373',
  },
  suggestionsScroll: {
    gap: 6,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  suggestionText: {
    fontSize: 11.5,
    color: '#d4d4d4',
    fontFamily: typography.mono,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  paramPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  paramPillText: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  paramPillTextActive: {
    color: '#fafafa',
    fontWeight: '600',
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#121212',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 46,
    gap: 8,
  },
  startBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});

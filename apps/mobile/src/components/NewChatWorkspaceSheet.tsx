import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (visible) {
      fetchKnownWorkspaces();
      const defaultPath =
        targetWorkspacePath ||
        (knownWorkspaces.length > 0 ? knownWorkspaces[0].path : process.cwd?.() || '/');
      setPathInput(defaultPath);
      loadSuggestions(defaultPath);
    }
  }, [visible, targetWorkspacePath, knownWorkspaces.length]);

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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetContainer}>
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
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#8b949e" />
            </TouchableOpacity>
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
                          color={isSelected ? colors.primary : '#8b949e'}
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
              <Play size={16} color="#ffffff" />
              <Text style={styles.startBtnText}>Start Session in Workspace</Text>
            </TouchableOpacity>
          </View>
        </View>

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
  sheetContainer: {
    backgroundColor: '#0d1117',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#21262d',
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
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
    color: '#f0f6fc',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#8b949e',
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
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    maxHeight: 460,
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
    color: '#8b949e',
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  wsChipActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  wsChipText: {
    fontSize: 12.5,
    color: '#8b949e',
    fontWeight: '500',
  },
  wsChipTextActive: {
    color: '#f0f6fc',
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
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
    color: '#f0f6fc',
  },
  folderCardPath: {
    fontSize: 11.5,
    color: '#8b949e',
    fontFamily: typography.mono,
    marginTop: 2,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: '#21262d',
  },
  changeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c9d1d9',
  },
  suggestionsHeader: {
    fontSize: 11,
    color: '#6e7681',
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  suggestionText: {
    fontSize: 11.5,
    color: '#c9d1d9',
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  paramPillActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  paramPillText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  paramPillTextActive: {
    color: '#f0f6fc',
    fontWeight: '600',
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#010409',
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
    color: '#ffffff',
  },
});

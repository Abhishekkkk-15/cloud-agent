import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheet,
  Button,
  Input,
  Badge,
  Item,
  Card,
  Text,
  Select,
  cn,
} from 'panelui-native';
import {
  FolderGit2,
  Folder,
  Play,
  SlidersHorizontal,
  ChevronRight,
  HardDrive,
} from './Icons';
import { useDaemonStore, type ReasoningEffort, type ExecutionMode } from '../stores/useDaemonStore';
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const knownWorkspaces = useDaemonStore((s) => s.knownWorkspaces);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const setSessionConfig = useDaemonStore((s) => s.setSessionConfig);
  const fetchKnownWorkspaces = useDaemonStore((s) => s.fetchKnownWorkspaces);
  const fetchDirectorySuggestions = useDaemonStore((s) => s.fetchDirectorySuggestions);
  const cliCapabilities = useDaemonStore((s) => s.cliCapabilities);

  const [pathInput, setPathInput] = useState<string>('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedModel, setSelectedModel] = useState(sessionConfig.model);
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort>(sessionConfig.effort);
  const [selectedMode, setSelectedMode] = useState<ExecutionMode>(sessionConfig.mode);

  const availableModes: ExecutionMode[] = cliCapabilities?.supportedModes || ['auto', 'plan', 'accept-edits'];
  const supportedEfforts = cliCapabilities?.supportedEffortLevels?.filter((e) => ['low', 'medium', 'high', 'xhigh'].includes(e)) || ['low', 'medium', 'high'];
  const supportsEffort = cliCapabilities?.supportsEffort !== false;

  useEffect(() => {
    if (visible) {
      fetchKnownWorkspaces();
      const defaultPath =
        targetWorkspacePath ||
        (knownWorkspaces.length > 0 ? knownWorkspaces[0].path : '/');
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

  return (
    <>
      <BottomSheet open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
        <BottomSheet.Content
          size="full"
          className="bg-popover border-t border-border p-0 px-0 overflow-hidden"
        >
          <BottomSheet.Header className="px-4 py-3.5 border-b border-border bg-surface pe-4 pr-4">
            <View className="flex-row items-center gap-2.5">
              <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
                <FolderGit2 size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Start New Session
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  Target host: {activeMachine?.name || daemonStatus?.hostname || 'Local Machine'}
                </Text>
              </View>
            </View>
          </BottomSheet.Header>

          <BottomSheet.Body className="p-4">
            {/* Target Path Field */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-semibold text-foreground">
                  Workspace Path
                </Text>
                <Button
                  variant="outline"
                  size="xs"
                  onPress={() => setShowFolderPicker(true)}
                  className="flex-row items-center gap-1 px-2 py-0.5"
                >
                  <Folder size={11} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-medium text-foreground">Browse Host</Text>
                </Button>
              </View>
              <Input
                value={pathInput}
                onChangeText={handlePathChange}
                placeholder="e.g. /home/user/project or D:\projects"
                size="sm"
                variant="outline"
                autoCapitalize="none"
                autoCorrect={false}
                className="font-mono text-xs"
              />
            </View>

            {/* Recent & Discovered Workspaces */}
            {knownWorkspaces.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Recent Workspaces
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {knownWorkspaces.slice(0, 6).map((ws) => {
                    const isSelected = pathInput === ws.path;
                    return (
                      <Button
                        key={ws.path}
                        variant={isSelected ? 'secondary' : 'outline'}
                        size="xs"
                        onPress={() => {
                          setPathInput(ws.path);
                          loadSuggestions(ws.path);
                        }}
                        className="flex-row items-center gap-1"
                      >
                        <HardDrive size={11} color={isSelected ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
                        <Text className="text-xs font-medium text-foreground">{ws.name}</Text>
                      </Button>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Subdirectory Suggestions */}
            {suggestions.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Subdirectories
                </Text>
                <Card className="border border-border bg-surface rounded-xl overflow-hidden p-1">
                  {suggestions.slice(0, 5).map((sug) => (
                    <Item
                      key={sug.fullPath}
                      variant="default"
                      size="xs"
                      className="px-2.5 py-1.5 rounded-lg my-0.5"
                      onPress={() => {
                        setPathInput(sug.fullPath);
                        loadSuggestions(sug.fullPath);
                      }}
                    >
                      <Item.Media variant="icon">
                        <Folder size={14} color={isLight ? '#686868' : '#a3a3a3'} />
                      </Item.Media>
                      <Item.Content>
                        <Item.Title className="text-xs font-medium text-foreground">
                          {sug.name}
                        </Item.Title>
                      </Item.Content>
                      <Item.Actions>
                        <ChevronRight size={12} color={isLight ? '#a3a3a3' : '#686868'} />
                      </Item.Actions>
                    </Item>
                  ))}
                </Card>
              </View>
            )}

            {/* Model & Reasoning Preferences */}
            <View className="mb-2">
              <View className="flex-row items-center gap-1.5 mb-2.5">
                <SlidersHorizontal size={13} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
                <Text className="text-xs font-semibold text-foreground">
                  Reasoning & Execution Mode
                </Text>
              </View>

              <View className="flex-row gap-2.5">
                {supportsEffort && (
                  <View className="flex-1">
                    <Text className="text-[11px] font-medium text-muted-foreground mb-1.5">
                      Reasoning Effort
                    </Text>
                    <Select
                      value={selectedEffort}
                      onValueChange={(val) => setSelectedEffort(val as ReasoningEffort)}
                      presentation="overlay"
                      size="sm"
                      placeholder="Select effort"
                    >
                      {supportedEfforts.map((eff) => (
                        <Select.Item
                          key={eff}
                          value={eff}
                          label={
                            eff === 'xhigh'
                              ? 'X-High'
                              : `${eff.charAt(0).toUpperCase() + eff.slice(1)}`
                          }
                        />
                      ))}
                    </Select>
                  </View>
                )}

                <View className="flex-1">
                  <Text className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    Execution Mode
                  </Text>
                  <Select
                    value={selectedMode}
                    onValueChange={(val) => setSelectedMode(val as ExecutionMode)}
                    presentation="overlay"
                    size="sm"
                    placeholder="Select mode"
                  >
                    {availableModes.map((m) => (
                      <Select.Item
                        key={m}
                        value={m}
                        label={
                          m === 'auto'
                            ? 'Auto'
                            : m === 'plan'
                            ? 'Plan Only'
                            : m === 'accept-edits'
                            ? 'Review Edits'
                            : m
                        }
                      />
                    ))}
                  </Select>
                </View>
              </View>
            </View>
          </BottomSheet.Body>

          {/* Footer CTA */}
          <BottomSheet.Footer className="px-4 py-3 border-t border-border bg-surface flex-row items-center justify-between gap-2">
            <Button variant="outline" size="sm" onPress={onClose} className="px-4">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={handleConfirm}
              disabled={!pathInput.trim()}
              className="flex-1 flex-row items-center justify-center gap-1.5"
            >
              <Play size={13} color={isSwiss ? '#ffffff' : (isLight ? '#fafafa' : '#262626')} />
              <Text className="text-xs font-semibold text-primary-foreground">
                Launch Session
              </Text>
            </Button>
          </BottomSheet.Footer>
        </BottomSheet.Content>
      </BottomSheet>

      {/* Directory Browser Modal */}
      <FolderPickerModal
        visible={showFolderPicker}
        initialPath={pathInput || targetWorkspacePath || undefined}
        onClose={() => setShowFolderPicker(false)}
        onSelectFolder={(selected) => {
          setPathInput(selected);
          loadSuggestions(selected);
        }}
      />
    </>
  );
};

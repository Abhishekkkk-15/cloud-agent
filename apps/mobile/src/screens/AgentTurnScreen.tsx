import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Terminal,
  Link,
  FileText,
  Send,
  FolderGit2,
  GitFork,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Search,
  Brain,
  SlidersHorizontal,
  Command,
  Plus,
  Mic,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from '../components/MarkdownText';
import { ToolActionTray, type ActionStep } from '../components/ToolActionTray';
import { SlashCommandPicker, type SlashCommandItem } from '../components/SlashCommandPicker';
import { SessionConfigSheet } from '../components/SessionConfigSheet';

interface AgentTurnScreenProps {
  onBack?: () => void;
  onOpenDrawer?: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface ChatTurn {
  id: string;
  userMessage?: {
    id: string;
    content: string;
    timestamp?: string;
  };
  assistant?: {
    id: string;
    timestamp?: string;
    reasoning?: string;
    actions: ActionStep[];
    content?: string;
  };
}

export const AgentTurnScreen: React.FC<AgentTurnScreenProps> = ({
  onBack,
  onOpenDrawer,
  onNavigateTab,
}) => {
  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const sessionMessages = useDaemonStore((s) => s.sessionMessages);
  const isSendingPrompt = useDaemonStore((s) => s.isSendingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const hasMoreMessages = useDaemonStore((s) => s.hasMoreMessages);
  const isLoadingOlderMessages = useDaemonStore((s) => s.isLoadingOlderMessages);
  const loadOlderMessages = useDaemonStore((s) => s.loadOlderMessages);

  const [promptInput, setPromptInput] = useState('');
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [openTurnAccordions, setOpenTurnAccordions] = useState<Record<string, boolean>>({});
  const [openReasoningAccordions, setOpenReasoningAccordions] = useState<Record<string, boolean>>({});
  const [selectedActionForTray, setSelectedActionForTray] = useState<ActionStep | null>(null);
  const scrollViewRef = useRef<any>(null);

  const isTurnOpen = (turnId: string) => openTurnAccordions[turnId] ?? true;

  const toggleTurnAccordion = (turnId: string) => {
    setOpenTurnAccordions((prev) => ({
      ...prev,
      [turnId]: !isTurnOpen(turnId),
    }));
  };

  const isReasoningOpen = (turnId: string) => openReasoningAccordions[turnId] ?? false;

  const toggleReasoningAccordion = (turnId: string) => {
    setOpenReasoningAccordions((prev) => ({
      ...prev,
      [turnId]: !isReasoningOpen(turnId),
    }));
  };

  const handleInputChange = (text: string) => {
    setPromptInput(text);
    if (text.startsWith('/')) {
      setShowCommandPicker(true);
    } else if (showCommandPicker && !text.includes('/')) {
      setShowCommandPicker(false);
    }
  };

  const handleSelectCommand = (item: SlashCommandItem, immediate?: boolean) => {
    setShowCommandPicker(false);
    if (immediate) {
      setPromptInput('');
      sendPrompt(item.template);
    } else {
      setPromptInput(item.template);
    }
  };

  const handleSendPrompt = async () => {
    if (!promptInput.trim() || isSendingPrompt) return;
    const text = promptInput;
    setPromptInput('');
    await sendPrompt(text);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleScrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const formatTimeAgo = (isoDate?: string) => {
    if (!isoDate) return '1 hour ago';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    if (isNaN(diffMs)) return '1 hour ago';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} hour${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const repoName =
    activeSession?.workspaceName ||
    (targetWorkspacePath ? targetWorkspacePath.split(/[\\/]/).pop() || 'Workspace' : 'Workspace');
  const titleStr = activeSession?.title || 'New Session';
  const modelStr = activeSession?.model || sessionConfig.model.split('-')[0] || 'antigravity';
  const subtitleStr = `${repoName} • ${modelStr}`;
  const timeAgoStr = formatTimeAgo(activeSession?.createdAt);

  // Group linear chronological messages into sequential chat turns matching Antigravity CLI flow
  const chatTurns = useMemo<ChatTurn[]>(() => {
    if (!sessionMessages || sessionMessages.length === 0) {
      return [];
    }

    const turns: ChatTurn[] = [];
    let currentTurn: ChatTurn | null = null;

    for (let i = 0; i < sessionMessages.length; i++) {
      const msg = sessionMessages[i];

      if (msg.role === 'user') {
        // Start a new turn for this user prompt
        currentTurn = {
          id: msg.id || `turn_${i}`,
          userMessage: {
            id: msg.id || `usr_${i}`,
            content: msg.content,
            timestamp: msg.timestamp,
          },
        };
        turns.push(currentTurn);
      } else if (msg.role === 'assistant') {
        if (!currentTurn) {
          // Assistant response before any user prompt (welcome or truncated page)
          currentTurn = {
            id: msg.id || `turn_${i}`,
          };
          turns.push(currentTurn);
        }

        if (!currentTurn.assistant) {
          currentTurn.assistant = {
            id: msg.id || `asst_${i}`,
            timestamp: msg.timestamp,
            actions: [],
            content: '',
            reasoning: '',
          };
        }

        if (msg.reasoning) {
          currentTurn.assistant.reasoning = currentTurn.assistant.reasoning
            ? currentTurn.assistant.reasoning + '\n' + msg.reasoning
            : msg.reasoning;
        }

        if (msg.content) {
          currentTurn.assistant.content = currentTurn.assistant.content
            ? currentTurn.assistant.content + '\n' + msg.content
            : msg.content;
        }

        // Process tool calls made in this assistant step
        const asstObj = currentTurn.assistant;
        if (asstObj && msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach((tc, tcIdx) => {
            const name = tc.name || '';
            let category: ActionStep['category'] = 'terminal';
            if (
              name.includes('file') ||
              name === 'read_file' ||
              name === 'view_file' ||
              name === 'edit_file' ||
              name === 'write_file'
            ) {
              category = 'file';
            } else if (name.includes('mcp') || name.startsWith('mcp_') || name === 'call_mcp_tool') {
              category = 'mcp';
            } else if (
              name.includes('subagent') ||
              name.includes('skill') ||
              name === 'schedule' ||
              name === 'ask_question' ||
              name === 'send_message'
            ) {
              category = 'skill';
            } else if (name.includes('search') || name === 'search_web') {
              category = 'search';
            }

            // Correlate with tool output in tc.result or subsequent role === 'tool' message
            let toolOutput: string | undefined =
              typeof tc.result === 'string'
                ? tc.result
                : tc.result
                ? JSON.stringify(tc.result, null, 2)
                : undefined;

            if (!toolOutput) {
              for (let nextIdx = i + 1; nextIdx < sessionMessages.length; nextIdx++) {
                const nextMsg = sessionMessages[nextIdx];
                if (nextMsg.role === 'tool') {
                  toolOutput = nextMsg.content;
                  break;
                }
                if (nextMsg.role === 'user' || nextMsg.role === 'assistant') {
                  break;
                }
              }
            }

            const args = tc.arguments || {};
            let title = `Execute ${name}`;
            if (args.toolSummary) {
              title = String(args.toolSummary).replace(/^"|"$/g, '');
            } else if (args.CommandLine) {
              title = String(args.CommandLine).replace(/^"|"$/g, '');
            } else if (args.Path || args.AbsolutePath) {
              const p = String(args.Path || args.AbsolutePath).replace(/^"|"$/g, '');
              const filename = p.split(/[\\/]/).pop() || p;
              title = `${name.replace(/_file$/, '')}: ${filename}`;
            } else if (args.query) {
              title = `Search: "${String(args.query).replace(/^"|"$/g, '')}"`;
            } else if (args.ServerName && args.ToolName) {
              title = `MCP: ${args.ServerName} / ${args.ToolName}`;
            }

            let exitCode: number | undefined;
            if (toolOutput) {
              const exitMatch = /(?:exited\s+with\s+code\s+|exit\s+code\s+)(\d+)/i.exec(toolOutput);
              if (exitMatch) {
                exitCode = parseInt(exitMatch[1], 10);
              }
            }

            asstObj.actions.push({
              id: `action_${tc.id || `${i}_${tcIdx}`}`,
              title,
              category,
              toolName: name,
              hasDetails: true,
              args,
              output: toolOutput,
              status: tc.status || (exitCode === undefined || exitCode === 0 ? 'success' : 'error'),
              exitCode,
              details: toolOutput || (typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)),
            });
          });
        }
      }
    }

    return turns;
  }, [sessionMessages]);

  const liveSelectedAction = useMemo(() => {
    if (!selectedActionForTray) return null;
    for (const turn of chatTurns) {
      if (turn.assistant?.actions) {
        const found = turn.assistant.actions.find((a) => a.id === selectedActionForTray.id);
        if (found) return found;
      }
    }
    return selectedActionForTray;
  }, [chatTurns, selectedActionForTray]);

  const displayedTurns = chatTurns;

  const renderActionIcon = (category: ActionStep['category']) => {
    switch (category) {
      case 'repo':
        return <FolderGit2 size={16} color="#ffffff" />;
      case 'mcp':
        return <Link size={16} color="#ffffff" />;
      case 'skill':
        return <GitFork size={16} color="#ffffff" />;
      case 'file':
        return <FileText size={16} color="#ffffff" />;
      case 'search':
        return <Search size={16} color="#ffffff" />;
      case 'terminal':
      default:
        return <Terminal size={16} color="#ffffff" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Navigation Bar */}
      <HeaderBar
        title={titleStr}
        subtitle={subtitleStr}
        onBack={onOpenDrawer || onBack}
        onMore={() => {
          Alert.alert(
            'Session Options',
            `Session: ${activeSession?.id || 'Active'}\nModel: ${modelStr}\nWorkspace: ${repoName}`,
            [
              { text: 'Browse Sessions', onPress: () => onNavigateTab && onNavigateTab('sessions') },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Metadata Summary Row & Config Pill */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {activeSession?.createdAt ? `Created ${timeAgoStr}` : 'Active Session'}
            {chatTurns.length > 0 ? (
              <>
                <Text style={styles.metaDot}> • </Text>
                {chatTurns.length} {chatTurns.length === 1 ? 'turn' : 'turns'}
              </>
            ) : null}
          </Text>

          {/* Interactive Session Parameters Pill */}
          <TouchableOpacity
            style={styles.configPill}
            onPress={() => setShowConfigSheet(true)}
            activeOpacity={0.75}
          >
            <SlidersHorizontal size={11} color={colors.green} />
            <Text style={styles.configPillText} numberOfLines={1}>
              {sessionConfig.model.includes('flash')
                ? 'gemini flash'
                : sessionConfig.model.includes('sonnet')
                ? 'sonnet 4.6'
                : sessionConfig.model.includes('opus')
                ? 'opus 4.6'
                : sessionConfig.model.split('-')[0]}
              {' • '}
              {sessionConfig.effort}
              {sessionConfig.mode !== 'auto' ? ` • ${sessionConfig.mode}` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. Pagination: Load Older History Button */}
        {hasMoreMessages && (
          <View style={styles.loadOlderContainer}>
            <TouchableOpacity
              style={styles.loadOlderBtn}
              onPress={loadOlderMessages}
              disabled={isLoadingOlderMessages}
              activeOpacity={0.7}
            >
              {isLoadingOlderMessages ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : (
                <>
                  <ArrowUp size={13} color={colors.green} />
                  <Text style={styles.loadOlderText}>Load older messages</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Sequential Turn-by-Turn Timeline */}
        {displayedTurns.length === 0 ? (
          <View style={styles.emptyChatBox}>
            <View style={styles.emptyChatIconBox}>
              <Terminal size={22} color="#ffffff" />
            </View>
            <Text style={styles.emptyChatTitle}>No messages in this session yet</Text>
            <Text style={styles.emptyChatSubtitle}>
              Send a prompt below to interact with the Antigravity agent runtime.
            </Text>
          </View>
        ) : (
          displayedTurns.map((turn, turnIdx) => (
            <View key={turn.id || turnIdx} style={styles.turnCardContainer}>
              {/* User Prompt (if present in turn) */}
              {turn.userMessage?.content ? (
                <View style={styles.userCommentCard}>
                  <View style={styles.userHeaderRow}>
                    <Text style={styles.userCommentHeader}>User</Text>
                    {turn.userMessage.timestamp ? (
                      <Text style={styles.userTimestamp}>
                        {formatTimeAgo(turn.userMessage.timestamp)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.userCommentBody}>{turn.userMessage.content}</Text>
                </View>
              ) : null}

              {/* Assistant Turn Body */}
              {turn.assistant ? (
                <View style={styles.assistantTurnWrapper}>
                  {/* Reasoning Process (Collapsible, subtle dark/gray theme) */}
                  {turn.assistant.reasoning ? (
                    <View style={styles.reasoningContainer}>
                      <TouchableOpacity
                        style={styles.reasoningToggleBtn}
                        onPress={() => toggleReasoningAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.reasoningToggleLeft}>
                          <Brain size={13} color="#8b949e" />
                          <Text style={styles.reasoningToggleText}>Thought process</Text>
                        </View>
                        <View style={styles.reasoningToggleRight}>
                          {isReasoningOpen(turn.id) ? (
                            <ChevronUp size={14} color="#8b949e" />
                          ) : (
                            <ChevronDown size={14} color="#8b949e" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isReasoningOpen(turn.id) && (
                        <View style={styles.reasoningBody}>
                          <Text style={styles.reasoningText} selectable>
                            {turn.assistant.reasoning.trim()}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Inline Actions executed for THIS turn */}
                  {turn.assistant.actions && turn.assistant.actions.length > 0 ? (
                    <View style={styles.accordionSection}>
                      <TouchableOpacity
                        style={styles.accordionHeader}
                        onPress={() => toggleTurnAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.accordionHeaderLeft}>
                          {turn.assistant.actions.some((a) => a.status === 'running') ? (
                            <View style={[styles.greenCheckCircle, { backgroundColor: 'transparent' }]}>
                              <ActivityIndicator size="small" color={colors.green} />
                            </View>
                          ) : (
                            <View style={styles.greenCheckCircle}>
                              <Check size={12} color="#ffffff" />
                            </View>
                          )}
                          <View style={styles.accordionTitleCol}>
                            <Text style={styles.accordionTitle} numberOfLines={1}>
                              {turn.assistant.actions[0]?.title || 'Executed turn actions'}
                            </Text>
                            <Text style={styles.accordionSubtitle}>
                              {turn.assistant.actions.length} action
                              {turn.assistant.actions.length > 1 ? 's' : ''}
                              {turn.assistant.actions.some((a) => a.status === 'running') ? ' • Running...' : ''}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.accordionHeaderRight}>
                          {isTurnOpen(turn.id) ? (
                            <ChevronUp size={16} color="#8b949e" />
                          ) : (
                            <ChevronDown size={16} color="#8b949e" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Action Step Rows */}
                      {isTurnOpen(turn.id) && (
                        <View style={styles.actionStepsList}>
                          {turn.assistant.actions.map((action) => (
                            <TouchableOpacity
                              key={action.id}
                              style={styles.actionStepRow}
                              activeOpacity={0.7}
                              onPress={() => setSelectedActionForTray(action)}
                            >
                              <View style={styles.actionStepLeft}>
                                <View style={styles.actionStepIconBox}>
                                  {renderActionIcon(action.category)}
                                </View>
                                <Text style={styles.actionStepText} numberOfLines={1}>
                                  {action.title}
                                </Text>
                              </View>

                              <View style={styles.actionStepRightCol}>
                                {action.status === 'running' ? (
                                  <View style={styles.actionRunningPill}>
                                    <ActivityIndicator size="small" color={colors.green} style={{ transform: [{ scale: 0.7 }] }} />
                                    <Text style={styles.actionRunningText}>Running</Text>
                                  </View>
                                ) : action.duration ? (
                                  <Text style={styles.actionStepDuration}>{action.duration}</Text>
                                ) : null}
                                <TouchableOpacity
                                  style={styles.actionStepChevronBox}
                                  activeOpacity={0.7}
                                  onPress={() => setSelectedActionForTray(action)}
                                >
                                  <ChevronRight size={16} color="#8b949e" />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Assistant Resolution / Markdown Response */}
                  {turn.assistant.content ? (
                    <View style={styles.resolutionContainer}>
                      <MarkdownText content={turn.assistant.content} isUser={false} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}

        {/* 5. Streaming Live Indicator */}
        {isSendingPrompt && (
          <View style={styles.streamingIndicatorRow}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.streamingText}>Agent is thinking and executing...</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Floating Scroll FAB */}
      <View style={[styles.scrollFabContainer, { pointerEvents: 'box-none' }]}>
        <TouchableOpacity
          style={styles.scrollFab}
          activeOpacity={0.7}
          onPress={handleScrollToBottom}
        >
          <ArrowDown size={14} color="#8b949e" />
        </TouchableOpacity>
      </View>

      {/* 7. Chat Input Bar (Image 1 Capsule Shape) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.chatInputWrapper}
      >
        {/* Autocomplete Slash Command Picker Overlay */}
        <SlashCommandPicker
          visible={showCommandPicker}
          searchQuery={promptInput}
          onSelect={handleSelectCommand}
          onClose={() => setShowCommandPicker(false)}
        />

        <View style={styles.chatCapsuleContainer}>
          {/* Circular '+' Button on Left */}
          <TouchableOpacity
            style={[styles.capsulePlusBtn, showCommandPicker && styles.capsulePlusBtnActive]}
            activeOpacity={0.7}
            onPress={() => setShowCommandPicker((prev) => !prev)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={16} color={showCommandPicker ? colors.primary : '#c9d1d9'} />
          </TouchableOpacity>

          {/* Capsule Text Field */}
          <TextInput
            style={styles.capsuleTextInput}
            placeholder="Type a message..."
            placeholderTextColor="#6e7681"
            value={promptInput}
            onChangeText={handleInputChange}
            onSubmitEditing={handleSendPrompt}
            returnKeyType="send"
            multiline={false}
            editable={!isSendingPrompt}
          />

          {/* Action on Right: Send or Mic */}
          {promptInput.trim().length > 0 || isSendingPrompt ? (
            <TouchableOpacity
              style={[
                styles.capsuleSendBtn,
                (!promptInput.trim() || isSendingPrompt) && styles.capsuleSendBtnDisabled,
              ]}
              onPress={handleSendPrompt}
              activeOpacity={0.85}
              disabled={!promptInput.trim() || isSendingPrompt}
            >
              {isSendingPrompt ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={15} color="#ffffff" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.capsuleMicBtn}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Voice Input',
                  'Antigravity voice input is ready. Type or speak your prompt directly.'
                );
              }}
            >
              <Mic size={18} color="#8b949e" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* 8. Draggable Tool Slide Tray */}
      <ToolActionTray
        visible={Boolean(selectedActionForTray)}
        action={liveSelectedAction}
        onClose={() => setSelectedActionForTray(null)}
      />

      {/* 9. Session Parameters Bottom Sheet */}
      <SessionConfigSheet
        visible={showConfigSheet}
        onClose={() => setShowConfigSheet(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
  },

  // Metadata summary row & session config
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 8,
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#8b949e',
    flex: 1,
  },
  metaDot: {
    color: '#484f58',
  },
  configPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  configPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },

  // Pagination header
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  loadOlderText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.green,
    fontFamily: typography.mono,
  },

  // Sequential Turn Card
  turnCardContainer: {
    marginBottom: 16,
  },
  userCommentCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 8,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  userCommentHeader: {
    fontSize: 12,
    color: '#8b949e',
  },
  userTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  userCommentBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#f0f6fc',
  },

  // Assistant turn wrapper
  assistantTurnWrapper: {
    marginTop: 2,
  },

  // Copilot Action Summary Accordion
  accordionSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingBottom: 8,
    paddingTop: 4,
    marginBottom: 10,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  greenCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  accordionTitleCol: {
    flex: 1,
    overflow: 'hidden',
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f0f6fc',
    lineHeight: 18,
  },
  accordionSubtitle: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 2,
    lineHeight: 16,
  },
  accordionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },

  // Action Steps List
  actionStepsList: {
    marginTop: 8,
  },
  actionStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 38, 45, 0.5)',
  },
  actionStepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  actionStepIconBox: {
    width: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStepText: {
    fontSize: 12,
    color: '#c9d1d9',
    flex: 1,
  },
  actionStepRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionRunningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  actionRunningText: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: typography.mono,
  },
  actionStepDuration: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
    marginLeft: 8,
  },
  actionStepChevronBox: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Resolution summary container
  resolutionContainer: {
    paddingTop: 2,
  },

  // Reasoning Collapsible Block
  reasoningContainer: {
    marginVertical: 4,
    borderRadius: radii.md,
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#21262d',
    overflow: 'hidden',
  },
  reasoningToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(22, 27, 34, 0.4)',
  },
  reasoningToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reasoningToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8b949e',
    fontFamily: typography.mono,
  },
  reasoningToggleRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasoningBody: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    borderLeftWidth: 2,
    borderLeftColor: '#30363d',
  },
  reasoningText: {
    fontSize: 11.5,
    lineHeight: 18,
    color: '#8b949e',
    fontFamily: typography.mono,
  },

  // Streaming indicator
  streamingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  streamingText: {
    fontSize: 13,
    color: colors.green,
    fontStyle: 'italic',
  },

  // Empty chat state
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyChatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Floating Action Buttons
  scrollFabContainer: {
    position: 'absolute',
    bottom: 74,
    right: 16,
    zIndex: 20,
  },
  scrollFab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  // Chat Input Bar (Capsule Style)
  chatInputWrapper: {
    backgroundColor: '#0d1117',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  chatCapsuleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 28,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  capsulePlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsulePlusBtnActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
    borderWidth: 1,
  },
  capsuleTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#f0f6fc',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  capsuleSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleSendBtnDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
  capsuleMicBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  FileCode,
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
  Layers,
  Square,
  Wrench,
  Copy,
  X,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from '../components/MarkdownText';
import { ToolActionTray, type ActionStep } from '../components/ToolActionTray';
import { SlashCommandPicker, type SlashCommandItem } from '../components/SlashCommandPicker';
import { SessionConfigSheet } from '../components/SessionConfigSheet';
import { TerminalSheet } from '../components/TerminalSheet';
import { LiveApprovalCard } from '../components/LiveApprovalCard';
import { SessionActionModal } from '../components/SessionActionModal';
import { ArtifactsSheet } from '../components/ArtifactsSheet';
import { AutoHealerModal } from '../components/AutoHealerModal';

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
  const isCancellingPrompt = useDaemonStore((s) => s.isCancellingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const cancelPrompt = useDaemonStore((s) => s.cancelPrompt);
  const hasMoreMessages = useDaemonStore((s) => s.hasMoreMessages);
  const isLoadingOlderMessages = useDaemonStore((s) => s.isLoadingOlderMessages);
  const loadOlderMessages = useDaemonStore((s) => s.loadOlderMessages);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const respondApproval = useDaemonStore((s) => s.respondApproval);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);
  const sessionArtifacts = useDaemonStore((s) => s.sessionArtifacts);
  const fetchSessionArtifacts = useDaemonStore((s) => s.fetchSessionArtifacts);
  const isAutoHealerModalVisible = useDaemonStore((s) => s.isAutoHealerModalVisible);
  const dismissAutoHealer = useDaemonStore((s) => s.dismissAutoHealer);

  const [promptInput, setPromptInput] = useState('');
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showArtifactsSheet, setShowArtifactsSheet] = useState(false);
  const [artifactFilterQuery, setArtifactFilterQuery] = useState('');
  const [showSessionActionModal, setShowSessionActionModal] = useState(false);
  const [isRespondingApproval, setIsRespondingApproval] = useState(false);
  const [openTurnAccordions, setOpenTurnAccordions] = useState<Record<string, boolean>>({});
  const [openReasoningAccordions, setOpenReasoningAccordions] = useState<Record<string, boolean>>({});
  const [selectedActionForTray, setSelectedActionForTray] = useState<ActionStep | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
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

  const handleCopyTurnText = (turnId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedTurnId(turnId);
    setTimeout(() => {
      setCopiedTurnId(null);
    }, 1500);
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
    if (item.command === '/artifact' || item.command === '/artifacts') {
      setPromptInput('');
      setArtifactFilterQuery('');
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }
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
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Client-side interception of /artifact and /artifacts commands
    if (lower === '/artifact' || lower === '/artifacts') {
      setPromptInput('');
      setArtifactFilterQuery('');
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }
    if (lower.startsWith('/artifact ') || lower.startsWith('/artifacts ')) {
      const q = trimmed.replace(/^\/artifacts?\s+/i, '');
      setPromptInput('');
      setArtifactFilterQuery(q);
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }

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

  // Group linear chronological messages into sequential chat turns matching Antigravity flow
  const chatTurns = useMemo<ChatTurn[]>(() => {
    if (!sessionMessages || sessionMessages.length === 0) {
      return [];
    }

    const turns: ChatTurn[] = [];
    let currentTurn: ChatTurn | null = null;

    for (let i = 0; i < sessionMessages.length; i++) {
      const msg = sessionMessages[i];

      if (msg.role === 'user') {
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

            // Correlate with tool output
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
        return <FolderGit2 size={15} color="#ffffff" />;
      case 'mcp':
        return <Link size={15} color="#ffffff" />;
      case 'skill':
        return <GitFork size={15} color="#ffffff" />;
      case 'file':
        return <FileText size={15} color="#ffffff" />;
      case 'search':
        return <Search size={15} color="#ffffff" />;
      case 'terminal':
      default:
        return <Terminal size={15} color="#ffffff" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Header Bar */}
      <HeaderBar
        title={titleStr}
        subtitle={subtitleStr}
        onBack={onOpenDrawer || onBack}
        rightElement={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.headerTerminalBtn}
              onPress={() => {
                setArtifactFilterQuery('');
                setShowArtifactsSheet(true);
                fetchSessionArtifacts().catch(() => {});
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="View Session Artifacts"
            >
              <Layers size={16} color="#fafafa" />
              {sessionArtifacts.length > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{sessionArtifacts.length}</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerTerminalBtn}
              onPress={() => setShowTerminal(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open Terminal"
            >
              <Terminal size={16} color="#fafafa" />
            </TouchableOpacity>
          </View>
        }
        onMore={() => {
          if (activeSession) {
            setShowSessionActionModal(true);
          } else if (onNavigateTab) {
            onNavigateTab('sessions');
          }
        }}
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Top Meta Pill Row (Paradev Model & Context Info) */}
        <View style={styles.sessionMetaPillRow}>
          <TouchableOpacity
            style={styles.modelStatusPill}
            onPress={() => setShowConfigSheet(true)}
            activeOpacity={0.75}
          >

            <Text style={styles.modelStatusText} numberOfLines={1}>
              {isSendingPrompt ? 'agent.active' : 'agent.ready'} •{' '}
              {sessionConfig.model.includes('flash')
                ? 'gemini-flash'
                : sessionConfig.model.includes('sonnet')
                ? 'claude-3-5-sonnet'
                : sessionConfig.model.includes('opus')
                ? 'claude-3-opus'
                : sessionConfig.model}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contextPill}
            onPress={() => setShowConfigSheet(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.contextPillText}>
              ctx: {sessionMessages.length > 0 ? `${sessionMessages.length} msgs` : '0 msgs'}
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
                <ActivityIndicator size="small" color={colors.primaryLight} />
              ) : (
                <>
                  <ArrowUp size={13} color={colors.primaryLight} />
                  <Text style={styles.loadOlderText}>Load older messages</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Turn-by-Turn Timeline (Paradev OutgoingBubble & AgentMessage) */}
        {displayedTurns.length === 0 ? (
          <View style={styles.emptyChatBox}>
            <View style={styles.emptyChatIconBox}>
              <Terminal size={22} color="#fafafa" />
            </View>
            <Text style={styles.emptyChatTitle}>No messages in this session yet</Text>
            <Text style={styles.emptyChatSubtitle}>
              Send a prompt below to interact with the Antigravity agent runtime.
            </Text>
          </View>
        ) : (
          displayedTurns.map((turn, turnIdx) => (
            <View key={turn.id || turnIdx} style={styles.turnCardContainer}>
              {/* User Prompt: Paradev OutgoingBubble (bg-[#2F2F2F], rounded-[22px], self-end) */}
              {turn.userMessage?.content ? (
                <View style={styles.userBubbleWrapper}>
                  <View style={styles.userOutgoingBubble}>
                    <Text style={styles.userBubbleText}>{turn.userMessage.content}</Text>
                  </View>
                  <View style={styles.userBubbleMeta}>
                    <Text style={styles.userBubbleMetaText}>
                      {turn.userMessage.timestamp
                        ? formatTimeAgo(turn.userMessage.timestamp)
                        : `turn #${turnIdx + 1}`}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Assistant Turn: Natural Unboxed Flow matching Paradev AgentMessage */}
              {turn.assistant ? (
                <View style={styles.assistantTurnWrapper}>
                  {/* Reasoning Process: Paradev Reasoning Component */}
                  {turn.assistant.reasoning ? (
                    <View style={styles.reasoningContainer}>
                      <TouchableOpacity
                        style={styles.reasoningToggleBtn}
                        onPress={() => toggleReasoningAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.reasoningToggleLeft}>
                          <Brain size={14} color="#a3a3a3" />
                          <Text style={styles.reasoningToggleText}>
                            {isSendingPrompt && turnIdx === displayedTurns.length - 1
                              ? 'Thinking...'
                              : 'Thought for a few seconds'}
                          </Text>
                        </View>
                        <View style={styles.reasoningToggleRight}>
                          {isReasoningOpen(turn.id) ? (
                            <ChevronUp size={14} color="#a3a3a3" />
                          ) : (
                            <ChevronDown size={14} color="#a3a3a3" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isReasoningOpen(turn.id) && (
                        <View style={styles.reasoningBody}>
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ maxHeight: 220 }}>
                            <Text style={styles.reasoningText} selectable>
                              {turn.assistant.reasoning.trim()}
                            </Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Inline Tool Execution Steps: Paradev ToolCallRow */}
                  {turn.assistant.actions && turn.assistant.actions.length > 0 ? (
                    <View style={styles.toolCallsSection}>
                      <TouchableOpacity
                        style={styles.toolCallsSummaryRow}
                        onPress={() => toggleTurnAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.toolCallsSummaryLeft}>
                          {turn.assistant.actions.some((a) => a.status === 'running') ? (
                            <ActivityIndicator
                              size="small"
                              color="#a3a3a3"
                              style={{ transform: [{ scale: 0.7 }], marginRight: 6 }}
                            />
                          ) : (
                            <Wrench size={13} color="#737373" style={{ marginRight: 6 }} />
                          )}
                          <Text style={styles.toolCallsSummaryText}>
                            {turn.assistant.actions.length} tool call
                            {turn.assistant.actions.length > 1 ? 's' : ''} executed
                          </Text>
                        </View>
                        <View style={styles.toolCallsSummaryRight}>
                          {isTurnOpen(turn.id) ? (
                            <ChevronUp size={14} color="#737373" />
                          ) : (
                            <ChevronDown size={14} color="#737373" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isTurnOpen(turn.id) && (
                        <View style={styles.toolActionRowsList}>
                          {turn.assistant.actions.map((action) => (
                            <TouchableOpacity
                              key={action.id}
                              style={styles.toolCallRow}
                              activeOpacity={0.7}
                              onPress={() => setSelectedActionForTray(action)}
                            >
                              <View style={styles.toolCallLeft}>
                                <View style={styles.toolCallIconBox}>
                                  {renderActionIcon(action.category)}
                                </View>
                                <Text style={styles.toolCallTitle} numberOfLines={1}>
                                  {action.title}
                                </Text>
                              </View>

                              <View style={styles.toolCallRight}>
                                {action.status === 'running' ? (
                                  <View style={styles.actionRunningBadge}>
                                    <ActivityIndicator
                                      size="small"
                                      color="#a3a3a3"
                                      style={{ transform: [{ scale: 0.65 }] }}
                                    />
                                    <Text style={styles.actionRunningBadgeText}>Running</Text>
                                  </View>
                                ) : action.status === 'error' ? (
                                  <View style={styles.actionErrorBadge}>
                                    <X size={12} color="#ef4444" />
                                    <Text style={styles.actionErrorBadgeText}>Failed</Text>
                                  </View>
                                ) : (
                                  <Check size={13} color="#fafafa" />
                                )}
                                <ChevronRight size={14} color="#737373" />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Assistant Markdown Resolution */}
                  {turn.assistant.content ? (
                    <View style={styles.resolutionContainer}>
                      <MarkdownText content={turn.assistant.content} isUser={false} />

                      {/* Paradev Action Row (Copy Message & Branch Icon Buttons) */}
                      <View style={styles.agentActionRow}>
                        <TouchableOpacity
                          style={styles.agentActionBtn}
                          onPress={() =>
                            handleCopyTurnText(turn.id, turn.assistant?.content || '')
                          }
                          activeOpacity={0.7}
                          accessibilityLabel="Copy message"
                        >
                          {copiedTurnId === turn.id ? (
                            <Check size={14} color="#fafafa" />
                          ) : (
                            <Copy size={14} color="#737373" />
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.agentActionBtn}
                          onPress={() => {
                            setPromptInput(`Regarding turn #${turnIdx + 1}: `);
                          }}
                          activeOpacity={0.7}
                          accessibilityLabel="Branch from here"
                        >
                          <GitFork size={14} color="#737373" />
                        </TouchableOpacity>

                        <View style={styles.agentMetaPill}>
                          <Text style={styles.agentMetaPillText}>{modelStr}</Text>
                        </View>
                      </View>
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
            <ActivityIndicator size="small" color="#a3a3a3" />
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
          <ArrowDown size={14} color="#a3a3a3" />
        </TouchableOpacity>
      </View>

      {/* 7. Chat Input Bar: Floating Capsule */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.chatInputWrapper}
        pointerEvents="box-none"
      >
        {/* Autocomplete Slash Command Picker Overlay */}
        <SlashCommandPicker
          visible={showCommandPicker}
          searchQuery={promptInput}
          onSelect={handleSelectCommand}
          onClose={() => setShowCommandPicker(false)}
        />

        {/* Interactive Live Tool Approval Card (Paradev ApprovalCard) */}
        {pendingApproval && (
          <LiveApprovalCard
            approval={pendingApproval}
            isResponding={isRespondingApproval}
            onAuthorize={async () => {
              setIsRespondingApproval(true);
              await respondApproval(true);
              setIsRespondingApproval(false);
            }}
            onDeny={async () => {
              setIsRespondingApproval(true);
              await respondApproval(false);
              setIsRespondingApproval(false);
            }}
          />
        )}

        {/* Paradev Inset Composer Card */}
        <View style={styles.composerCard}>
          {/* Circular '+' Button on Left */}
          <TouchableOpacity
            style={[styles.composerPlusBtn, showCommandPicker && styles.composerPlusBtnActive]}
            activeOpacity={0.7}
            onPress={() => setShowCommandPicker((prev) => !prev)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={16} color={showCommandPicker ? '#fafafa' : '#a3a3a3'} />
          </TouchableOpacity>

          {/* Clean Text Input with Dynamic Multiline Expansion */}
          <TextInput
            style={styles.composerTextInput}
            placeholder="Type a message..."
            placeholderTextColor="#737373"
            value={promptInput}
            onChangeText={handleInputChange}
            onSubmitEditing={Platform.OS === 'web' ? handleSendPrompt : undefined}
            multiline={true}
            blurOnSubmit={false}
            editable={!isSendingPrompt}
          />

          {/* Right Action: Stop, ArrowUp Send, or Mic */}
          {isSendingPrompt ? (
            <TouchableOpacity
              style={styles.composerStopBtn}
              onPress={cancelPrompt}
              activeOpacity={0.8}
              accessibilityLabel="Stop agent turn"
              disabled={isCancellingPrompt}
            >
              {isCancellingPrompt ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Square size={13} color="#ffffff" />
              )}
            </TouchableOpacity>
          ) : promptInput.trim().length > 0 ? (
            <TouchableOpacity
              style={styles.composerSendBtn}
              onPress={handleSendPrompt}
              activeOpacity={0.85}
            >
              <ArrowUp size={16} color="#0a0a0a" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.composerMicBtn}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Voice Input',
                  'Antigravity voice input is ready. Type or speak your prompt directly.'
                );
              }}
            >
              <Mic size={17} color="#737373" />
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

      {/* 10. Live Interactive Terminal Sheet */}
      <TerminalSheet
        visible={showTerminal}
        onClose={() => setShowTerminal(false)}
      />

      {/* 11. Session Action Modal (Rename, Pin, Delete) */}
      <SessionActionModal
        visible={showSessionActionModal}
        session={activeSession}
        onClose={() => setShowSessionActionModal(false)}
        onRename={async (sess, title) => {
          await renameSession(sess.id, title);
        }}
        onTogglePin={async (sess) => {
          await togglePinSession(sess.id);
        }}
        onDelete={async (sess) => {
          await deleteSession(sess.id);
        }}
      />

      {/* 12. Session Artifacts Bottom Sheet */}
      <ArtifactsSheet
        visible={showArtifactsSheet}
        onClose={() => setShowArtifactsSheet(false)}
        initialSearchQuery={artifactFilterQuery}
      />

      {/* 13. Autonomous On-Call & PR Review Modal */}
      <AutoHealerModal
        visible={isAutoHealerModalVisible}
        onClose={dismissAutoHealer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Paradev root dark theme
  },
  headerTerminalBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.btn,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fafafa',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0a0a0a',
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
  sessionMetaPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  modelStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    flexShrink: 1,
  },
  modelStatusText: {
    fontSize: 11,
    color: '#a3a3a3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  contextPill: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  contextPillText: {
    fontSize: 10,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadOlderText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Sequential Turn Card
  turnCardContainer: {
    marginBottom: 14,
  },

  // User Message: Paradev OutgoingBubble (bg-[#2F2F2F], rounded-[22px], max-w-[82%])
  userBubbleWrapper: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: 4,
  },
  userOutgoingBubble: {
    maxWidth: '82%',
    backgroundColor: '#2F2F2F', // Paradev OutgoingBubble
    borderRadius: radii.bubble,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubbleText: {
    fontSize: 15.5,
    lineHeight: 22,
    color: '#fafafa',
  },
  userBubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginRight: 6,
  },
  userBubbleMetaText: {
    fontSize: 10.5,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Assistant Turn: Natural Unboxed Flow
  assistantTurnWrapper: {
    width: '100%',
    marginBottom: 16,
  },

  // Paradev Reasoning Component
  reasoningContainer: {
    marginVertical: 4,
    borderRadius: radii.lg,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  reasoningToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reasoningToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reasoningToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  reasoningToggleRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasoningBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
  },
  reasoningText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#a3a3a3',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Paradev ToolCallRow Section
  toolCallsSection: {
    marginVertical: 6,
    borderRadius: radii.lg,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  toolCallsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolCallsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolCallsSummaryText: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  toolCallsSummaryRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActionRowsList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  toolCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  toolCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  toolCallIconBox: {
    width: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCallTitle: {
    fontSize: 12,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  toolCallRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionRunningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionRunningBadgeText: {
    fontSize: 10,
    color: '#fafafa',
    fontWeight: '600',
  },
  actionErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionErrorBadgeText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },

  // Resolution summary container
  resolutionContainer: {
    paddingTop: 2,
  },

  // Paradev AgentMessage Footer Action Row
  agentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingLeft: 2,
  },
  agentActionBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.btn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  agentMetaPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  agentMetaPillText: {
    fontSize: 10,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#fafafa',
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
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: '#737373',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Floating Action Buttons
  scrollFabContainer: {
    position: 'absolute',
    bottom: 82,
    right: 16,
    zIndex: 25,
  },
  scrollFab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },

  // Chat Input Bar: Paradev Floating Capsule
  chatInputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    zIndex: 30,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    minHeight: 52,
    maxHeight: 140,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  composerPlusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  composerPlusBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
  },
  composerTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#fafafa',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 120,
  },
  composerSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  composerStopBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
});

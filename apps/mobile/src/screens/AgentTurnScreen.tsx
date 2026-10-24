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
  GitPullRequest,
  FolderGit2,
  GitFork,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Search,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from '../components/MarkdownText';
import { ToolActionTray, type ActionStep } from '../components/ToolActionTray';

interface AgentTurnScreenProps {
  onBack?: () => void;
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

const DEFAULT_RESOLUTION_MARKDOWN = `Done — I fixed the merge conflicts and replied on the PR comment.

### What I changed
- Merged \`origin/main\` into your branch and resolved the conflict in:
\`/home/runner/work/abhishekkk.in/abhishekkk.in/src/components/sections/ProjectDossier.tsx\`
- Kept both sides' intended behavior (ASCII shark layout + \`ArchitecturePipeline\` integration).

### Additional fix (from required security check)
- CodeQL flagged a reflected XSS issue in:
\`/home/runner/work/abhishekkk.in/abhishekkk.in/src/app/api/spotify/callback/route.ts\`
- I fixed it and re-ran CodeQL; it now reports **0 alerts**.

### Commits
- \`9af270e\` — merge conflict resolution
- \`830b868\` — XSS safety fix in Spotify callback route

### Validation
- \`codeql_checker\`: clean (0 alerts)
- \`npm run lint\` could not run in this environment because \`next\` is not installed (sh: 1: next: not found).`;

export const AgentTurnScreen: React.FC<AgentTurnScreenProps> = ({ onBack, onNavigateTab }) => {
  const activeSession = useDaemonStore((s) => s.activeSession);
  const sessionMessages = useDaemonStore((s) => s.sessionMessages);
  const isSendingPrompt = useDaemonStore((s) => s.isSendingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const hasMoreMessages = useDaemonStore((s) => s.hasMoreMessages);
  const isLoadingOlderMessages = useDaemonStore((s) => s.isLoadingOlderMessages);
  const loadOlderMessages = useDaemonStore((s) => s.loadOlderMessages);

  const [promptInput, setPromptInput] = useState('');
  const [openTurnAccordions, setOpenTurnAccordions] = useState<Record<string, boolean>>({});
  const [selectedActionForTray, setSelectedActionForTray] = useState<ActionStep | null>(null);
  const scrollViewRef = useRef<any>(null);

  const isTurnOpen = (turnId: string) => openTurnAccordions[turnId] ?? true;

  const toggleTurnAccordion = (turnId: string) => {
    setOpenTurnAccordions((prev) => ({
      ...prev,
      [turnId]: !isTurnOpen(turnId),
    }));
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

  const titleStr = activeSession?.title || 'Resolving merge conflicts for ...';
  const repoName = activeSession?.workspaceName || 'Abhishekkk-15 / abhishekkk.in';
  const modelStr = activeSession?.model || 'gpt-5.3-c...';
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

  // Demo fallback turn for empty/initial demonstration sessions
  const demoFallbackTurns = useMemo<ChatTurn[]>(() => {
    return [
      {
        id: 'turn_demo_1',
        userMessage: {
          id: 'usr_demo_1',
          content: activeSession?.title || '@copilot please fix the merge conflicts in this pull request.',
          timestamp: activeSession?.createdAt,
        },
        assistant: {
          id: 'asst_demo_1',
          timestamp: activeSession?.createdAt,
          reasoning: 'I inspected git status, identified conflict markers in ProjectDossier.tsx and Spotify callback route, and formulated a resolution plan.',
          actions: [
            {
              id: 'step_clone',
              title: `Clone repository ${repoName.replace(' / ', '/')}`,
              category: 'repo',
              duration: '0.4s',
              hasDetails: true,
              toolName: 'git_clone',
              args: { repository: repoName, branch: 'patch-1', destination: '/workspace/project' },
              output: `Cloning into 'abhishekkk.in'...\nremote: Enumerating objects: 1204, done.\nResolving deltas: 100% (524/524), done in 0.4s.`,
              status: 'success',
              exitCode: 0,
            },
            {
              id: 'step_mcp_1',
              title: 'Connected to runtime-tools MCP Server',
              category: 'mcp',
              duration: '0.2s',
              hasDetails: true,
              toolName: 'mcp_connect',
              args: { server: 'runtime-tools', capabilities: ['bash', 'fs', 'git'] },
              output: 'Connected to runtime-tools (PID 14201). Initialized MCP tool server session.',
              status: 'success',
            },
            {
              id: 'step_branch_status',
              title: 'Check branch status and recent commits',
              category: 'terminal',
              hasDetails: true,
              toolName: 'run_command',
              args: { CommandLine: 'git status --porcelain && git log -n 5 --oneline' },
              output: `The command exited with code 0.\nOutput:\nUU src/components/sections/ProjectDossier.tsx\n9af270e merge conflict resolution\n830b868 XSS safety fix`,
              status: 'success',
              exitCode: 0,
            },
            {
              id: 'step_chore_outline',
              title: 'chore: outline merge conflict resolution',
              category: 'file',
              hasDetails: true,
              toolName: 'edit_file',
              args: { Path: '/workspace/src/components/sections/ProjectDossier.tsx' },
              output: 'Resolved 3 conflict markers in ProjectDossier.tsx. Merged ASCII layout with ArchitecturePipeline.',
              status: 'success',
            },
          ],
          content: DEFAULT_RESOLUTION_MARKDOWN,
        },
      },
    ];
  }, [activeSession, repoName]);

  const displayedTurns = chatTurns.length > 0 ? chatTurns : demoFallbackTurns;

  const renderActionIcon = (category: ActionStep['category']) => {
    switch (category) {
      case 'repo':
        return <FolderGit2 size={16} color="#58a6ff" />;
      case 'mcp':
        return <Link size={16} color="#58a6ff" />;
      case 'skill':
        return <GitFork size={16} color="#d2a8ff" />;
      case 'file':
        return <FileText size={16} color="#58a6ff" />;
      case 'search':
        return <Search size={16} color="#79c0ff" />;
      case 'terminal':
      default:
        return <Terminal size={16} color="#3fb950" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Navigation Bar */}
      <HeaderBar
        title={titleStr}
        subtitle={subtitleStr}
        onBack={onBack}
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
        {/* 2. Metadata Summary Row */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Created {timeAgoStr} <Text style={styles.metaDot}>•</Text> 1 session{' '}
            <Text style={styles.metaDot}>•</Text> 29.2 AI credits
          </Text>
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
                <ActivityIndicator size="small" color="#58a6ff" />
              ) : (
                <>
                  <ArrowUp size={13} color="#58a6ff" />
                  <Text style={styles.loadOlderText}>Load older messages</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Sequential Turn-by-Turn Timeline */}
        {displayedTurns.map((turn, turnIdx) => (
          <View key={turn.id || turnIdx} style={styles.turnCardContainer}>
            {/* User Prompt (if present in turn) */}
            {turn.userMessage?.content ? (
              <View style={styles.userCommentCard}>
                <View style={styles.userHeaderRow}>
                  <Text style={styles.userCommentHeader}>@Abhishekkk-15 commented:</Text>
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
                {/* Reasoning Box (if any) */}
                {turn.assistant.reasoning ? (
                  <View style={styles.reasoningBox}>
                    <View style={styles.reasoningHeader}>
                      <Sparkles size={11} color="#d2a8ff" />
                      <Text style={styles.reasoningTitle}>Reasoning</Text>
                    </View>
                    <Text style={styles.reasoningText} numberOfLines={8}>
                      {turn.assistant.reasoning}
                    </Text>
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
                        <View style={styles.greenCheckCircle}>
                          <Check size={12} color="#ffffff" />
                        </View>
                        <View style={styles.accordionTitleCol}>
                          <Text style={styles.accordionTitle} numberOfLines={1}>
                            {turn.assistant.actions[0]?.title || 'Executed turn actions'}
                          </Text>
                          <Text style={styles.accordionSubtitle}>
                            {turn.assistant.actions.length} action
                            {turn.assistant.actions.length > 1 ? 's' : ''}
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
                              {action.duration ? (
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
        ))}

        {/* 5. Streaming Live Indicator */}
        {isSendingPrompt && (
          <View style={styles.streamingIndicatorRow}>
            <ActivityIndicator size="small" color="#58a6ff" />
            <Text style={styles.streamingText}>Copilot is thinking and executing...</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Floating Action Buttons */}
      <View style={[styles.scrollFabContainer, { pointerEvents: 'box-none' }]}>
        <TouchableOpacity
          style={styles.scrollFab}
          activeOpacity={0.7}
          onPress={handleScrollToBottom}
        >
          <ArrowDown size={14} color="#8b949e" />
        </TouchableOpacity>
      </View>

      <View style={[styles.viewFabContainer, { pointerEvents: 'box-none' }]}>
        <TouchableOpacity
          style={styles.viewFab}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'View Pull Request',
              `Active branch/PR for ${repoName}\nStatus: Merge conflicts resolved.`,
              [{ text: 'OK' }]
            );
          }}
        >
          <GitPullRequest size={15} color="#ffffff" />
          <Text style={styles.viewFabText}>VIEW</Text>
        </TouchableOpacity>
      </View>

      {/* 7. Chat Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.chatInputBar}>
          <View style={styles.chatInputFieldContainer}>
            <TextInput
              style={styles.chatInputField}
              placeholder="Ask anything"
              placeholderTextColor="#6e7681"
              value={promptInput}
              onChangeText={setPromptInput}
              onSubmitEditing={handleSendPrompt}
              returnKeyType="send"
              editable={!isSendingPrompt}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.chatSendButton,
              (!promptInput.trim() || isSendingPrompt) && styles.chatSendButtonDisabled,
            ]}
            onPress={handleSendPrompt}
            activeOpacity={0.85}
            disabled={!promptInput.trim() || isSendingPrompt}
          >
            {isSendingPrompt ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 8. Draggable Tool Slide Tray */}
      <ToolActionTray
        visible={Boolean(selectedActionForTray)}
        action={selectedActionForTray}
        onClose={() => setSelectedActionForTray(null)}
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

  // Metadata summary row
  metaRow: {
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
  },
  metaDot: {
    color: '#484f58',
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
    color: colors.blue,
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
    backgroundColor: '#238636',
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

  // Reasoning process box
  reasoningBox: {
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: 'rgba(137, 87, 229, 0.4)',
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 10,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  reasoningTitle: {
    fontSize: 10.5,
    fontFamily: typography.mono,
    color: '#d2a8ff',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  reasoningText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#8b949e',
    fontStyle: 'italic',
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
    color: '#58a6ff',
    fontStyle: 'italic',
  },

  // Floating Action Buttons
  scrollFabContainer: {
    position: 'absolute',
    bottom: 58,
    left: '50%',
    marginLeft: -16,
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
  viewFabContainer: {
    position: 'absolute',
    bottom: 58,
    right: 16,
    zIndex: 20,
  },
  viewFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#238636',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  viewFabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  // Chat Input Bar
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161b22',
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    gap: 8,
  },
  chatInputFieldContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  chatInputField: {
    flex: 1,
    fontSize: 14,
    color: '#f0f6fc',
    padding: 0,
  },
  chatSendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1f6feb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
});

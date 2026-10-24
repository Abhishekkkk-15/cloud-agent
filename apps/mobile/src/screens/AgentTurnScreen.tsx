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
  Sparkles,
} from '../components/Icons';
import { radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from '../components/MarkdownText';

interface AgentTurnScreenProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface ActionStep {
  id: string;
  title: string;
  category: 'repo' | 'mcp' | 'skill' | 'terminal' | 'file';
  duration?: string;
  hasDetails?: boolean;
  details?: string;
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

  const [promptInput, setPromptInput] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const scrollViewRef = useRef<any>(null);

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

  // Extract initial operator prompt (first user turn or default)
  const initialUserPrompt = useMemo(() => {
    const firstUserMsg = sessionMessages.find((m) => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
      return firstUserMsg.content;
    }
    return activeSession?.title || '@copilot please fix the merge conflicts in this pull request.';
  }, [sessionMessages, activeSession]);

  // Subsequent conversation turns (excluding first user turn)
  const conversationTurns = useMemo(() => {
    let skippedFirstUser = false;
    return sessionMessages.filter((m) => {
      if (m.role === 'user' && !skippedFirstUser) {
        skippedFirstUser = true;
        return false;
      }
      return true;
    });
  }, [sessionMessages]);

  // Assemble the exact Stitch Copilot action steps list
  const actionSteps = useMemo<ActionStep[]>(() => {
    const steps: ActionStep[] = [
      {
        id: 'step_clone',
        title: `Clone repository ${repoName.replace(' / ', '/')}`,
        category: 'repo',
        duration: '0.4s',
        hasDetails: false,
      },
      {
        id: 'step_mcp_1',
        title: 'Connected to runtime-tools MCP Server',
        category: 'mcp',
        hasDetails: false,
      },
      {
        id: 'step_mcp_2',
        title: 'Connected to github-mcp-server MCP Server',
        category: 'mcp',
        hasDetails: false,
      },
      {
        id: 'step_mcp_3',
        title: 'Connected to playwright MCP Server',
        category: 'mcp',
        hasDetails: false,
      },
      {
        id: 'step_skill',
        title: 'Activate merge-branch skill',
        category: 'skill',
        hasDetails: true,
        details: 'Loaded agent skill: merge-branch with interactive 3-way resolution strategy.',
      },
      {
        id: 'step_branch_status',
        title: 'Check branch status and recent commits',
        category: 'terminal',
        hasDetails: true,
        details: 'git status --porcelain\ngit log -n 5 --oneline',
      },
      {
        id: 'step_discover',
        title: 'Discover default branch and shallow/ref state',
        category: 'terminal',
        hasDetails: true,
        details: 'git symbolic-ref refs/remotes/origin/HEAD\ngit rev-parse --is-shallow-repository',
      },
      {
        id: 'step_list_files',
        title: 'List files changed in recent commits',
        category: 'terminal',
        hasDetails: true,
        details: 'git diff --name-status origin/main...HEAD',
      },
      {
        id: 'step_chore_outline',
        title: 'chore: outline merge conflict resolution',
        category: 'file',
        hasDetails: true,
        details: 'Generated step-by-step resolution plan for divergent branches.',
      },
      {
        id: 'step_fetch_deepen',
        title: 'Fetch base branch and deepen until merge-ba...',
        category: 'terminal',
        hasDetails: true,
        details: 'git fetch --deepen=50 origin main\ngit merge-base HEAD origin/main',
      },
      {
        id: 'step_reply_comment',
        title: 'Call to Engine-tools-reply_to_comment',
        category: 'terminal',
        hasDetails: true,
        details: 'engine.tools.reply_to_comment({ pr: 12, body: "Resolved merge conflicts." })',
      },
    ];

    // Append any dynamic tool calls from this session
    sessionMessages.forEach((msg) => {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        msg.toolCalls.forEach((tc, idx) => {
          let category: ActionStep['category'] = 'terminal';
          if (tc.name.includes('file')) category = 'file';
          else if (tc.name.includes('mcp')) category = 'mcp';
          else if (tc.name.includes('subagent') || tc.name.includes('skill')) category = 'skill';

          steps.push({
            id: `dyn_${tc.id || idx}`,
            title: `Execute ${tc.name}`,
            category,
            hasDetails: true,
            details: typeof tc.arguments === 'object' ? JSON.stringify(tc.arguments, null, 2) : String(tc.arguments || ''),
          });
        });
      }
    });

    return steps;
  }, [repoName, sessionMessages]);

  const toggleActionDetails = (id: string) => {
    setExpandedActionId((curr) => (curr === id ? null : id));
  };

  const renderActionIcon = (category: ActionStep['category']) => {
    switch (category) {
      case 'repo':
        return <FolderGit2 size={16} color="#8b949e" />;
      case 'mcp':
        return <Link size={16} color="#8b949e" />;
      case 'skill':
        return <GitFork size={16} color="#8b949e" />;
      case 'file':
        return <FileText size={16} color="#8b949e" />;
      case 'terminal':
      default:
        return <Terminal size={16} color="#8b949e" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Navigation Bar (Identical to Stitch TopNavigationBar) */}
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
        {/* 2. Metadata Summary Row (Centered, text-xs text-[#8b949e]) */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Created {timeAgoStr} <Text style={styles.metaDot}>•</Text> 1 session{' '}
            <Text style={styles.metaDot}>•</Text> 29.2 AI credits
          </Text>
        </View>

        {/* 3. User Comment Card (bg-[#161b22] border border-[#21262d] rounded-xl p-3.5) */}
        <View style={styles.userCommentCard}>
          <Text style={styles.userCommentHeader}>@Abhishekkk-15 commented:</Text>
          <Text style={styles.userCommentBody}>{initialUserPrompt}</Text>
        </View>

        {/* 4. Copilot Action Summary Accordion (border-b border-[#21262d] pb-2 pt-1) */}
        <View style={styles.accordionSection}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsAccordionOpen(!isAccordionOpen)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionHeaderLeft}>
              {/* Green checkmark circle: w-5 h-5 rounded-full bg-[#238636] */}
              <View style={styles.greenCheckCircle}>
                <Check size={12} color="#ffffff" />
              </View>

              <View style={styles.accordionTitleCol}>
                <Text style={styles.accordionTitle} numberOfLines={1}>
                  Resolving merge conflicts for a...
                </Text>
                <Text style={styles.accordionSubtitle}>
                  {actionSteps.length} actions
                </Text>
              </View>
            </View>

            {/* Execution time & chevron */}
            <View style={styles.accordionHeaderRight}>
              <Text style={styles.accordionDuration}>4m 28s</Text>
              {isAccordionOpen ? (
                <ChevronUp size={16} color="#8b949e" />
              ) : (
                <ChevronDown size={16} color="#8b949e" />
              )}
            </View>
          </TouchableOpacity>

          {/* Action Step Rows (mt-2 divide-y divide-[#21262d]/50) */}
          {isAccordionOpen && (
            <View style={styles.actionStepsList}>
              {actionSteps.map((step) => {
                const isExpanded = expandedActionId === step.id;
                return (
                  <View key={step.id}>
                    <TouchableOpacity
                      style={styles.actionStepRow}
                      activeOpacity={step.hasDetails ? 0.7 : 1}
                      onPress={() => step.hasDetails && toggleActionDetails(step.id)}
                    >
                      <View style={styles.actionStepLeft}>
                        <View style={styles.actionStepIconBox}>
                          {renderActionIcon(step.category)}
                        </View>
                        <Text style={styles.actionStepText} numberOfLines={1}>
                          {step.title}
                        </Text>
                      </View>

                      {step.duration ? (
                        <Text style={styles.actionStepDuration}>{step.duration}</Text>
                      ) : (
                        <View style={styles.actionStepChevronBox}>
                          {isExpanded ? (
                            <ChevronDown size={16} color="#6e7681" />
                          ) : (
                            <ChevronRight size={16} color="#6e7681" />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Expandable action details drawer */}
                    {isExpanded && step.details ? (
                      <View style={styles.actionDetailsDrawer}>
                        <Text style={styles.actionDetailsText}>{step.details}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 5. Copilot Resolution Summary Body (Identical to Stitch copilot-resolution-body) */}
        {conversationTurns.length === 0 ? (
          <View style={styles.resolutionContainer}>
            <MarkdownText content={DEFAULT_RESOLUTION_MARKDOWN} isUser={false} />
          </View>
        ) : (
          <View style={styles.conversationContainer}>
            {conversationTurns.map((msg, idx) => {
              const isUser = msg.role === 'user';
              if (isUser) {
                return (
                  <View key={msg.id || idx} style={styles.userCommentCard}>
                    <Text style={styles.userCommentHeader}>@Abhishekkk-15 commented:</Text>
                    <Text style={styles.userCommentBody}>{msg.content}</Text>
                  </View>
                );
              }

              return (
                <View key={msg.id || idx} style={styles.resolutionTurn}>
                  {msg.reasoning ? (
                    <View style={styles.reasoningBox}>
                      <View style={styles.reasoningHeader}>
                        <Sparkles size={11} color="#d2a8ff" />
                        <Text style={styles.reasoningTitle}>Reasoning</Text>
                      </View>
                      <Text style={styles.reasoningText} numberOfLines={6}>
                        {msg.reasoning}
                      </Text>
                    </View>
                  ) : null}
                  <MarkdownText content={msg.content} isUser={false} />
                </View>
              );
            })}
          </View>
        )}

        {/* Streaming tokens indicator */}
        {isSendingPrompt && (
          <View style={styles.streamingIndicatorRow}>
            <ActivityIndicator size="small" color="#58a6ff" />
            <Text style={styles.streamingText}>Copilot is thinking and executing...</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Floating Action Buttons (Scroll to Bottom + Green VIEW button) */}
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

      {/* 7. Chat Input Bar (Identical to Stitch ChatInputBar) */}
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

  // Metadata summary row (pt-1 pb-1 text-center text-xs text-[#8b949e])
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

  // User Comment Card (bg-[#161b22] border border-[#21262d] rounded-xl p-3.5 shadow-sm)
  userCommentCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  userCommentHeader: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 6,
  },
  userCommentBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#f0f6fc',
  },

  // Copilot Action Summary Accordion (border-b border-[#21262d] pb-2 pt-1)
  accordionSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingBottom: 8,
    paddingTop: 4,
    marginBottom: 14,
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
  accordionDuration: {
    fontSize: 12,
    color: '#8b949e',
    fontFamily: typography.mono,
  },

  // Action Steps List (mt-2 divide-y divide-[#21262d]/50)
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
  actionDetailsDrawer: {
    backgroundColor: '#010409',
    marginVertical: 4,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  actionDetailsText: {
    fontFamily: typography.mono,
    fontSize: 11,
    lineHeight: 16,
    color: '#79c0ff',
  },

  // Resolution summary container
  resolutionContainer: {
    paddingTop: 2,
  },
  conversationContainer: {
    gap: 12,
  },
  resolutionTurn: {
    marginBottom: 8,
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
    bottom: 54,
    right: 16,
    zIndex: 20,
  },
  viewFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#238636',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  viewFabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Chat Input Bar (px-3 py-2 bg-[#0d1117] border-t border-[#21262d]/60)
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0d1117',
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 38, 45, 0.6)',
  },
  chatInputFieldContainer: {
    flex: 1,
    height: 40,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chatInputField: {
    fontSize: 14,
    color: '#f0f6fc',
    padding: 0,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f6feb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSendButtonDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.5,
  },
});

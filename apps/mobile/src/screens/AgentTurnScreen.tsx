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
  GitBranch,
  FileText,
  Bot,
  Send,
  GitPullRequest,
  FolderGit2,
  GitFork,
  ArrowDown,
  Sparkles,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
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
  hasDetails?: boolean;
  details?: string;
}

export const AgentTurnScreen: React.FC<AgentTurnScreenProps> = ({ onBack, onNavigateTab }) => {
  const activeSession = useDaemonStore((s) => s.activeSession);
  const sessionMessages = useDaemonStore((s) => s.sessionMessages);
  const isSendingPrompt = useDaemonStore((s) => s.isSendingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

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
  const repoName = activeSession?.workspaceName || 'Abhishekkk-15/abhishekkk.in';
  const modelStr = activeSession?.model || 'gpt-5.3-codex';
  const subtitleStr = `${repoName} • ${modelStr}`;
  const timeAgoStr = formatTimeAgo(activeSession?.createdAt);

  // Extract initial operator prompt (first user turn or title)
  const initialUserPrompt = useMemo(() => {
    const firstUserMsg = sessionMessages.find((m) => m.role === 'user');
    if (firstUserMsg && firstUserMsg.content) {
      return firstUserMsg.content;
    }
    return activeSession?.title || '@copilot please fix the merge conflicts in this pull request.';
  }, [sessionMessages, activeSession]);

  // Subsequent conversation turns (excluding first turn if displayed on top)
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

  // Dynamically assemble GitHub Copilot action steps matching the screenshot
  const actionSteps = useMemo<ActionStep[]>(() => {
    const steps: ActionStep[] = [
      {
        id: 'step_clone',
        title: `Clone repository ${repoName}`,
        category: 'repo',
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
        return <FolderGit2 size={16} color="#8d96a0" />;
      case 'mcp':
        return <Link size={16} color="#8d96a0" />;
      case 'skill':
        return <GitFork size={16} color="#8d96a0" />;
      case 'file':
        return <FileText size={16} color="#8d96a0" />;
      case 'terminal':
      default:
        return <Terminal size={16} color="#8d96a0" />;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Bar with Back, Title, Subtitle, and Blue 3-Dots */}
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
        {/* 2. Sub-header Meta Line (Matching GitHub Copilot screenshot) */}
        <Text style={styles.metaLineText}>
          Created {timeAgoStr} · 1 session · 29.2 AI credits
        </Text>

        {/* 3. Operator Comment Card (Matching GitHub Copilot screenshot) */}
        <View style={styles.commentCard}>
          <Text style={styles.commentHeader}>@Abhishekkk-15 commented:</Text>
          <Text style={styles.commentBody}>{initialUserPrompt}</Text>
        </View>

        {/* 4. Collapsible Resolution Progress Accordion */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsAccordionOpen(!isAccordionOpen)}
            activeOpacity={0.7}
          >
            {/* Green Filled Check Circle */}
            <View style={styles.greenCheckCircle}>
              <Check size={12} color="#ffffff" />
            </View>

            <View style={styles.accordionTitleCol}>
              <Text style={styles.accordionTitle} numberOfLines={1}>
                {titleStr}
              </Text>
              <Text style={styles.accordionSubtitle}>
                {actionSteps.length} actions
              </Text>
            </View>

            <View style={styles.accordionRightCol}>
              <Text style={styles.accordionDuration}>4m 28s</Text>
              {isAccordionOpen ? (
                <ChevronUp size={18} color="#8d96a0" />
              ) : (
                <ChevronDown size={18} color="#8d96a0" />
              )}
            </View>
          </TouchableOpacity>

          {/* Action Steps List (Expanded) */}
          {isAccordionOpen && (
            <View style={styles.actionsList}>
              <View style={styles.divider} />
              {actionSteps.map((step) => {
                const isExpanded = expandedActionId === step.id;
                return (
                  <View key={step.id}>
                    <TouchableOpacity
                      style={styles.actionRow}
                      activeOpacity={step.hasDetails ? 0.7 : 1}
                      onPress={() => step.hasDetails && toggleActionDetails(step.id)}
                    >
                      <View style={styles.actionLeftGroup}>
                        <View style={styles.actionIconBox}>
                          {renderActionIcon(step.category)}
                        </View>
                        <Text style={styles.actionText} numberOfLines={1}>
                          {step.title}
                        </Text>
                      </View>
                      {step.hasDetails && (
                        <View style={styles.actionRightIcon}>
                          {isExpanded ? (
                            <ChevronDown size={16} color="#8d96a0" />
                          ) : (
                            <ChevronRight size={16} color="#8d96a0" />
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

        {/* 5. Additional Conversation Turns / Responses */}
        {conversationTurns.length > 0 && (
          <View style={styles.conversationSection}>
            {conversationTurns.map((msg, idx) => {
              const isUser = msg.role === 'user';
              if (isUser) {
                return (
                  <View key={msg.id || idx} style={styles.commentCard}>
                    <Text style={styles.commentHeader}>@Abhishekkk-15 commented:</Text>
                    <Text style={styles.commentBody}>{msg.content}</Text>
                  </View>
                );
              }

              return (
                <View key={msg.id || idx} style={styles.assistantCard}>
                  <View style={styles.assistantHeaderRow}>
                    <View style={styles.botIconBadge}>
                      <Bot size={13} color="#3fb950" />
                    </View>
                    <Text style={styles.assistantRoleLabel}>Copilot</Text>
                  </View>

                  {/* Reasoning Process if present */}
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

                  {/* Markdown Body */}
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

      {/* 6. Floating Action Buttons (Green VIEW PR pill + Scroll-to-bottom circle) */}
      <View style={styles.fabOverlay}>
        <TouchableOpacity
          style={styles.viewFab}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'View Pull Request',
              `Active branch/PR for ${repoName}\nStatus: Resolution in progress.`,
              [{ text: 'OK' }]
            );
          }}
        >
          <GitPullRequest size={15} color="#ffffff" />
          <Text style={styles.viewFabText}>VIEW</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scrollFab}
          activeOpacity={0.7}
          onPress={handleScrollToBottom}
        >
          <ArrowDown size={16} color="#c9d1d9" />
        </TouchableOpacity>
      </View>

      {/* 7. Bottom Input Bar (Capsule Ask anything + Blue Circular Send Button) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.bottomBar}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.inputField}
              placeholder="Ask anything"
              placeholderTextColor="#8d96a0"
              value={promptInput}
              onChangeText={setPromptInput}
              onSubmitEditing={handleSendPrompt}
              returnKeyType="send"
              editable={!isSendingPrompt}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendCircle,
              (!promptInput.trim() || isSendingPrompt) && styles.sendCircleDisabled,
            ]}
            onPress={handleSendPrompt}
            activeOpacity={0.8}
            disabled={!promptInput.trim() || isSendingPrompt}
          >
            {isSendingPrompt ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Send size={18} color="#ffffff" />
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
    paddingTop: 12,
    paddingBottom: 90,
  },

  // Sub-header meta line
  metaLineText: {
    fontSize: 13,
    color: '#8d96a0',
    marginBottom: 16,
  },

  // Operator Comment Card
  commentCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  commentHeader: {
    fontSize: 13.5,
    color: '#8d96a0',
    marginBottom: 8,
  },
  commentBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#f0f6fc',
  },

  // Accordion Card
  accordionCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  greenCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#238636',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accordionTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  accordionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  accordionSubtitle: {
    fontSize: 13,
    color: '#8d96a0',
    marginTop: 2,
  },
  accordionRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionDuration: {
    fontSize: 13,
    color: '#8d96a0',
    fontFamily: typography.mono,
  },
  divider: {
    height: 1,
    backgroundColor: '#30363d',
  },

  // Action Steps List
  actionsList: {
    paddingBottom: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  actionLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  actionIconBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13.5,
    color: '#c9d1d9',
    flex: 1,
  },
  actionRightIcon: {
    width: 16,
    alignItems: 'center',
  },
  actionDetailsDrawer: {
    backgroundColor: '#010409',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  actionDetailsText: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#79c0ff',
  },

  // Conversation turns
  conversationSection: {
    marginTop: 4,
    gap: 16,
  },
  assistantCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 14,
    padding: 16,
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  botIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(35, 134, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantRoleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3fb950',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
    color: '#8d96a0',
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

  // Floating Action Buttons (VIEW PR & Scroll Down)
  fabOverlay: {
    position: 'absolute',
    right: 16,
    bottom: 74,
    alignItems: 'center',
    gap: 10,
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
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  viewFabText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  scrollFab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // Bottom Input Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0d1117',
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  inputPill: {
    flex: 1,
    height: 48,
    backgroundColor: '#21262d',
    borderRadius: 24,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  inputField: {
    fontSize: 15,
    color: '#f0f6fc',
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f6feb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
});

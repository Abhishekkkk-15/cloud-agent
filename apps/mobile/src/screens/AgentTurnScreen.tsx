import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
  Link,
  GitBranch,
  FileText,
  Bot,
  GitMerge,
  Paperclip,
  Mic,
  ArrowUp,
  ShieldCheck,
  GitCommit,
  User,
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

export const AgentTurnScreen: React.FC<AgentTurnScreenProps> = ({ onBack, onNavigateTab }) => {
  const activeSession = useDaemonStore((s) => s.activeSession);
  const sessionMessages = useDaemonStore((s) => s.sessionMessages);
  const isSendingPrompt = useDaemonStore((s) => s.isSendingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  const [promptInput, setPromptInput] = useState('');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
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

  const titleStr = activeSession?.title || 'Interactive Agent Workspace';
  const subtitleStr = activeSession
    ? `${activeSession.workspaceName} • ${activeSession.model || 'Antigravity'}`
    : `${activeMachine?.name || 'DESKTOP-BJI38IC'} • Zero-Trust Tunnel`;

  return (
    <View style={styles.container}>
      <HeaderBar
        title={titleStr}
        subtitle={subtitleStr}
        onBack={onBack}
        onMore={() => {}}
      />

      {/* Sub-bar session meta */}
      <View style={styles.subBar}>
        <Text style={styles.subBarText}>
          {activeSession ? `Session ${activeSession.id.slice(0, 8)} • ${activeSession.messageCount} messages` : 'Connected to Antigravity CLI daemon'}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Prompt / Session Initial Request Card */}
        {activeSession?.title ? (
          <View style={styles.userCard}>
            <Text style={styles.userCommentLabel}>@operator initial prompt:</Text>
            <Text style={styles.userCommentText}>
              {activeSession.title}
            </Text>
          </View>
        ) : null}

        {/* Collapsible Resolution Progress Accordion */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsTimelineExpanded(!isTimelineExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionHeaderLeft}>
              <View style={styles.checkBadge}>
                <Check size={12} color="#ffffff" />
              </View>
              <View style={styles.accordionTitles}>
                <Text style={styles.accordionMainTitle} numberOfLines={1}>
                  {titleStr}
                </Text>
                <Text style={styles.accordionSubTitle}>
                  {sessionMessages.length > 0 ? `${sessionMessages.length} turns recorded` : `${activeSession?.messageCount || 0} transcript events`}
                </Text>
              </View>
            </View>
            <View style={styles.accordionHeaderRight}>
              <Text style={styles.accordionDuration}>Live Turn</Text>
              {isTimelineExpanded ? (
                <ChevronUp size={16} color={colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={colors.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {isTimelineExpanded && (
            <View style={styles.timelineList}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineItemLeft}>
                  <Terminal size={14} color={colors.textMuted} />
                  <Text style={styles.timelineItemText}>
                    Attached to workspace <Text style={{ color: colors.textPrimary }}>{activeSession?.workspacePath || '.'}</Text>
                  </Text>
                </View>
                <Check size={14} color={colors.green} />
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineItemLeft}>
                  <Link size={14} color={colors.blue} />
                  <Text style={styles.timelineItemText}>
                    Connected to <Text style={{ color: colors.blue }}>Antigravity CLI</Text> runtime
                  </Text>
                </View>
                <Check size={14} color={colors.green} />
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineItemLeft}>
                  <GitBranch size={14} color={colors.purple} />
                  <Text style={styles.timelineItemText}>
                    WebRTC P2P DataChannel open
                  </Text>
                </View>
                <Check size={14} color={colors.green} />
              </View>
            </View>
          )}
        </View>

        {/* Real Message Turns from Antigravity Transcript */}
        {sessionMessages.length > 0 ? (
          <View style={styles.messagesSection}>
            <Text style={styles.sectionHeading}>Session Conversation</Text>
            {sessionMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={msg.id || idx}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <View style={styles.messageHeader}>
                    {isUser ? (
                      <User size={13} color="#ffffff" />
                    ) : (
                      <Bot size={13} color={colors.green} />
                    )}
                    <Text
                      style={[
                        styles.messageRoleText,
                        isUser ? { color: '#ffffff' } : { color: colors.green },
                      ]}
                    >
                      {isUser ? 'Operator' : 'Antigravity'}
                    </Text>
                  </View>
                  {/* Reasoning if present */}
                  {msg.reasoning ? (
                    <View style={styles.reasoningBox}>
                      <View style={styles.reasoningHeader}>
                        <Sparkles size={11} color={colors.purple} />
                        <Text style={styles.reasoningTitle}>Reasoning</Text>
                      </View>
                      <Text style={styles.reasoningText} numberOfLines={6}>
                        {msg.reasoning}
                      </Text>
                    </View>
                  ) : null}

                  {/* Markdown Parsed Message Body */}
                  <MarkdownText content={msg.content} isUser={isUser} />

                  {/* Tool Calls if any */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <View style={styles.toolCallsBox}>
                      {msg.toolCalls.map((tc, tcIdx) => (
                        <View key={tc.id || tcIdx} style={styles.toolCallItem}>
                          <Terminal size={11} color={colors.blue} />
                          <Text style={styles.toolCallName}>
                            tool:{tc.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          /* Clean Turn Breakdown when transcript messages are loading or session newly started */
          <View style={styles.explanationSection}>
            <View style={styles.completionBanner}>
              <View style={styles.botIconCircle}>
                <Bot size={15} color={colors.green} />
              </View>
              <Text style={styles.completionText}>
                {activeSession
                  ? `Active session ${activeSession.id.slice(0, 8)} loaded from host transcripts.`
                  : 'Connected to live Antigravity execution daemon.'}
              </Text>
            </View>

            <Text style={styles.sectionHeading}>Workspace Attached</Text>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <View style={styles.bulletContent}>
                <Text style={styles.bulletText}>
                  Path: <Text style={styles.inlineCode}>{activeSession?.workspacePath || '.'}</Text>
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionHeading, { marginTop: 14 }]}>Zero-Trust Transport</Text>
            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <View style={styles.bulletContent}>
                <Text style={styles.bulletText}>
                  Tunnel: <Text style={{ color: colors.green, fontWeight: '700' }}>WebRTC DataChannel (Direct P2P)</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Streaming / sending indicator */}
        {isSendingPrompt && (
          <View style={styles.loadingTurnRow}>
            <ActivityIndicator size="small" color={colors.blue} />
            <Text style={styles.loadingTurnText}>Streaming tokens from Daemon...</Text>
          </View>
        )}

        {/* Workspace Info Action Button */}
        <View style={styles.prButtonRow}>
          <TouchableOpacity
            style={styles.viewPrButton}
            onPress={() => onNavigateTab && onNavigateTab('sessions')}
            activeOpacity={0.8}
          >
            <GitMerge size={15} color="#ffffff" />
            <Text style={styles.viewPrButtonText}>BROWSE ALL SESSIONS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Floating Input Bar */}
      <View style={styles.bottomBarWrapper}>
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => Alert.alert('Attachment', 'Select local file or repo artifact to attach.')}
            activeOpacity={0.7}
          >
            <Paperclip size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Ask anything"
            placeholderTextColor={colors.textMuted}
            value={promptInput}
            onChangeText={setPromptInput}
            onSubmitEditing={handleSendPrompt}
            returnKeyType="send"
            editable={!isSendingPrompt}
          />

          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => Alert.alert('Voice Input', 'Listening for speech input...')}
            activeOpacity={0.7}
          >
            <Mic size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, isSendingPrompt && { opacity: 0.5 }]}
            onPress={handleSendPrompt}
            activeOpacity={0.7}
            disabled={isSendingPrompt}
          >
            {isSendingPrompt ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <ArrowUp size={16} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  subBar: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBarText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  userCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 12,
  },
  userCommentLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  userCommentText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  accordionContainer: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 16,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitles: {
    flex: 1,
  },
  accordionMainTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  accordionSubTitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  accordionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accordionDuration: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  timelineList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    paddingVertical: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timelineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timelineItemText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  messagesSection: {
    marginBottom: 16,
    gap: 10,
  },
  messageBubble: {
    padding: 12,
    borderRadius: radii.xl,
    maxWidth: '92%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.blueBg,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  messageRoleText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  messageBodyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  reasoningBox: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
    borderRadius: radii.md,
    padding: 8,
    marginBottom: 8,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  reasoningTitle: {
    fontSize: 10,
    fontFamily: typography.mono,
    color: colors.purple,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  reasoningText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  toolCallsBox: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    gap: 4,
  },
  toolCallItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolCallName: {
    fontSize: 11,
    fontFamily: typography.mono,
    color: colors.blue,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  botIconCircle: {
    width: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  explanationSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  bulletItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  bulletDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  bulletContent: {
    flex: 1,
  },
  bulletText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inlineCode: {
    backgroundColor: colors.bgHover,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.xs,
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  loadingTurnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 12,
  },
  loadingTurnText: {
    fontSize: 12,
    color: colors.blue,
    fontStyle: 'italic',
  },
  prButtonRow: {
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 16,
  },
  viewPrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  viewPrButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  inputIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

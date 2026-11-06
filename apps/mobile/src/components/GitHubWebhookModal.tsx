import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Key,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  GitPullRequest,
  ExternalLink,
  ShieldAlert,
} from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

interface GitHubWebhookModalProps {
  visible: boolean;
  onClose: () => void;
}

export const GitHubWebhookModal: React.FC<GitHubWebhookModalProps> = ({
  visible,
  onClose,
}) => {
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const githubStatus = useDaemonStore((s) => s.githubStatus);
  const isCheckingGithub = useDaemonStore((s) => s.isCheckingGithub);
  const isSavingGithubToken = useDaemonStore((s) => s.isSavingGithubToken);
  const fetchGithubStatus = useDaemonStore((s) => s.fetchGithubStatus);
  const saveGithubToken = useDaemonStore((s) => s.saveGithubToken);
  const removeGithubToken = useDaemonStore((s) => s.removeGithubToken);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [tokenInput, setTokenInput] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedGithub, setCopiedGithub] = useState(false);
  const [copiedSentry, setCopiedSentry] = useState(false);
  const [activeTab, setActiveTab] = useState<'pat' | 'webhooks'>('pat');

  const machineId = activeMachine?.machineId || 'your-machine-id';
  const cleanGatewayUrl = gatewayUrl.replace(/\/+$/, '');
  const githubWebhookUrl = `${cleanGatewayUrl}/webhooks/github/${machineId}`;
  const sentryWebhookUrl = `${cleanGatewayUrl}/webhooks/sentry/${machineId}`;

  useEffect(() => {
    if (visible) {
      fetchGithubStatus().catch(() => {});
      setSaveFeedback(null);
      setTokenInput('');
    }
  }, [visible]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setSaveFeedback({ type: 'error', text: 'Please enter a valid GitHub token (e.g. ghp_...)' });
      return;
    }
    setSaveFeedback(null);
    const res = await saveGithubToken(tokenInput.trim());
    if (res.success) {
      setTokenInput('');
      setSaveFeedback({
        type: 'success',
        text: `Successfully authenticated as @${res.username}!`,
      });
    } else {
      setSaveFeedback({
        type: 'error',
        text: res.error || 'Failed to verify GitHub token',
      });
    }
  };

  const handleDisconnect = async () => {
    await removeGithubToken();
    setSaveFeedback(null);
  };

  const handleCopyGithubWebhook = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(githubWebhookUrl).catch(() => {});
    }
    setCopiedGithub(true);
    setTimeout(() => setCopiedGithub(false), 2000);
  };

  const handleCopySentryWebhook = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sentryWebhookUrl).catch(() => {});
    }
    setCopiedSentry(true);
    setTimeout(() => setCopiedSentry(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContent, isLight && styles.modalContentLight]}>
              {/* Header */}
              <View style={[styles.header, isLight && styles.headerLight]}>
                <View style={styles.headerTitleRow}>
                  <Key size={18} color={isLight ? '#0077b6' : '#fafafa'} />
                  <Text style={[styles.headerTitle, isLight && styles.headerTitleLight]}>GitHub Credentials & Webhooks</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, isLight && styles.closeBtnLight]} activeOpacity={0.7}>
                  <X size={18} color={isLight ? '#57606a' : '#a3a3a3'} />
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={[styles.tabRow, isLight && styles.tabRowLight]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'pat' && (isLight ? styles.tabButtonActiveLight : styles.tabButtonActive)
                  ]}
                  onPress={() => setActiveTab('pat')}
                  activeOpacity={0.7}
                >
                  <Key size={13} color={activeTab === 'pat' ? (isLight ? '#0077b6' : '#fafafa') : (isLight ? '#6e7681' : '#a3a3a3')} />
                  <Text style={[
                    styles.tabButtonText,
                    isLight && { color: '#6e7681' },
                    activeTab === 'pat' && (isLight ? styles.tabButtonTextActiveLight : styles.tabButtonTextActive)
                  ]}>
                    GitHub PAT (Option B)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'webhooks' && (isLight ? styles.tabButtonActiveLight : styles.tabButtonActive)
                  ]}
                  onPress={() => setActiveTab('webhooks')}
                  activeOpacity={0.7}
                >
                  <GitPullRequest size={13} color={activeTab === 'webhooks' ? (isLight ? '#0077b6' : '#fafafa') : (isLight ? '#6e7681' : '#a3a3a3')} />
                  <Text style={[
                    styles.tabButtonText,
                    isLight && { color: '#6e7681' },
                    activeTab === 'webhooks' && (isLight ? styles.tabButtonTextActiveLight : styles.tabButtonTextActive)
                  ]}>
                    Webhook URLs
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={[styles.scroll, isLight && { backgroundColor: '#ffffff' }]}
                contentContainerStyle={styles.scrollContent}
              >
                {activeTab === 'pat' ? (
                  /* Option B: Personal Access Token Section */
                  <View style={styles.section}>
                    {/* Status Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>CURRENT AUTHENTICATION</Text>
                        <TouchableOpacity
                          onPress={() => fetchGithubStatus()}
                          disabled={isCheckingGithub}
                          style={styles.refreshIconBtn}
                          activeOpacity={0.7}
                        >
                          <RefreshCw
                            size={12}
                            color={isLight ? '#57606a' : '#a3a3a3'}
                            style={isCheckingGithub ? { transform: [{ rotate: '45deg' }] } : undefined}
                          />
                        </TouchableOpacity>
                      </View>

                      {isCheckingGithub ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                          <Text style={[styles.loadingText, isLight && { color: '#6e7681' }]}>Checking GitHub credentials on host...</Text>
                        </View>
                      ) : githubStatus?.authenticated ? (
                        <View style={styles.authSuccessBox}>
                          <View style={styles.authSuccessLeft}>
                            <CheckCircle2 size={16} color="#2ea043" />
                            <View>
                              <Text style={[styles.authUsername, isLight && { color: '#1f2328' }]}>
                                @{githubStatus.username || 'Authenticated'}
                              </Text>
                              <Text style={[styles.authSource, isLight && { color: '#57606a' }]}>
                                {githubStatus.source === 'token'
                                  ? 'Personal Access Token (Option B)'
                                  : 'Host GitHub CLI session'}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[styles.disconnectBtn, isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de' }]}
                            onPress={handleDisconnect}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.disconnectBtnText, isLight && { color: '#57606a' }]}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={[styles.authStandbyBox, isLight && styles.authStandbyBoxLight]}>
                          <ShieldAlert size={16} color={isLight ? '#0077b6' : '#a3a3a3'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.authStandbyTitle, isLight && styles.authStandbyTitleLight]}>No GitHub Token Configured</Text>
                            <Text style={[styles.authStandbySub, isLight && styles.authStandbySubLight]}>
                              Add a Personal Access Token below so the daemon can push branches, create PRs, and post code reviews.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Token Input Card */}
                    <View style={[styles.card, isLight && styles.cardLight, { marginTop: 12 }]}>
                      <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>CONFIGURE PERSONAL ACCESS TOKEN</Text>
                      <Text style={[styles.tokenHint, isLight && { color: '#57606a' }]}>
                        Create a classic PAT with <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '700' }}>repo</Text> scope at GitHub → Settings → Developer Settings → Personal access tokens.
                      </Text>

                      <View style={[styles.inputContainer, isLight && styles.inputContainerLight]}>
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          placeholderTextColor={isLight ? '#8c959f' : '#737373'}
                          value={tokenInput}
                          onChangeText={setTokenInput}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>

                      {saveFeedback && (
                        <View
                          style={[
                            styles.feedbackBox,
                            saveFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                          ]}
                        >
                          {saveFeedback.type === 'success' ? (
                            <CheckCircle2 size={13} color="#2ea043" />
                          ) : (
                            <XCircle size={13} color="#f85149" />
                          )}
                          <Text
                            style={[
                              styles.feedbackText,
                              saveFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
                              isLight && saveFeedback.type === 'success' && { color: '#1f2328' },
                            ]}
                          >
                            {saveFeedback.text}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.saveBtn,
                          isLight && styles.saveBtnLight,
                          isSavingGithubToken && { opacity: 0.7 }
                        ]}
                        onPress={handleSaveToken}
                        disabled={isSavingGithubToken}
                        activeOpacity={0.7}
                      >
                        {isSavingGithubToken ? (
                          <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#0a0a0a'} />
                        ) : (
                          <>
                            <Key size={14} color={isLight ? '#ffffff' : '#0a0a0a'} />
                            <Text style={[styles.saveBtnText, isLight && { color: '#ffffff' }]}>Verify & Save Token</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Terminal Alternative Instructions */}
                    <View style={[styles.card, isLight && styles.cardLight, { marginTop: 12, backgroundColor: isLight ? '#f6f8fa' : '#121212' }]}>
                      <Text style={[styles.cardSectionLabel, isLight ? { color: '#6e7681' } : { color: '#737373' }]}>
                        OR EXPORT IN TERMINAL
                      </Text>
                      <Text style={[styles.codeText, isLight && { color: '#1f2328' }]}>
                        export GITHUB_TOKEN="ghp_xxx"
                      </Text>
                      <Text style={[styles.codeText, isLight && { color: '#6e7681' }, { marginTop: 4 }]}>
                        # Stored in ~/.cloud-agent/daemon.json
                      </Text>
                    </View>
                  </View>
                ) : (
                  /* Webhook URLs Section */
                  <View style={styles.section}>
                    {/* GitHub Webhook Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>GITHUB REPOSITORY WEBHOOK</Text>
                      </View>

                      <Text style={[styles.webhookIntro, isLight && { color: '#57606a' }]}>
                        Add this URL to your GitHub repository to trigger autonomous on-call auto-healing and pull request reviews:
                      </Text>

                      <View style={[styles.urlBox, isLight && styles.urlBoxLight]}>
                        <Text style={[styles.urlText, isLight && styles.urlTextLight]} numberOfLines={2}>
                          {githubWebhookUrl}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.copyBtn,
                            isLight && styles.copyBtnLight,
                            copiedGithub && styles.copyBtnDone
                          ]}
                          onPress={handleCopyGithubWebhook}
                          activeOpacity={0.7}
                        >
                          {copiedGithub ? (
                            <>
                              <Check size={12} color="#2ea043" />
                              <Text style={[styles.copyBtnText, { color: '#2ea043' }]}>Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color={isLight ? '#0077b6' : '#fafafa'} />
                              <Text style={[styles.copyBtnText, isLight && { color: '#0077b6' }]}>Copy URL</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* GitHub Setup Instructions Checklist */}
                      <View style={[styles.checklist, isLight && styles.checklistLight]}>
                        <Text style={[styles.checkTitle, isLight && styles.checkTitleLight]}>Setup in GitHub Repository:</Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>1. Go to repo <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Settings → Webhooks → Add webhook</Text></Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>2. Payload URL: <Text style={{ color: isLight ? '#1f2328' : '#fafafa' }}>Paste URL above</Text></Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>3. Content type: <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '700' }}>application/json</Text></Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>4. Events: Check <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Pull requests</Text> and <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Issues</Text></Text>
                      </View>
                    </View>

                    {/* Sentry Webhook Card */}
                    <View style={[styles.card, isLight && styles.cardLight, { marginTop: 12 }]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>SENTRY CRASH WEBHOOK</Text>
                      </View>
                      <Text style={[styles.webhookIntro, isLight && { color: '#57606a' }]}>
                        Posts error stack traces and culprits to trigger automated on-call code fixes:
                      </Text>

                      <View style={[styles.urlBox, isLight && styles.urlBoxLight]}>
                        <Text style={[styles.urlText, isLight && styles.urlTextLight]} numberOfLines={2}>
                          {sentryWebhookUrl}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.copyBtn,
                            isLight && styles.copyBtnLight,
                            copiedSentry && styles.copyBtnDone
                          ]}
                          onPress={handleCopySentryWebhook}
                          activeOpacity={0.7}
                        >
                          {copiedSentry ? (
                            <>
                              <Check size={12} color="#2ea043" />
                              <Text style={[styles.copyBtnText, { color: '#2ea043' }]}>Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color={isLight ? '#0077b6' : '#fafafa'} />
                              <Text style={[styles.copyBtnText, isLight && { color: '#0077b6' }]}>Copy URL</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: '#161616',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#262626',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#0a0a0a',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#fafafa',
  },
  tabButtonText: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#fafafa',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    gap: 4,
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 14,
  },
  cardSectionLabel: {
    color: '#a3a3a3',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  refreshIconBtn: {
    padding: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  authSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(63, 185, 80, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(63, 185, 80, 0.25)',
    borderRadius: 8,
    padding: 10,
  },
  authSuccessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authUsername: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '700',
  },
  authSource: {
    color: '#a3a3a3',
    fontSize: 11,
    marginTop: 1,
  },
  disconnectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  disconnectBtnText: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '600',
  },
  authStandbyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 148, 158, 0.08)',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 10,
  },
  authStandbyTitle: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '600',
  },
  authStandbySub: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  tokenHint: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    color: '#fafafa',
    fontSize: 13,
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  saveBtnText: {
    color: '#0a0a0a',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(63, 185, 80, 0.1)',
    borderColor: 'rgba(63, 185, 80, 0.3)',
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  feedbackText: {
    fontSize: 12,
    flex: 1,
  },
  feedbackSuccessText: {
    color: '#fafafa',
  },
  feedbackErrorText: {
    color: '#f85149',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d4',
    fontSize: 11,
    marginTop: 6,
  },
  webhookIntro: {
    color: '#a3a3a3',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  urlText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#fafafa',
    fontSize: 11,
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  copyBtnDone: {
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    borderColor: 'rgba(63, 185, 80, 0.35)',
  },
  copyBtnText: {
    color: '#fafafa',
    fontSize: 11,
    fontWeight: '600',
  },
  checklist: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 4,
  },
  checkTitle: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  checkItem: {
    color: '#a3a3a3',
    fontSize: 11,
    lineHeight: 16,
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  headerTitleLight: {
    color: '#1f2328',
  },
  closeBtnLight: {
    backgroundColor: '#e1e4e8',
  },
  tabRowLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  tabButtonActiveLight: {
    borderBottomColor: '#0077b6',
  },
  tabButtonTextActiveLight: {
    color: '#0077b6',
  },
  cardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  cardSectionLabelLight: {
    color: '#6e7681',
  },
  authStandbyBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  authStandbyTitleLight: {
    color: '#1f2328',
  },
  authStandbySubLight: {
    color: '#57606a',
  },
  inputContainerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  textInputLight: {
    color: '#1f2328',
  },
  saveBtnLight: {
    backgroundColor: '#0077b6',
  },
  urlBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  urlTextLight: {
    color: '#1f2328',
  },
  copyBtnLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  checklistLight: {
    borderTopColor: '#d0d7de',
  },
  checkTitleLight: {
    color: '#1f2328',
  },
});

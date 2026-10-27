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
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Key size={18} color="#0077b6" />
                  <Text style={styles.headerTitle}>GitHub Credentials & Webhooks</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <X size={18} color="#8b949e" />
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'pat' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('pat')}
                  activeOpacity={0.7}
                >
                  <Key size={13} color={activeTab === 'pat' ? '#0077b6' : '#8b949e'} />
                  <Text style={[styles.tabButtonText, activeTab === 'pat' && styles.tabButtonTextActive]}>
                    GitHub PAT (Option B)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, activeTab === 'webhooks' && styles.tabButtonActive]}
                  onPress={() => setActiveTab('webhooks')}
                  activeOpacity={0.7}
                >
                  <GitPullRequest size={13} color={activeTab === 'webhooks' ? '#0077b6' : '#8b949e'} />
                  <Text style={[styles.tabButtonText, activeTab === 'webhooks' && styles.tabButtonTextActive]}>
                    Webhook URLs
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'pat' ? (
                  /* Option B: Personal Access Token Section */
                  <View style={styles.section}>
                    {/* Status Card */}
                    <View style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardSectionLabel}>CURRENT AUTHENTICATION</Text>
                        <TouchableOpacity
                          onPress={() => fetchGithubStatus()}
                          disabled={isCheckingGithub}
                          style={styles.refreshIconBtn}
                          activeOpacity={0.7}
                        >
                          <RefreshCw
                            size={12}
                            color="#8b949e"
                            style={isCheckingGithub ? { transform: [{ rotate: '45deg' }] } : undefined}
                          />
                        </TouchableOpacity>
                      </View>

                      {isCheckingGithub ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator size="small" color="#0077b6" />
                          <Text style={styles.loadingText}>Checking GitHub credentials on host...</Text>
                        </View>
                      ) : githubStatus?.authenticated ? (
                        <View style={styles.authSuccessBox}>
                          <View style={styles.authSuccessLeft}>
                            <CheckCircle2 size={16} color="#3fb950" />
                            <View>
                              <Text style={styles.authUsername}>
                                @{githubStatus.username || 'Authenticated'}
                              </Text>
                              <Text style={styles.authSource}>
                                {githubStatus.source === 'token'
                                  ? 'Personal Access Token (Option B)'
                                  : 'Host GitHub CLI session'}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.disconnectBtn}
                            onPress={handleDisconnect}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.disconnectBtnText}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.authStandbyBox}>
                          <ShieldAlert size={16} color="#8b949e" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.authStandbyTitle}>No GitHub Token Configured</Text>
                            <Text style={styles.authStandbySub}>
                              Add a Personal Access Token below so the daemon can push branches, create PRs, and post code reviews.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Token Input Card */}
                    <View style={[styles.card, { marginTop: 12 }]}>
                      <Text style={styles.cardSectionLabel}>CONFIGURE PERSONAL ACCESS TOKEN</Text>
                      <Text style={styles.tokenHint}>
                        Create a classic PAT with <Text style={{ color: '#0096c7', fontWeight: '700' }}>repo</Text> scope at GitHub → Settings → Developer Settings → Personal access tokens.
                      </Text>

                      <View style={styles.inputContainer}>
                        <TextInput
                          style={styles.textInput}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          placeholderTextColor="#6e7681"
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
                            <CheckCircle2 size={13} color="#3fb950" />
                          ) : (
                            <XCircle size={13} color="#f85149" />
                          )}
                          <Text
                            style={[
                              styles.feedbackText,
                              saveFeedback.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
                            ]}
                          >
                            {saveFeedback.text}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.saveBtn, isSavingGithubToken && { opacity: 0.7 }]}
                        onPress={handleSaveToken}
                        disabled={isSavingGithubToken}
                        activeOpacity={0.7}
                      >
                        {isSavingGithubToken ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Key size={14} color="#ffffff" />
                            <Text style={styles.saveBtnText}>Verify & Save Token</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Terminal Alternative Instructions */}
                    <View style={[styles.card, { marginTop: 12, backgroundColor: '#010409' }]}>
                      <Text style={[styles.cardSectionLabel, { color: '#6e7681' }]}>
                        OR EXPORT IN TERMINAL
                      </Text>
                      <Text style={styles.codeText}>
                        export GITHUB_TOKEN="ghp_xxx"
                      </Text>
                      <Text style={[styles.codeText, { marginTop: 4 }]}>
                        # Stored in ~/.cloud-agent/daemon.json
                      </Text>
                    </View>
                  </View>
                ) : (
                  /* Webhook URLs Section */
                  <View style={styles.section}>
                    {/* GitHub Webhook Card */}
                    <View style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardSectionLabel}>GITHUB REPOSITORY WEBHOOK</Text>
                      </View>

                      <Text style={styles.webhookIntro}>
                        Add this URL to your GitHub repository to trigger autonomous on-call auto-healing and pull request reviews:
                      </Text>

                      <View style={styles.urlBox}>
                        <Text style={styles.urlText} numberOfLines={2}>
                          {githubWebhookUrl}
                        </Text>
                        <TouchableOpacity
                          style={[styles.copyBtn, copiedGithub && styles.copyBtnDone]}
                          onPress={handleCopyGithubWebhook}
                          activeOpacity={0.7}
                        >
                          {copiedGithub ? (
                            <>
                              <Check size={12} color="#3fb950" />
                              <Text style={[styles.copyBtnText, { color: '#3fb950' }]}>Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color="#0077b6" />
                              <Text style={styles.copyBtnText}>Copy URL</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* GitHub Setup Instructions Checklist */}
                      <View style={styles.checklist}>
                        <Text style={styles.checkTitle}>Setup in GitHub Repository:</Text>
                        <Text style={styles.checkItem}>1. Go to repo <Text style={{ color: '#f0f6fc', fontWeight: '600' }}>Settings → Webhooks → Add webhook</Text></Text>
                        <Text style={styles.checkItem}>2. Payload URL: <Text style={{ color: '#48cae4' }}>Paste URL above</Text></Text>
                        <Text style={styles.checkItem}>3. Content type: <Text style={{ color: '#3fb950', fontWeight: '700' }}>application/json</Text></Text>
                        <Text style={styles.checkItem}>4. Events: Check <Text style={{ color: '#f0f6fc', fontWeight: '600' }}>Pull requests</Text> and <Text style={{ color: '#f0f6fc', fontWeight: '600' }}>Issues</Text></Text>
                      </View>
                    </View>

                    {/* Sentry Webhook Card */}
                    <View style={[styles.card, { marginTop: 12 }]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardSectionLabel}>SENTRY CRASH WEBHOOK</Text>
                      </View>
                      <Text style={styles.webhookIntro}>
                        Posts error stack traces and culprits to trigger automated on-call code fixes:
                      </Text>

                      <View style={styles.urlBox}>
                        <Text style={styles.urlText} numberOfLines={2}>
                          {sentryWebhookUrl}
                        </Text>
                        <TouchableOpacity
                          style={[styles.copyBtn, copiedSentry && styles.copyBtnDone]}
                          onPress={handleCopySentryWebhook}
                          activeOpacity={0.7}
                        >
                          {copiedSentry ? (
                            <>
                              <Check size={12} color="#3fb950" />
                              <Text style={[styles.copyBtnText, { color: '#3fb950' }]}>Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color="#0077b6" />
                              <Text style={styles.copyBtnText}>Copy URL</Text>
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
    backgroundColor: '#161b22',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#0d1117',
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
    borderBottomColor: '#0077b6',
  },
  tabButtonText: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#f0f6fc',
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
    backgroundColor: '#0d1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 14,
  },
  cardSectionLabel: {
    color: '#8b949e',
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
    color: '#8b949e',
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
    color: '#f0f6fc',
    fontSize: 13,
    fontWeight: '700',
  },
  authSource: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 1,
  },
  disconnectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  disconnectBtnText: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
  },
  authStandbyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139, 148, 158, 0.08)',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 8,
    padding: 10,
  },
  authStandbyTitle: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
  },
  authStandbySub: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  tokenHint: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    color: '#f0f6fc',
    fontSize: 13,
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0077b6',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  saveBtnText: {
    color: '#ffffff',
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
    color: '#3fb950',
  },
  feedbackErrorText: {
    color: '#f85149',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#c9d1d9',
    fontSize: 11,
    marginTop: 6,
  },
  webhookIntro: {
    color: '#8b949e',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  urlText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#48cae4',
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
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
  },
  copyBtnDone: {
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    borderColor: 'rgba(63, 185, 80, 0.35)',
  },
  copyBtnText: {
    color: '#0077b6',
    fontSize: 11,
    fontWeight: '600',
  },
  checklist: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    gap: 4,
  },
  checkTitle: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  checkItem: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 16,
  },
});

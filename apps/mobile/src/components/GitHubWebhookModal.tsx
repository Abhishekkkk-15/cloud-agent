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
  Switch,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
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
  Eye,
  EyeOff,
  User,
  Mail,
  Github,
  GitBranch,
} from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore, type GithubTestResult } from '../stores/useDaemonStore';

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
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const githubStatus = useDaemonStore((s) => s.githubStatus);
  const isCheckingGithub = useDaemonStore((s) => s.isCheckingGithub);
  const isSavingGithubToken = useDaemonStore((s) => s.isSavingGithubToken);
  const fetchGithubStatus = useDaemonStore((s) => s.fetchGithubStatus);
  const configureGithub = useDaemonStore((s) => s.configureGithub);
  const testGithubConnection = useDaemonStore((s) => s.testGithubConnection);
  const removeGithubToken = useDaemonStore((s) => s.removeGithubToken);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [tokenInput, setTokenInput] = useState('');
  const [userNameInput, setUserNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [configureGitCredentials, setConfigureGitCredentials] = useState(true);

  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<GithubTestResult | null>(null);

  const [copiedGithub, setCopiedGithub] = useState(false);
  const [copiedSentry, setCopiedSentry] = useState(false);
  const [activeTab, setActiveTab] = useState<'git' | 'webhooks'>('git');

  const { height: windowHeight } = useWindowDimensions();
  const modalHeight = Math.min(720, Math.round(windowHeight * 0.86));

  const machineId = activeMachine?.machineId || 'your-machine-id';
  const machineName = activeMachine?.name || daemonStatus?.hostname || 'Host Machine';
  const cleanGatewayUrl = gatewayUrl.replace(/\/+$/, '');
  const githubWebhookUrl = `${cleanGatewayUrl}/webhooks/github/${machineId}`;
  const sentryWebhookUrl = `${cleanGatewayUrl}/webhooks/sentry/${machineId}`;

  useEffect(() => {
    if (visible) {
      fetchGithubStatus().catch(() => {});
      setSaveFeedback(null);
      setTestResult(null);
    }
  }, [visible]);

  // Synchronize initial input fields from fetched host git config
  useEffect(() => {
    if (visible && githubStatus) {
      if (!userNameInput && githubStatus.gitUserName) {
        setUserNameInput(githubStatus.gitUserName);
      } else if (!userNameInput && githubStatus.name) {
        setUserNameInput(githubStatus.name);
      }

      if (!emailInput && githubStatus.gitUserEmail) {
        setEmailInput(githubStatus.gitUserEmail);
      } else if (!emailInput && githubStatus.email) {
        setEmailInput(githubStatus.email);
      }
    }
  }, [visible, githubStatus]);

  const handleOpenGithubPatPage = () => {
    const url = `https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=Cloud%20Agent%20(${encodeURIComponent(machineName)})`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      WebBrowser.openBrowserAsync(url).catch(() => {});
    }
  };

  const handleSaveConfiguration = async () => {
    const tokenToUse = tokenInput.trim();
    if (!tokenToUse && !githubStatus?.authenticated) {
      setSaveFeedback({ type: 'error', text: 'Please enter a valid GitHub Personal Access Token (e.g. ghp_...)' });
      return;
    }

    setSaveFeedback(null);
    setTestResult(null);

    const res = await configureGithub({
      token: tokenToUse,
      userName: userNameInput.trim() || undefined,
      email: emailInput.trim() || undefined,
      configureGitCredentials,
    });

    if (res.success) {
      setTokenInput('');
      setSaveFeedback({
        type: 'success',
        text: `Configured on ${machineName}! Authenticated as @${res.username}${res.gitUserName ? ` • Git: ${res.gitUserName}` : ''}`,
      });
    } else {
      setSaveFeedback({
        type: 'error',
        text: res.error || 'Failed to configure GitHub & Git on host system',
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testGithubConnection();
      setTestResult(res);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDisconnect = async () => {
    await removeGithubToken();
    setSaveFeedback({ type: 'success', text: `Cleared credentials from ${machineName}.` });
    setTestResult(null);
    setTokenInput('');
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

  const scopesList = (githubStatus?.scopes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
              style={[
                styles.modalContent,
                { height: modalHeight },
                isLight && styles.modalContentLight,
              ]}
            >
              {/* Header */}
              <View style={[styles.header, isLight && styles.headerLight]}>
                <View style={styles.headerLeft}>
                  <View style={[styles.headerIconCircle, isLight && styles.headerIconCircleLight]}>
                    <Github size={18} color={isLight ? '#0077b6' : '#48cae4'} />
                  </View>
                  <View style={styles.headerTextCol}>
                    <Text style={[styles.headerTitle, isLight && styles.headerTitleLight]}>
                      GitHub & Git Identity
                    </Text>
                    <Text style={[styles.headerSubtitle, isLight && styles.headerSubtitleLight]} numberOfLines={1}>
                      Host credentials for {machineName}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, isLight && styles.closeBtnLight]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close"
                >
                  <X size={17} color={isLight ? '#57606a' : '#8b949e'} />
                </TouchableOpacity>
              </View>

              {/* Tabs */}
              <View style={[styles.tabRow, isLight && styles.tabRowLight]}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'git' && (isLight ? styles.tabButtonActiveLight : styles.tabButtonActive),
                  ]}
                  onPress={() => setActiveTab('git')}
                  activeOpacity={0.7}
                >
                  <Key
                    size={13}
                    color={activeTab === 'git' ? (isLight ? '#0077b6' : '#f0f6fc') : (isLight ? '#6e7681' : '#8b949e')}
                  />
                  <Text
                    style={[
                      styles.tabButtonText,
                      isLight && styles.tabButtonTextLight,
                      activeTab === 'git' && (isLight ? styles.tabButtonTextActiveLight : styles.tabButtonTextActive),
                    ]}
                  >
                    Git Credentials
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === 'webhooks' && (isLight ? styles.tabButtonActiveLight : styles.tabButtonActive),
                  ]}
                  onPress={() => setActiveTab('webhooks')}
                  activeOpacity={0.7}
                >
                  <GitPullRequest
                    size={13}
                    color={activeTab === 'webhooks' ? (isLight ? '#0077b6' : '#f0f6fc') : (isLight ? '#6e7681' : '#8b949e')}
                  />
                  <Text
                    style={[
                      styles.tabButtonText,
                      isLight && styles.tabButtonTextLight,
                      activeTab === 'webhooks' && (isLight ? styles.tabButtonTextActiveLight : styles.tabButtonTextActive),
                    ]}
                  >
                    Webhooks & Events
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={[styles.scroll, isLight && { backgroundColor: '#ffffff' }]}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {activeTab === 'git' ? (
                  <View style={styles.section}>
                    {/* 1. Host Status Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>
                          HOST STATUS
                        </Text>
                        <TouchableOpacity
                          onPress={() => fetchGithubStatus()}
                          disabled={isCheckingGithub}
                          style={styles.refreshIconBtn}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Refresh Status"
                        >
                          <RefreshCw
                            size={12}
                            color={isLight ? '#57606a' : '#8b949e'}
                            style={isCheckingGithub ? { transform: [{ rotate: '45deg' }] } : undefined}
                          />
                        </TouchableOpacity>
                      </View>

                      {isCheckingGithub ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                          <Text style={[styles.loadingText, isLight && { color: '#6e7681' }]}>
                            Inspecting git credentials on {machineName}...
                          </Text>
                        </View>
                      ) : githubStatus?.authenticated ? (
                        <View>
                          <View style={styles.authSuccessBox}>
                            <View style={styles.authSuccessLeft}>
                              <CheckCircle2 size={16} color="#2ea043" />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.authUsername, isLight && { color: '#1f2328' }]} numberOfLines={1}>
                                  @{githubStatus.username || 'Authenticated'}
                                </Text>
                                <Text style={[styles.authSource, isLight && { color: '#57606a' }]}>
                                  {githubStatus.source === 'token'
                                    ? 'Personal Access Token'
                                    : 'Host GitHub CLI Session'}
                                </Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={[styles.disconnectBtn, isLight && styles.disconnectBtnLight]}
                              onPress={handleDisconnect}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.disconnectBtnText}>Clear</Text>
                            </TouchableOpacity>
                          </View>

                          {/* OAuth Scopes Wrapped Chips */}
                          {scopesList.length > 0 && (
                            <View style={[styles.scopesRow, isLight && styles.scopesRowLight]}>
                              <Text style={[styles.scopesLabel, isLight && { color: '#57606a' }]}>Scopes:</Text>
                              <View style={styles.scopeChipsWrap}>
                                {scopesList.map((scope) => (
                                  <View key={scope} style={[styles.scopeChip, isLight && styles.scopeChipLight]}>
                                    <Text style={[styles.scopeChipText, isLight && styles.scopeChipTextLight]}>
                                      {scope}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}

                          {/* Git Author Info Strip */}
                          <View style={[styles.gitIdentityStrip, isLight && styles.gitIdentityStripLight]}>
                            <View style={styles.gitIdentityItem}>
                              <Text style={[styles.gitIdentityLabel, isLight && { color: '#6e7681' }]}>user.name</Text>
                              <Text style={[styles.gitIdentityValue, isLight && { color: '#1f2328' }]} numberOfLines={1}>
                                {githubStatus.gitUserName || 'Not Set'}
                              </Text>
                            </View>
                            <View style={[styles.gitIdentityDivider, isLight && { backgroundColor: '#d0d7de' }]} />
                            <View style={styles.gitIdentityItem}>
                              <Text style={[styles.gitIdentityLabel, isLight && { color: '#6e7681' }]}>user.email</Text>
                              <Text style={[styles.gitIdentityValue, isLight && { color: '#1f2328' }]} numberOfLines={1}>
                                {githubStatus.gitUserEmail || 'Not Set'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.authStandbyBox, isLight && styles.authStandbyBoxLight]}>
                          <ShieldAlert size={16} color={isLight ? '#0077b6' : '#48cae4'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.authStandbyTitle, isLight && styles.authStandbyTitleLight]}>
                              No GitHub Token Configured
                            </Text>
                            <Text style={[styles.authStandbySub, isLight && styles.authStandbySubLight]}>
                              Provide a Personal Access Token below so agents can commit, push branches, and open pull requests on this host.
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* 2. Configure Form Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>
                          CONFIGURE CREDENTIALS
                        </Text>
                        <TouchableOpacity
                          style={styles.patLinkBtn}
                          onPress={handleOpenGithubPatPage}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.patLinkText}>Generate PAT ↗</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Field 1: GitHub PAT */}
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight]}>
                        GITHUB PERSONAL ACCESS TOKEN
                      </Text>
                      <View style={[styles.inputContainer, isLight && styles.inputContainerLight]}>
                        <Key size={14} color={isLight ? '#57606a' : '#8b949e'} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder={githubStatus?.authenticated ? '•••••••••••••••••••••••••••••••• (Active)' : 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                          placeholderTextColor={isLight ? '#8c959f' : '#6e7681'}
                          value={tokenInput}
                          onChangeText={setTokenInput}
                          secureTextEntry={!showToken}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <TouchableOpacity
                          onPress={() => setShowToken(!showToken)}
                          style={styles.eyeBtn}
                          activeOpacity={0.7}
                        >
                          {showToken ? (
                            <EyeOff size={16} color={isLight ? '#57606a' : '#8b949e'} />
                          ) : (
                            <Eye size={16} color={isLight ? '#57606a' : '#8b949e'} />
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.fieldHint, isLight && { color: '#6e7681' }]}>
                        Recommended scopes: <Text style={{ fontWeight: '700' }}>repo</Text>, <Text style={{ fontWeight: '700' }}>workflow</Text>, <Text style={{ fontWeight: '700' }}>read:user</Text>, and <Text style={{ fontWeight: '700' }}>user:email</Text>.
                      </Text>

                      {/* Field 2: Git Author Name */}
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight, { marginTop: 12 }]}>
                        GIT AUTHOR NAME
                      </Text>
                      <View style={[styles.inputContainer, isLight && styles.inputContainerLight]}>
                        <User size={14} color={isLight ? '#57606a' : '#8b949e'} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="e.g. Abhishek Jangid"
                          placeholderTextColor={isLight ? '#8c959f' : '#6e7681'}
                          value={userNameInput}
                          onChangeText={setUserNameInput}
                          autoCapitalize="words"
                          autoCorrect={false}
                        />
                      </View>
                      <Text style={[styles.fieldHint, isLight && { color: '#6e7681' }]}>
                        Configures host git user.name
                      </Text>

                      {/* Field 3: Git Author Email */}
                      <Text style={[styles.inputLabel, isLight && styles.inputLabelLight, { marginTop: 12 }]}>
                        GIT AUTHOR EMAIL
                      </Text>
                      <View style={[styles.inputContainer, isLight && styles.inputContainerLight]}>
                        <Mail size={14} color={isLight ? '#57606a' : '#8b949e'} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.textInput, isLight && styles.textInputLight]}
                          placeholder="e.g. dev@example.com"
                          placeholderTextColor={isLight ? '#8c959f' : '#6e7681'}
                          value={emailInput}
                          onChangeText={setEmailInput}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                        />
                      </View>
                      <Text style={[styles.fieldHint, isLight && { color: '#6e7681' }]}>
                        Configures host git user.email
                      </Text>

                      {/* Option: Git Credential Helper Switch */}
                      <View style={[styles.switchRow, isLight && styles.switchRowLight]}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={[styles.switchTitle, isLight && styles.switchTitleLight]}>
                            Git Credential Storage
                          </Text>
                          <Text style={[styles.switchSubtitle, isLight && { color: '#6e7681' }]}>
                            Enables non-interactive git push via Git credential helper
                          </Text>
                        </View>
                        <Switch
                          value={configureGitCredentials}
                          onValueChange={setConfigureGitCredentials}
                          trackColor={{ false: '#21262d', true: '#0077b6' }}
                          thumbColor="#ffffff"
                        />
                      </View>

                      {/* Feedback Banner */}
                      {saveFeedback && (
                        <View
                          style={[
                            styles.feedbackBox,
                            saveFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                          ]}
                        >
                          {saveFeedback.type === 'success' ? (
                            <CheckCircle2 size={14} color="#2ea043" />
                          ) : (
                            <XCircle size={14} color="#f85149" />
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

                      {/* Action Buttons (Stacked for complete mobile responsiveness) */}
                      <View style={styles.actionColumn}>
                        <TouchableOpacity
                          style={[
                            styles.saveBtn,
                            isLight && styles.saveBtnLight,
                            isSavingGithubToken && { opacity: 0.7 },
                          ]}
                          onPress={handleSaveConfiguration}
                          disabled={isSavingGithubToken}
                          activeOpacity={0.7}
                        >
                          {isSavingGithubToken ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <GitBranch size={14} color="#ffffff" />
                              <Text style={styles.saveBtnText}>Save & Configure Host</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.testBtn,
                            isLight && styles.testBtnLight,
                            isTestingConnection && { opacity: 0.7 },
                          ]}
                          onPress={handleTestConnection}
                          disabled={isTestingConnection}
                          activeOpacity={0.7}
                        >
                          {isTestingConnection ? (
                            <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                          ) : (
                            <>
                              <RefreshCw size={13} color={isLight ? '#0077b6' : '#48cae4'} />
                              <Text style={[styles.testBtnText, isLight && { color: '#0077b6' }]}>
                                Test Connection & Rate Limit
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Diagnostic Test Result Box */}
                      {testResult && (
                        <View
                          style={[
                            styles.testResultBox,
                            testResult.success ? styles.testResultSuccess : styles.testResultError,
                            isLight && (testResult.success ? styles.testResultSuccessLight : styles.testResultErrorLight),
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            {testResult.success ? (
                              <CheckCircle2 size={14} color="#2ea043" />
                            ) : (
                              <XCircle size={14} color="#f85149" />
                            )}
                            <Text
                              style={[
                                styles.testResultTitle,
                                testResult.success ? styles.testResultTitleSuccess : styles.testResultTitleError,
                                isLight && { color: testResult.success ? '#1a7f37' : '#cf222e' },
                              ]}
                            >
                              {testResult.success ? 'Diagnostic Passed' : 'Diagnostic Failed'}
                            </Text>
                          </View>
                          <Text style={[styles.testResultMessage, isLight && { color: '#1f2328' }]}>
                            {testResult.message}
                          </Text>
                          {testResult.rateLimitRemaining && (
                            <Text style={[styles.testResultSub, isLight && { color: '#6e7681' }]}>
                              API Rate Limit: {testResult.rateLimitRemaining} requests remaining
                            </Text>
                          )}
                          {testResult.gitVersion && (
                            <Text style={[styles.testResultSub, isLight && { color: '#6e7681' }]}>
                              Git Engine: {testResult.gitVersion}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  /* Webhook URLs Section */
                  <View style={styles.section}>
                    {/* GitHub Webhook Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>
                          GITHUB REPOSITORY WEBHOOK
                        </Text>
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
                            copiedGithub && styles.copyBtnDone,
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
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>
                          1. Repo <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Settings → Webhooks → Add webhook</Text>
                        </Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>
                          2. Payload URL: <Text style={{ color: isLight ? '#1f2328' : '#fafafa' }}>Paste the URL above</Text>
                        </Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>
                          3. Content type: <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '700' }}>application/json</Text>
                        </Text>
                        <Text style={[styles.checkItem, isLight && { color: '#57606a' }]}>
                          4. Events: Select <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Pull requests</Text> and <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>Issues</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Sentry Webhook Card */}
                    <View style={[styles.card, isLight && styles.cardLight]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={[styles.cardSectionLabel, isLight && styles.cardSectionLabelLight]}>
                          SENTRY CRASH WEBHOOK
                        </Text>
                      </View>
                      <Text style={[styles.webhookIntro, isLight && { color: '#57606a' }]}>
                        Receives runtime error alerts to trigger automated on-call investigations:
                      </Text>

                      <View style={[styles.urlBox, isLight && styles.urlBoxLight]}>
                        <Text style={[styles.urlText, isLight && styles.urlTextLight]} numberOfLines={2}>
                          {sentryWebhookUrl}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.copyBtn,
                            isLight && styles.copyBtnLight,
                            copiedSentry && styles.copyBtnDone,
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
            </KeyboardAvoidingView>
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
    padding: 14,
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  headerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCircleLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    color: '#f0f6fc',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitleLight: {
    color: '#1f2328',
  },
  headerSubtitle: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 1,
  },
  headerSubtitleLight: {
    color: '#57606a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  closeBtnLight: {
    backgroundColor: '#e1e4e8',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#0d1117',
  },
  tabRowLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#0077b6',
  },
  tabButtonActiveLight: {
    borderBottomColor: '#0077b6',
  },
  tabButtonText: {
    color: '#8b949e',
    fontSize: 12.5,
    fontWeight: '600',
  },
  tabButtonTextLight: {
    color: '#6e7681',
  },
  tabButtonTextActive: {
    color: '#f0f6fc',
    fontWeight: '700',
  },
  tabButtonTextActiveLight: {
    color: '#0077b6',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  card: {
    backgroundColor: '#0d1117',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 14,
  },
  cardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardSectionLabel: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardSectionLabelLight: {
    color: '#6e7681',
  },
  patLinkBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  patLinkText: {
    fontSize: 11.5,
    color: '#0077b6',
    fontWeight: '600',
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
    fontSize: 12,
    color: '#8b949e',
  },
  authSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  authSuccessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  authUsername: {
    color: '#f0f6fc',
    fontSize: 14,
    fontWeight: '700',
  },
  authSource: {
    color: '#8b949e',
    fontSize: 11,
    marginTop: 1,
  },
  disconnectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  disconnectBtnLight: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffc1be',
  },
  disconnectBtnText: {
    fontSize: 11,
    color: '#f85149',
    fontWeight: '600',
  },
  scopesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  scopesRowLight: {
    borderTopColor: '#d0d7de',
  },
  scopesLabel: {
    fontSize: 11,
    color: '#8b949e',
    fontWeight: '600',
    marginTop: 2,
  },
  scopeChipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  scopeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  scopeChipLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  scopeChipText: {
    fontSize: 10,
    color: '#f0f6fc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  scopeChipTextLight: {
    color: '#1f2328',
  },
  gitIdentityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  gitIdentityStripLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  gitIdentityItem: {
    flex: 1,
  },
  gitIdentityDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#30363d',
    marginHorizontal: 10,
  },
  gitIdentityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gitIdentityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f0f6fc',
    marginTop: 2,
  },
  authStandbyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  authStandbyBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  authStandbyTitle: {
    color: '#f0f6fc',
    fontSize: 12.5,
    fontWeight: '700',
  },
  authStandbyTitleLight: {
    color: '#1f2328',
  },
  authStandbySub: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  authStandbySubLight: {
    color: '#57606a',
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputLabelLight: {
    color: '#6e7681',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 12,
    height: 42,
  },
  inputContainerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  textInput: {
    flex: 1,
    color: '#f0f6fc',
    fontSize: 12.5,
    paddingVertical: 0,
  },
  textInputLight: {
    color: '#1f2328',
  },
  eyeBtn: {
    padding: 6,
  },
  fieldHint: {
    fontSize: 10.5,
    color: '#8b949e',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  switchRowLight: {
    borderTopColor: '#d0d7de',
  },
  switchTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  switchTitleLight: {
    color: '#1f2328',
  },
  switchSubtitle: {
    fontSize: 10.5,
    color: '#8b949e',
    marginTop: 2,
    lineHeight: 14,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(46, 160, 67, 0.1)',
    borderColor: 'rgba(46, 160, 67, 0.3)',
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  feedbackSuccessText: {
    color: '#2ea043',
  },
  feedbackErrorText: {
    color: '#f85149',
  },
  actionColumn: {
    gap: 8,
    marginTop: 14,
  },
  saveBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: '#0077b6',
  },
  saveBtnLight: {
    backgroundColor: '#0077b6',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  testBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  testBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  testBtnText: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
  },
  testResultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: 'rgba(46, 160, 67, 0.08)',
    borderColor: 'rgba(46, 160, 67, 0.25)',
  },
  testResultSuccessLight: {
    backgroundColor: '#f6fdf8',
    borderColor: '#a8dab5',
  },
  testResultError: {
    backgroundColor: 'rgba(248, 81, 73, 0.08)',
    borderColor: 'rgba(248, 81, 73, 0.25)',
  },
  testResultErrorLight: {
    backgroundColor: '#fff8f7',
    borderColor: '#ffc1be',
  },
  testResultTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  testResultTitleSuccess: {
    color: '#2ea043',
  },
  testResultTitleError: {
    color: '#f85149',
  },
  testResultMessage: {
    fontSize: 11.5,
    color: '#c9d1d9',
    marginTop: 2,
    lineHeight: 16,
  },
  testResultSub: {
    fontSize: 10.5,
    color: '#8b949e',
    marginTop: 4,
  },
  webhookIntro: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 17,
    marginBottom: 10,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.sm,
    padding: 10,
    gap: 8,
  },
  urlBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  urlText: {
    flex: 1,
    color: '#f0f6fc',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  urlTextLight: {
    color: '#1f2328',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  copyBtnLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  copyBtnDone: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    borderColor: 'rgba(46, 160, 67, 0.35)',
  },
  copyBtnText: {
    color: '#48cae4',
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
  checklistLight: {
    borderTopColor: '#d0d7de',
  },
  checkTitle: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  checkTitleLight: {
    color: '#1f2328',
  },
  checkItem: {
    color: '#8b949e',
    fontSize: 11,
    lineHeight: 16,
  },
});

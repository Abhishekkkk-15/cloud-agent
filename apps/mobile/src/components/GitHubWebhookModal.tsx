import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Dialog,
  Tabs,
  Button,
  Input,
  Switch,
  Badge,
  Card,
  Text,
  cn,
} from 'panelui-native';
import {
  X,
  Key,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  GitPullRequest,
  ShieldAlert,
  Eye,
  EyeOff,
  User,
  Mail,
  Github,
  GitBranch,
} from './Icons';
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
  const modalHeight = Math.min(680, Math.round(windowHeight * 0.85));

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
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content
        className="w-full max-w-lg bg-popover border border-border p-0 overflow-hidden rounded-2xl flex-col"
        style={{ height: modalHeight }}
      >
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className="w-8 h-8 rounded-lg bg-surface-secondary border border-border items-center justify-center">
              <Github size={16} color={isLight ? '#262626' : '#fafafa'} />
            </View>
            <View className="flex-1">
              <Dialog.Title className="text-base font-semibold text-foreground">
                GitHub & Git Identity
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
                Host credentials for {machineName}
              </Dialog.Description>
            </View>
          </View>

          <Dialog.Close>
            <Button
              variant="ghost"
              size="sm"
              className="w-7 h-7 p-0 items-center justify-center rounded-lg"
            >
              <X size={15} color={isLight ? '#686868' : '#a3a3a3'} />
            </Button>
          </Dialog.Close>
        </View>

        {/* Tabs */}
        <View className="px-4 pt-3">
          <Tabs
            defaultValue="git"
            value={activeTab}
            size="xs"
            onValueChange={(val) => setActiveTab(val as any)}
            className="w-full"
          >
            <Tabs.List className="w-full bg-surface-secondary border border-border p-1 rounded-xl">
              <Tabs.Trigger
                value="git"
                className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
              >
                <Key size={13} color={activeTab === 'git' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                <Text className={cn("text-xs font-medium", activeTab === 'git' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  Git Credentials
                </Text>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="webhooks"
                className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
              >
                <GitPullRequest size={13} color={activeTab === 'webhooks' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                <Text className={cn("text-xs font-medium", activeTab === 'webhooks' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  Webhooks & Events
                </Text>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Scroll Body */}
        <ScrollView
          className="flex-1"
          style={{ flex: 1 }}
          contentContainerClassName="p-4 pb-6 gap-3.5"
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'git' ? (
            <>
              {/* 1. Host Status Card */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl">
                <View className="flex-row items-center justify-between mb-2.5">
                  <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    HOST STATUS
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-6 h-6 p-0 items-center justify-center rounded-md"
                    onPress={() => fetchGithubStatus()}
                    disabled={isCheckingGithub}
                  >
                    <RefreshCw
                      size={12}
                      color={isLight ? '#686868' : '#a3a3a3'}
                      style={isCheckingGithub ? { transform: [{ rotate: '45deg' }] } : undefined}
                    />
                  </Button>
                </View>

                {isCheckingGithub ? (
                  <View className="flex-row items-center gap-2 py-2">
                    <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs text-muted-foreground">
                      Inspecting git credentials on {machineName}...
                    </Text>
                  </View>
                ) : githubStatus?.authenticated ? (
                  <View className="gap-2.5">
                    <View className="flex-row items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                      <View className="flex-row items-center gap-2 flex-1 mr-2">
                        <CheckCircle2 size={16} color="#10b981" />
                        <View className="flex-1">
                          <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                            @{githubStatus.username || 'Authenticated'}
                          </Text>
                          <Text className="text-[11px] text-muted-foreground">
                            {githubStatus.source === 'token'
                              ? 'Personal Access Token'
                              : 'Host GitHub CLI Session'}
                          </Text>
                        </View>
                      </View>

                      <Button
                        variant="outline"
                        size="xs"
                        className="px-2 py-1"
                        onPress={handleDisconnect}
                      >
                        <Text className="text-[11px] text-destructive">Clear</Text>
                      </Button>
                    </View>

                    {/* OAuth Scopes Wrapped Chips */}
                    {scopesList.length > 0 && (
                      <View className="flex-row flex-wrap items-center gap-1.5 pt-1">
                        <Text className="text-[11px] text-muted-foreground mr-1">Scopes:</Text>
                        {scopesList.map((scope) => (
                          <Badge key={scope} variant="outline" size="xs">
                            {scope}
                          </Badge>
                        ))}
                      </View>
                    )}

                    {/* Git Author Info Strip */}
                    <View className="flex-row items-center justify-between p-2 rounded-lg bg-surface border border-border">
                      <View className="flex-1 mr-2">
                        <Text className="text-[10px] uppercase font-semibold text-muted-foreground">user.name</Text>
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {githubStatus.gitUserName || 'Not Set'}
                        </Text>
                      </View>
                      <View className="w-px h-6 bg-border mx-2" />
                      <View className="flex-1 ml-1">
                        <Text className="text-[10px] uppercase font-semibold text-muted-foreground">user.email</Text>
                        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                          {githubStatus.gitUserEmail || 'Not Set'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2.5 p-3 rounded-lg bg-surface border border-border">
                    <ShieldAlert size={16} color={isLight ? '#262626' : '#fafafa'} />
                    <View className="flex-1">
                      <Text className="text-xs font-semibold text-foreground">
                        No GitHub Token Configured
                      </Text>
                      <Text className="text-[11px] text-muted-foreground mt-0.5 leading-4">
                        Provide a Personal Access Token below so agents can commit, push branches, and open pull requests on this host.
                      </Text>
                    </View>
                  </View>
                )}
              </Card>

              {/* 2. Configure Form Card */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    CONFIGURE CREDENTIALS
                  </Text>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="px-1.5 py-0.5"
                    onPress={handleOpenGithubPatPage}
                  >
                    <Text className="text-xs font-medium text-primary">Generate PAT ↗</Text>
                  </Button>
                </View>

                {/* Field 1: GitHub PAT */}
                <View className="gap-1">
                  <Input
                    label="GITHUB PERSONAL ACCESS TOKEN"
                    size="sm"
                    placeholder={githubStatus?.authenticated ? '•••••••••••••••• (Active)' : 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                    value={tokenInput}
                    onChangeText={setTokenInput}
                    secureTextEntry={!showToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    startContent={<Key size={14} color="#888888" />}
                    endContent={
                      <Button
                        variant="ghost"
                        size="xs"
                        className="w-6 h-6 p-0 items-center justify-center"
                        onPress={() => setShowToken(!showToken)}
                      >
                        {showToken ? (
                          <EyeOff size={14} color="#888888" />
                        ) : (
                          <Eye size={14} color="#888888" />
                        )}
                      </Button>
                    }
                    description="Recommended scopes: repo, workflow, read:user, user:email."
                  />
                </View>

                {/* Field 2: Git Author Name */}
                <View className="gap-1">
                  <Input
                    label="GIT AUTHOR NAME"
                    size="sm"
                    placeholder="e.g. Abhishek Jangid"
                    value={userNameInput}
                    onChangeText={setUserNameInput}
                    autoCapitalize="words"
                    autoCorrect={false}
                    startContent={<User size={14} color="#888888" />}
                    description="Configures host git user.name"
                  />
                </View>

                {/* Field 3: Git Author Email */}
                <View className="gap-1">
                  <Input
                    label="GIT AUTHOR EMAIL"
                    size="sm"
                    placeholder="e.g. dev@example.com"
                    value={emailInput}
                    onChangeText={setEmailInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    startContent={<Mail size={14} color="#888888" />}
                    description="Configures host git user.email"
                  />
                </View>

                {/* Option: Git Credential Helper Switch */}
                <View className="flex-row items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                  <View className="flex-1 mr-3">
                    <Text className="text-xs font-semibold text-foreground">
                      Git Credential Storage
                    </Text>
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      Enables non-interactive git push via Git credential helper
                    </Text>
                  </View>
                  <Switch
                    size="sm"
                    value={configureGitCredentials}
                    onValueChange={setConfigureGitCredentials}
                  />
                </View>

                {/* Feedback Banner */}
                {saveFeedback && (
                  <View
                    className={cn(
                      "p-2.5 rounded-lg border flex-row items-center gap-2",
                      saveFeedback.type === 'success'
                        ? "bg-success/10 border-success/30"
                        : "bg-destructive/10 border-destructive/30"
                    )}
                  >
                    {saveFeedback.type === 'success' ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : (
                      <XCircle size={14} color="#ef4444" />
                    )}
                    <Text
                      className={cn(
                        "text-xs font-medium flex-1",
                        saveFeedback.type === 'success' ? "text-success" : "text-destructive"
                      )}
                    >
                      {saveFeedback.text}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View className="gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full flex-row items-center justify-center gap-1.5"
                    onPress={handleSaveConfiguration}
                    disabled={isSavingGithubToken}
                  >
                    {isSavingGithubToken ? (
                      <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#262626'} />
                    ) : (
                      <>
                        <GitBranch size={13} color={isLight ? '#ffffff' : '#262626'} />
                        <Text className="text-xs font-semibold text-primary-foreground">
                          Save & Configure Host
                        </Text>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex-row items-center justify-center gap-1.5"
                    onPress={handleTestConnection}
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? (
                      <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                    ) : (
                      <>
                        <RefreshCw size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                        <Text className="text-xs font-medium text-foreground">
                          Test Connection & Rate Limit
                        </Text>
                      </>
                    )}
                  </Button>
                </View>

                {/* Diagnostic Test Result Box */}
                {testResult && (
                  <View
                    className={cn(
                      "p-3 rounded-lg border gap-1",
                      testResult.success
                        ? "bg-success/10 border-success/30"
                        : "bg-destructive/10 border-destructive/30"
                    )}
                  >
                    <View className="flex-row items-center gap-1.5 mb-0.5">
                      {testResult.success ? (
                        <CheckCircle2 size={14} color="#10b981" />
                      ) : (
                        <XCircle size={14} color="#ef4444" />
                      )}
                      <Text
                        className={cn(
                          "text-xs font-semibold",
                          testResult.success ? "text-success" : "text-destructive"
                        )}
                      >
                        {testResult.success ? 'Diagnostic Passed' : 'Diagnostic Failed'}
                      </Text>
                    </View>
                    <Text className="text-xs text-foreground leading-4">
                      {testResult.message}
                    </Text>
                    {testResult.rateLimitRemaining !== undefined && (
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        API Rate Limit: {testResult.rateLimitRemaining} requests remaining
                      </Text>
                    )}
                    {testResult.gitVersion && (
                      <Text className="text-[11px] text-muted-foreground">
                        Git Engine: {testResult.gitVersion}
                      </Text>
                    )}
                  </View>
                )}
              </Card>
            </>
          ) : (
            /* Webhook URLs Section */
            <View className="gap-3.5">
              {/* GitHub Webhook Card */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl gap-2.5">
                <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  GITHUB REPOSITORY WEBHOOK
                </Text>

                <Text className="text-xs text-muted-foreground leading-4">
                  Add this webhook URL to your GitHub repository to enable automatic issue triaging and PR reviews:
                </Text>

                <View className="p-2.5 rounded-lg bg-surface border border-border flex-row items-center justify-between gap-2">
                  <Text className="text-xs font-mono text-foreground flex-1" numberOfLines={2}>
                    {githubWebhookUrl}
                  </Text>
                  <Button
                    variant="outline"
                    size="xs"
                    className="flex-row items-center gap-1 px-2 py-1"
                    onPress={handleCopyGithubWebhook}
                  >
                    {copiedGithub ? (
                      <>
                        <Check size={12} color="#10b981" />
                        <Text className="text-[11px] text-success font-medium">Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={12} color={isLight ? '#262626' : '#f5f5f5'} />
                        <Text className="text-[11px] text-foreground font-medium">Copy URL</Text>
                      </>
                    )}
                  </Button>
                </View>

                {/* Setup in GitHub Repository */}
                <View className="p-3 rounded-lg bg-surface border border-border gap-1.5">
                  <Text className="text-xs font-semibold text-foreground mb-0.5">
                    Setup in GitHub Repository:
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    1. Repo <Text className="text-foreground font-medium">Settings → Webhooks → Add webhook</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    2. Payload URL: <Text className="text-foreground">Paste the URL above</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    3. Content type: <Text className="text-foreground font-semibold">application/json</Text>
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    4. Events: Select <Text className="text-foreground font-medium">Pull requests</Text> and <Text className="text-foreground font-medium">Issues</Text>
                  </Text>
                </View>
              </Card>

              {/* Sentry Webhook Card */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl gap-2.5">
                <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  SENTRY CRASH WEBHOOK
                </Text>
                <Text className="text-xs text-muted-foreground leading-4">
                  Receives runtime crash alerts to investigate errors:
                </Text>

                <View className="p-2.5 rounded-lg bg-surface border border-border flex-row items-center justify-between gap-2">
                  <Text className="text-xs font-mono text-foreground flex-1" numberOfLines={2}>
                    {sentryWebhookUrl}
                  </Text>
                  <Button
                    variant="outline"
                    size="xs"
                    className="flex-row items-center gap-1 px-2 py-1"
                    onPress={handleCopySentryWebhook}
                  >
                    {copiedSentry ? (
                      <>
                        <Check size={12} color="#10b981" />
                        <Text className="text-[11px] text-success font-medium">Copied</Text>
                      </>
                    ) : (
                      <>
                        <Copy size={12} color={isLight ? '#262626' : '#f5f5f5'} />
                        <Text className="text-[11px] text-foreground font-medium">Copy URL</Text>
                      </>
                    )}
                  </Button>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>
      </Dialog.Content>
    </Dialog>
  );
};

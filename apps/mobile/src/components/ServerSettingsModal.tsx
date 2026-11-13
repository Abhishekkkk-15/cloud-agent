import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import {
  Dialog,
  Tabs,
  Button,
  Input,
  Badge,
  Card,
  Switch,
  Text,
  cn,
  toast,
} from 'panelui-native';
import {
  X,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  Database,
  Radio,
  Bell,
  BellRing,
  Copy,
  Check,
  Smartphone,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Key,
  RefreshCw,
} from './Icons';
import { useDaemonStore, type EndpointTestResult } from '../stores/useDaemonStore';
import { isRunningInExpoGo } from '../lib/notifications';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  // Gateway Store State
  const currentGatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const setServerEndpoints = useDaemonStore((s) => s.setServerEndpoints);
  const resetServerEndpoints = useDaemonStore((s) => s.resetServerEndpoints);
  const testServerEndpoints = useDaemonStore((s) => s.testServerEndpoints);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  // Push Store State
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const pushStatus = useDaemonStore((s) => s.pushStatus);
  const pushToken = useDaemonStore((s) => s.pushToken);
  const triggerTestPushNotification = useDaemonStore((s) => s.triggerTestPushNotification);
  const registerPushNotifications = useDaemonStore((s) => s.registerPushNotifications);
  const notifyApprovals = useDaemonStore((s) => s.notifyApprovals);
  const notifyTurnComplete = useDaemonStore((s) => s.notifyTurnComplete);
  const notifyErrors = useDaemonStore((s) => s.notifyErrors);
  const setNotificationPreference = useDaemonStore((s) => s.setNotificationPreference);

  // Local State
  const [activeTab, setActiveTab] = useState<'gateway' | 'notifications'>('gateway');
  const [inputGatewayUrl, setInputGatewayUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushFeedbackMessage, setPushFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { height: windowHeight } = useWindowDimensions();
  const modalHeight = Math.min(680, Math.round(windowHeight * 0.88));
  const isExpoGo = isRunningInExpoGo();

  useEffect(() => {
    if (visible) {
      setInputGatewayUrl(currentGatewayUrl);
      setTestResult(null);
      setStatusMessage(null);
      setPushFeedbackMessage(null);
      setTokenCopied(false);
      if (activeTab === 'notifications' && !isExpoGo && !isPushRegistered) {
        registerPushNotifications().catch(() => {});
      }
    }
  }, [visible, currentGatewayUrl, activeTab, isExpoGo, isPushRegistered]);

  const handleApplyPreset = (gateway: string) => {
    setInputGatewayUrl(gateway);
    setTestResult(null);
    setStatusMessage(null);
  };

  const handleTest = async () => {
    if (!inputGatewayUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a Gateway Hub URL.' });
      return;
    }
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await testServerEndpoints(inputGatewayUrl.trim(), inputGatewayUrl.trim());
      setTestResult(res);
      if (res.gatewayOk) {
        setStatusMessage({
          type: 'success',
          text: `Gateway online! Latency: ${res.gatewayLatencyMs}ms (${res.connectedDaemons ?? 0} node(s) connected)`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Gateway unreachable: ${res.gatewayError || 'Connection failed'}.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Gateway test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestPush = async () => {
    setIsSendingTestPush(true);
    setPushFeedbackMessage(null);
    try {
      const res = await triggerTestPushNotification();
      if (res.success) {
        setPushFeedbackMessage({ type: 'success', text: res.message });
        toast.show({
          variant: 'success',
          label: 'Test Push Dispatched',
          description: res.message,
          duration: 4000,
        });
      } else {
        setPushFeedbackMessage({ type: 'error', text: res.message });
        toast.show({
          variant: 'destructive',
          label: 'Test Push Failed',
          description: res.message,
          duration: 5000,
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Push test failed.';
      setPushFeedbackMessage({ type: 'error', text: msg });
      toast.show({
        variant: 'destructive',
        label: 'Push Test Error',
        description: msg,
        duration: 5000,
      });
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleSyncPush = async () => {
    setIsSyncingPush(true);
    setPushFeedbackMessage(null);
    try {
      await registerPushNotifications();
      toast.show({
        variant: 'default',
        label: 'Push Engine Synced',
        description: 'Device push registration renewed with Gateway Hub.',
        duration: 3000,
      });
    } catch (err: any) {
      setPushFeedbackMessage({ type: 'error', text: err?.message || 'Device sync failed' });
    } finally {
      setIsSyncingPush(false);
    }
  };

  const handleCopyToken = () => {
    if (!pushToken) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(pushToken).catch(() => {});
    }
    setTokenCopied(true);
    toast.show({
      variant: 'default',
      label: 'Push Token Copied',
      description: 'Expo Push Token copied to clipboard.',
      duration: 2500,
    });
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!inputGatewayUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Gateway URL cannot be empty.' });
      return;
    }

    setIsSaving(true);
    try {
      const clean = inputGatewayUrl.trim();
      await setServerEndpoints({
        apiUrl: clean,
        gatewayUrl: clean,
      });
      setStatusMessage({ type: 'success', text: 'Gateway endpoint updated. Reconnecting...' });
      toast.show({
        variant: 'success',
        label: 'Gateway Updated',
        description: `Connected to ${clean}`,
        duration: 3000,
      });
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save gateway URL.' });
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetServerEndpoints();
      setInputGatewayUrl(useDaemonStore.getState().gatewayUrl);
      setTestResult(null);
      setStatusMessage({ type: 'success', text: 'Reset to default Gateway endpoint.' });
      setTimeout(() => {
        setIsSaving(false);
      }, 400);
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage({ type: 'error', text: err?.message || 'Reset failed.' });
    }
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content
        className="w-full max-w-lg bg-popover border border-border p-0 overflow-hidden rounded-2xl flex-col"
        style={{ height: modalHeight }}
      >
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
              {activeTab === 'gateway' ? (
                <Globe size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              ) : (
                <Bell size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              )}
            </View>
            <View className="flex-1">
              <Dialog.Title className="text-base font-semibold text-foreground">
                Push & Server Settings
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
                {activeTab === 'gateway'
                  ? 'Manage endpoint hubs and compute node routing'
                  : 'Configure lock-screen push and background alerts'}
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

        {/* PanelUI Tabs Navigation */}
        <View className="px-4 pt-3 pb-2 bg-surface border-b border-border">
          <Tabs
            defaultValue="gateway"
            value={activeTab}
            size="xs"
            onValueChange={(val) => {
              const tab = val as 'gateway' | 'notifications';
              setActiveTab(tab);
              if (tab === 'notifications' && !isExpoGo && !isPushRegistered) {
                registerPushNotifications().catch(() => {});
              }
            }}
            className="w-full"
          >
            <Tabs.List className="w-full bg-surface-secondary border border-border p-1 rounded-xl">
              <Tabs.Trigger
                value="gateway"
                className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
              >
                <Globe
                  size={13}
                  color={activeTab === 'gateway' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'}
                />
                <Text
                  className={cn(
                    'text-xs font-medium',
                    activeTab === 'gateway' ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  Gateway Hub
                </Text>
              </Tabs.Trigger>

              <Tabs.Trigger
                value="notifications"
                className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
              >
                <Bell
                  size={13}
                  color={activeTab === 'notifications' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'}
                />
                <Text
                  className={cn(
                    'text-xs font-medium',
                    activeTab === 'notifications' ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  Push Alerts
                </Text>
                {isPushRegistered && (
                  <View className="w-1.5 h-1.5 rounded-full bg-success ml-1" />
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        {/* Scrollable Tab Content */}
        <ScrollView
          className="flex-1"
          style={{ flex: 1 }}
          contentContainerClassName="p-4 pb-6 gap-3.5"
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'gateway' ? (
            /* TAB 1: GATEWAY HUB */
            <>
              {/* Connection Info Banner */}
              <Card className="p-3 bg-surface border border-border rounded-xl flex-row items-start gap-2.5">
                <Radio size={14} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-foreground mb-0.5">
                    Central Relay Hub
                  </Text>
                  <Text className="text-xs text-muted-foreground leading-relaxed">
                    Routes WebSocket relay communication, live terminal streams, tool approvals, and physical push alerts to your device.
                  </Text>
                </View>
              </Card>

              {/* Quick Presets */}
              <View>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Quick Presets
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {[
                    { label: 'Cloud Gateway', url: 'https://gateway.cloud-agent.abhishekkkk.in' },
                    { label: 'ngrok Tunnel', url: 'https://unushered-chantal-unpsychotic.ngrok-free.dev' },
                    { label: 'Localhost (:8080)', url: 'http://127.0.0.1:8080' },
                    { label: 'Android Emulator', url: 'http://10.0.2.2:8080' },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="xs"
                      onPress={() => handleApplyPreset(preset.url)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </View>
              </View>

              {/* Gateway URL Field */}
              <View>
                <View className="flex-row items-center gap-1.5 mb-1.5">
                  <Database size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-semibold text-foreground">
                    Gateway Server URL
                  </Text>
                </View>
                <Input
                  value={inputGatewayUrl}
                  onChangeText={(t) => {
                    setInputGatewayUrl(t);
                    setTestResult(null);
                  }}
                  placeholder="https://..."
                  size="sm"
                  variant="outline"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="font-mono text-xs mb-2"
                />
                <View className="flex-row items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onPress={handleTest}
                    disabled={isTesting || !inputGatewayUrl.trim()}
                    className="flex-row items-center gap-1.5"
                  >
                    {isTesting ? (
                      <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                    ) : (
                      <>
                        <Zap size={12} color={isLight ? '#262626' : '#f5f5f5'} />
                        <Text className="text-xs font-medium text-foreground">Test Endpoint</Text>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    onPress={handleReset}
                    disabled={isSaving}
                  >
                    Reset Default
                  </Button>
                </View>
              </View>

              {/* Feedback Status */}
              {statusMessage && (
                <Card
                  className={cn(
                    'p-2.5 rounded-lg flex-row items-center gap-2',
                    statusMessage.type === 'success'
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-destructive/10 border border-destructive/20'
                  )}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 size={14} color="#10b981" />
                  ) : (
                    <XCircle size={14} color="#ef4444" />
                  )}
                  <Text
                    className={cn(
                      'text-xs font-medium flex-1',
                      statusMessage.type === 'success' ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {statusMessage.text}
                  </Text>
                </Card>
              )}
            </>
          ) : (
            /* TAB 2: PUSH NOTIFICATIONS */
            <>
              {/* Notification Engine Status Card */}
              <Card className="p-3.5 bg-surface border border-border rounded-xl">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <View className="w-7 h-7 rounded-lg bg-surface-secondary items-center justify-center border border-border">
                      <Smartphone size={15} color={isLight ? '#262626' : '#f5f5f5'} />
                    </View>
                    <View>
                      <Text className="text-xs font-semibold text-foreground">
                        Push Engine Status
                      </Text>
                      <Text className="text-[11px] text-muted-foreground">
                        {Platform.OS === 'android' ? 'Android (FCM)' : Platform.OS === 'ios' ? 'iOS (APNs)' : 'Web Client'}
                      </Text>
                    </View>
                  </View>

                  <Badge
                    variant={isPushRegistered ? 'success' : isExpoGo ? 'warning' : isSyncingPush ? 'outline' : 'secondary'}
                    size="sm"
                    className="px-2 py-0.5"
                  >
                    <Text className="text-[11px] font-medium">
                      {isPushRegistered ? 'Active & Synced' : isExpoGo ? 'Expo Go Preview' : isSyncingPush ? 'Syncing...' : 'Standby'}
                    </Text>
                  </Badge>
                </View>

                <Text className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {pushStatus || (isPushRegistered ? 'Registered with Gateway and ready for notifications.' : 'Initializing notification engine...')}
                </Text>

                {/* Engine Specs Bento */}
                <View className="p-2.5 rounded-lg bg-surface-secondary border border-border gap-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted-foreground">Runtime Environment</Text>
                    <Text className="text-[11px] font-mono font-medium text-foreground">
                      {isExpoGo ? 'Expo Go Client' : 'Standalone / Dev APK'}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted-foreground">Priority Channel</Text>
                    <Text className="text-[11px] font-mono font-medium text-success">
                      agent-alerts (MAX)
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] text-muted-foreground">Lock-Screen Actions</Text>
                    <Text className="text-[11px] font-mono font-medium text-primary">
                      APPROVE / REJECT
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Expo Push Token Card */}
              <Card className="p-3.5 bg-surface border border-border rounded-xl">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Key size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-semibold text-foreground">
                      Device Push Token
                    </Text>
                  </View>

                  {pushToken && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onPress={handleCopyToken}
                      className="flex-row items-center gap-1 px-1.5 py-0.5 h-6"
                    >
                      {tokenCopied ? (
                        <>
                          <Check size={11} color="#10b981" />
                          <Text className="text-[11px] font-medium text-success">Copied</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={11} color={isLight ? '#686868' : '#a3a3a3'} />
                          <Text className="text-[11px] font-medium text-muted-foreground">Copy</Text>
                        </>
                      )}
                    </Button>
                  )}
                </View>

                <View className="p-2.5 rounded-lg bg-surface-secondary border border-border mb-2.5">
                  <Text
                    className={cn(
                      'text-xs font-mono select-all leading-relaxed',
                      pushToken ? 'text-foreground' : 'text-muted-foreground italic'
                    )}
                    numberOfLines={2}
                    selectable
                  >
                    {pushToken || (isExpoGo ? 'In-app toasts active. Lock-screen push requires Dev APK.' : 'No push token available')}
                  </Text>
                </View>

                {isExpoGo ? (
                  <View className="flex-row items-start gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle size={13} color="#f59e0b" style={{ marginTop: 1 }} />
                    <Text className="text-[11px] text-warning flex-1 leading-snug">
                      Expo Go handles in-app toasts. For true physical device lock-screen push notifications with screen off, run an APK preview build.
                    </Text>
                  </View>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    onPress={handleSyncPush}
                    disabled={isSyncingPush}
                    className="self-start flex-row items-center gap-1.5"
                  >
                    {isSyncingPush ? (
                      <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                    ) : (
                      <>
                        <RefreshCw size={11} color={isLight ? '#262626' : '#f5f5f5'} />
                        <Text className="text-xs font-medium text-foreground">Re-sync Device Token</Text>
                      </>
                    )}
                  </Button>
                )}
              </Card>

              {/* Android Channels & Lock-Screen Capabilities */}
              <Card className="p-3.5 bg-surface border border-border rounded-xl">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <ShieldAlert size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-semibold text-foreground">
                    Interactive Lock-Screen Actions
                  </Text>
                </View>

                <Text className="text-xs text-muted-foreground leading-relaxed mb-3">
                  When an agent requests command authorization or bash access, actionable buttons appear directly in the notification shade:
                </Text>

                {/* Simulated Notification Item */}
                <View className="p-3 rounded-xl bg-surface-secondary border border-border">
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center gap-1.5">
                      <ShieldAlert size={12} color="#ef4444" />
                      <Text className="text-xs font-semibold text-foreground">
                        Security Approval Required
                      </Text>
                    </View>
                    <Text className="text-[10px] font-mono text-muted-foreground">now</Text>
                  </View>
                  <Text className="text-[11px] text-muted-foreground font-mono mb-2.5">
                    run_command: git checkout -b feat/redesign
                  </Text>

                  {/* Lockscreen Actions Simulation */}
                  <View className="flex-row items-center gap-2 pt-2 border-t border-border">
                    <View className="px-2.5 py-1 rounded-md bg-success/15 border border-success/30 flex-row items-center gap-1">
                      <Check size={11} color="#10b981" />
                      <Text className="text-[11px] font-semibold text-success">Approve</Text>
                    </View>
                    <View className="px-2.5 py-1 rounded-md bg-destructive/15 border border-destructive/30 flex-row items-center gap-1">
                      <X size={11} color="#ef4444" />
                      <Text className="text-[11px] font-semibold text-destructive">Reject</Text>
                    </View>
                  </View>
                </View>
              </Card>

              {/* Notification Preferences */}
              <Card className="p-3.5 bg-surface border border-border rounded-xl">
                <Text className="text-xs font-semibold text-foreground mb-2.5">
                  Notification Triggers
                </Text>

                <View className="gap-3">
                  {/* Security Approvals */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-1.5">
                        <ShieldAlert size={12} color="#ef4444" />
                        <Text className="text-xs font-medium text-foreground">
                          Security Approvals
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        Alert instantly when agents request bash execution or tool access
                      </Text>
                    </View>
                    <Switch
                      size="sm"
                      value={notifyApprovals}
                      onValueChange={(val) => setNotificationPreference('notifyApprovals', val)}
                    />
                  </View>

                  <View className="h-px bg-border" />

                  {/* Turn Completion */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-1.5">
                        <Sparkles size={12} color="#10b981" />
                        <Text className="text-xs font-medium text-foreground">
                          Turn Completion
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        Alert when long-running agent completes requested task
                      </Text>
                    </View>
                    <Switch
                      size="sm"
                      value={notifyTurnComplete}
                      onValueChange={(val) => setNotificationPreference('notifyTurnComplete', val)}
                    />
                  </View>

                  <View className="h-px bg-border" />

                  {/* Errors & Incidents */}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center gap-1.5">
                        <AlertTriangle size={12} color="#ef4444" />
                        <Text className="text-xs font-medium text-foreground">
                          Agent Errors & Incidents
                        </Text>
                      </View>
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        Alert when execution fails or on-call incidents trigger
                      </Text>
                    </View>
                    <Switch
                      size="sm"
                      value={notifyErrors}
                      onValueChange={(val) => setNotificationPreference('notifyErrors', val)}
                    />
                  </View>
                </View>
              </Card>

              {/* Test Trigger Button & Feedback */}
              <View className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleTestPush}
                  disabled={isSendingTestPush}
                  className="w-full flex-row items-center justify-center gap-2 py-2.5"
                >
                  {isSendingTestPush ? (
                    <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                  ) : (
                    <>
                      <BellRing size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                      <Text className="text-xs font-semibold text-foreground">
                        Send Test Push Notification
                      </Text>
                    </>
                  )}
                </Button>

                {pushFeedbackMessage && (
                  <Card
                    className={cn(
                      'p-2.5 rounded-lg mt-2.5 flex-row items-center gap-2',
                      pushFeedbackMessage.type === 'success'
                        ? 'bg-success/10 border border-success/20'
                        : 'bg-destructive/10 border border-destructive/20'
                    )}
                  >
                    {pushFeedbackMessage.type === 'success' ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : (
                      <XCircle size={14} color="#ef4444" />
                    )}
                    <Text
                      className={cn(
                        'text-xs font-medium flex-1',
                        pushFeedbackMessage.type === 'success' ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {pushFeedbackMessage.text}
                    </Text>
                  </Card>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="p-3 border-t border-border bg-surface flex-row items-center justify-end gap-2">
          {activeTab === 'gateway' ? (
            <>
              <Button variant="outline" size="sm" onPress={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={handleSave}
                disabled={isSaving || !inputGatewayUrl.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={isLight ? '#fafafa' : '#262626'} />
                ) : (
                  'Save & Reconnect'
                )}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onPress={onClose}>
              Done
            </Button>
          )}
        </View>
      </Dialog.Content>
    </Dialog>
  );
};

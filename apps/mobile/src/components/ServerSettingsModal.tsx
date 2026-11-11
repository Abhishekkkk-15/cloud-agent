import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Dialog,
  Button,
  Input,
  Badge,
  Card,
  Text,
  cn,
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
} from './Icons';
import { useDaemonStore, type EndpointTestResult } from '../stores/useDaemonStore';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const currentGatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const setServerEndpoints = useDaemonStore((s) => s.setServerEndpoints);
  const resetServerEndpoints = useDaemonStore((s) => s.resetServerEndpoints);
  const testServerEndpoints = useDaemonStore((s) => s.testServerEndpoints);
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const triggerTestPushNotification = useDaemonStore((s) => s.triggerTestPushNotification);
  const registerPushNotifications = useDaemonStore((s) => s.registerPushNotifications);

  const [inputGatewayUrl, setInputGatewayUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setInputGatewayUrl(currentGatewayUrl);
      setTestResult(null);
      setStatusMessage(null);
    }
  }, [visible, currentGatewayUrl]);

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
    setStatusMessage(null);
    try {
      const res = await triggerTestPushNotification();
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Push test failed.' });
    } finally {
      setIsSendingTestPush(false);
    }
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
      <Dialog.Content className="w-full max-w-md bg-popover border border-border p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
              <Globe size={16} color={isLight ? '#262626' : '#f5f5f5'} />
            </View>
            <View className="flex-1">
              <Dialog.Title className="text-base font-semibold text-foreground">
                Gateway & Push Settings
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
                Manage endpoint hubs and background notifications
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

        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Connection Info Banner */}
          <Card className="p-3 mb-3 bg-surface border border-border rounded-xl flex-row items-start gap-2.5">
            <Radio size={14} color={isLight ? '#262626' : '#f5f5f5'} style={{ marginTop: 2 }} />
            <Text className="text-xs text-muted-foreground flex-1 leading-relaxed">
              Gateway endpoint used to sync sessions, telemetry, and compute nodes.
            </Text>
          </Card>

          {/* Quick Presets */}
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Quick Presets
          </Text>
          <View className="flex-row flex-wrap gap-1.5 mb-3">
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

          {/* Gateway URL Field */}
          <View className="mb-3">
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
                'p-2.5 rounded-lg mb-3 flex-row items-center gap-2',
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

          {/* Push Notification Controls */}
          <View className="pt-3 border-t border-border mt-1">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-1.5">
                <Bell size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                <Text className="text-xs font-semibold text-foreground">
                  Push Notifications
                </Text>
              </View>
              <Badge
                variant={isPushRegistered ? 'success' : 'secondary'}
                size="sm"
                className="px-1.5 py-0"
              >
                <Text className="text-[11px] font-medium">
                  {isPushRegistered ? 'Registered' : 'Not Registered'}
                </Text>
              </Badge>
            </View>

            <View className="flex-row items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onPress={handleTestPush}
                disabled={isSendingTestPush}
                className="flex-1"
              >
                {isSendingTestPush ? (
                  <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                ) : (
                  'Send Test Notification'
                )}
              </Button>
              {!isPushRegistered && (
                <Button
                  variant="secondary"
                  size="xs"
                  onPress={() => registerPushNotifications()}
                  className="flex-1"
                >
                  Register Device
                </Button>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View className="p-3 border-t border-border bg-surface flex-row items-center justify-end gap-2">
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
        </View>
      </Dialog.Content>
    </Dialog>
  );
};

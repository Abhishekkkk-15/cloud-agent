import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Dialog,
  Tabs,
  Button,
  Input,
  Card,
  Text,
  cn,
} from 'panelui-native';
import {
  X,
  Server,
  Copy,
  Check,
  Terminal,
  CheckCircle2,
  Camera,
  Code2,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

interface PairMachineModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'scan' | 'code' | 'cli';

export const PairMachineModal: React.FC<PairMachineModalProps> = ({
  visible,
  onClose,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const generateMachinePairingToken = useDaemonStore((s) => s.generateMachinePairingToken);
  const claimPairingSession = useDaemonStore((s) => s.claimPairingSession);
  const pairWithPayload = useDaemonStore((s) => s.pairWithPayload);

  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Claiming state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    machineName: string;
    message: string;
  } | null>(null);

  // Code input tab
  const [codeInput, setCodeInput] = useState('');

  // CLI / manual tab state
  const [isLoadingCli, setIsLoadingCli] = useState(false);
  const [cliPairingData, setCliPairingData] = useState<{
    token: string;
    installCommand: string;
    instructions: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [isPairingPaste, setIsPairingPaste] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<{ success?: boolean; text: string } | null>(null);

  const isScanningRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setIsClaiming(false);
      setClaimError(null);
      setSuccessResult(null);
      setCodeInput('');
      setPasteInput('');
      setPasteFeedback(null);
      setCameraError(null);
      isScanningRef.current = false;
      setActiveTab('scan');
    } else {
      setCliPairingData(null);
      setCopied(false);
    }
  }, [visible]);

  // Load CLI token only when user navigates to the 'cli' tab
  useEffect(() => {
    if (visible && activeTab === 'cli' && !cliPairingData && !isLoadingCli) {
      loadCliToken();
    }
  }, [visible, activeTab]);

  const loadCliToken = async () => {
    setIsLoadingCli(true);
    const data = await generateMachinePairingToken();
    setCliPairingData(data);
    setIsLoadingCli(false);
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (isScanningRef.current || isClaiming || successResult) return;
    if (!data || !data.trim()) return;

    isScanningRef.current = true;
    setIsClaiming(true);
    setClaimError(null);

    try {
      const res = await claimPairingSession(data);
      if (res.success) {
        setSuccessResult({
          machineName: res.machine?.name || 'Local Machine',
          message: res.message,
        });
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setClaimError(res.message);
        setTimeout(() => {
          isScanningRef.current = false;
        }, 3000);
      }
    } catch (err: any) {
      setClaimError(err?.message || 'Failed to claim machine');
      setTimeout(() => {
        isScanningRef.current = false;
      }, 3000);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCodeSubmit = async () => {
    const raw = codeInput.trim();
    if (!raw || isClaiming) return;

    setIsClaiming(true);
    setClaimError(null);

    try {
      const res = await claimPairingSession(raw);
      if (res.success) {
        setSuccessResult({
          machineName: res.machine?.name || 'Local Machine',
          message: res.message,
        });
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setClaimError(res.message);
      }
    } catch (err: any) {
      setClaimError(err?.message || 'Failed to claim pairing code');
    } finally {
      setIsClaiming(false);
    }
  };

  const handlePairPaste = async () => {
    if (!pasteInput.trim() || isPairingPaste) return;
    setIsPairingPaste(true);
    setPasteFeedback(null);

    const res = await pairWithPayload(pasteInput.trim());
    setIsPairingPaste(false);
    setPasteFeedback({
      success: res.success,
      text: res.message,
    });
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content className="w-full max-w-md bg-popover border border-border p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
              <Server size={16} color={isLight ? '#262626' : '#f5f5f5'} />
            </View>
            <View className="flex-1">
              <Dialog.Title className="text-base font-semibold text-foreground">
                Pair Compute Node
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
                Link your local computer, workstation, or remote VPS
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

        {/* Content Body */}
        {successResult ? (
          <View className="p-6 items-center justify-center">
            <View className="w-14 h-14 rounded-full bg-success/10 border border-success/20 items-center justify-center mb-3">
              <CheckCircle2 size={32} color="#10b981" />
            </View>
            <Text className="text-base font-semibold text-foreground mb-1 text-center">
              Node Paired Successfully!
            </Text>
            <Text className="text-xs text-muted-foreground text-center">
              {successResult.machineName} is now linked and ready.
            </Text>
          </View>
        ) : (
          <ScrollView
            className="max-h-[75vh]"
            contentContainerClassName="p-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Tabs */}
            <Tabs
              defaultValue="scan"
              value={activeTab}
              size="xs"
              onValueChange={(val) => {
                setActiveTab(val as TabType);
                setClaimError(null);
                isScanningRef.current = false;
              }}
              className="w-full mb-3"
            >
              <Tabs.List className="w-full bg-surface-secondary border border-border p-1 rounded-xl flex-row">
                <Tabs.Trigger
                  value="scan"
                  icon={<Camera size={13} color={activeTab === 'scan' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />}
                  className="flex-1 px-1 py-1"
                  labelClassName="text-xs font-medium"
                >
                  Scan QR
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="code"
                  icon={<Code2 size={13} color={activeTab === 'code' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />}
                  className="flex-1 px-1 py-1"
                  labelClassName="text-xs font-medium"
                >
                  Pair Code
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="cli"
                  icon={<Terminal size={13} color={activeTab === 'cli' ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />}
                  className="flex-1 px-1 py-1"
                  labelClassName="text-xs font-medium"
                >
                  CLI / VPS
                </Tabs.Trigger>
              </Tabs.List>

              {/* 1. Camera Scan Tab */}
              <Tabs.Content value="scan" className="mt-2">
                <Text className="text-xs text-muted-foreground mb-2.5">
                  Run <Text className="font-mono text-foreground font-semibold">ca pair</Text> in your terminal and point the camera at the QR code:
                </Text>

                <View className="w-full h-56 rounded-xl overflow-hidden bg-surface-secondary border border-border items-center justify-center relative">
                  {!permission ? (
                    <View className="items-center p-4">
                      <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                      <Text className="text-xs text-muted-foreground mt-2">Checking camera permissions...</Text>
                    </View>
                  ) : !permission.granted ? (
                    <View className="items-center p-4 max-w-xs">
                      <Camera size={26} color={isLight ? '#686868' : '#a3a3a3'} />
                      <Text className="text-sm font-semibold text-foreground mt-2 text-center">
                        Camera Access Required
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-1 mb-3 text-center">
                        Enable camera access to scan pairing QR codes from your terminal.
                      </Text>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={requestPermission}
                        className="w-full mb-1.5"
                      >
                        Grant Camera Access
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onPress={() => setActiveTab('code')}
                      >
                        Or enter 6-digit code manually
                      </Button>
                    </View>
                  ) : cameraError ? (
                    <View className="items-center p-4">
                      <Text className="text-sm font-semibold text-foreground mb-1">Camera Unavailable</Text>
                      <Text className="text-xs text-muted-foreground mb-3">{cameraError}</Text>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => setActiveTab('code')}
                      >
                        Enter Code Manually
                      </Button>
                    </View>
                  ) : (
                    <View className="w-full h-full relative">
                      <CameraView
                        style={{ width: '100%', height: '100%' }}
                        facing="back"
                        barcodeScannerSettings={{
                          barcodeTypes: ['qr'],
                        }}
                        onBarcodeScanned={isClaiming ? undefined : handleBarcodeScanned}
                        onMountError={(e) => setCameraError(e.message)}
                      />
                      {/* Targeting Reticle Frame */}
                      <View className="absolute inset-0 items-center justify-center pointer-events-none">
                        <View className="w-36 h-36 border-2 border-primary/70 rounded-xl" />
                      </View>
                      {isClaiming && (
                        <View className="absolute inset-0 bg-background/80 items-center justify-center gap-2">
                          <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                          <Text className="text-xs font-medium text-foreground">Authorizing compute node...</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {claimError ? (
                  <Card className="mt-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <Text className="text-xs text-destructive font-medium">{claimError}</Text>
                  </Card>
                ) : null}
              </Tabs.Content>

              {/* 2. Enter Code Tab */}
              <Tabs.Content value="code" className="mt-2">
                <Text className="text-xs text-muted-foreground mb-2">
                  Run <Text className="font-mono text-foreground font-semibold">ca pair</Text> in your terminal and enter the 6-character code:
                </Text>

                <Input
                  value={codeInput}
                  onChangeText={(t) => {
                    setCodeInput(t.toUpperCase());
                    if (claimError) setClaimError(null);
                  }}
                  placeholder="CA-XXXX"
                  size="md"
                  variant="outline"
                  autoCapitalize="characters"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleCodeSubmit}
                  className="font-mono tracking-widest text-center text-lg mb-3"
                />

                {claimError ? (
                  <Card className="mb-3 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <Text className="text-xs text-destructive font-medium">{claimError}</Text>
                  </Card>
                ) : null}

                <Button
                  variant="primary"
                  size="md"
                  onPress={handleCodeSubmit}
                  disabled={!codeInput.trim() || isClaiming}
                  className="w-full mb-2"
                >
                  {isClaiming ? (
                    <ActivityIndicator size="small" color={isLight ? '#fafafa' : '#262626'} />
                  ) : (
                    'Authorize & Connect'
                  )}
                </Button>

                <Text className="text-[11px] text-muted-foreground text-center">
                  Codes expire in 10 minutes. If expired, run <Text className="font-mono font-medium">ca pair</Text> again.
                </Text>
              </Tabs.Content>

              {/* 3. Headless / CLI Tab */}
              <Tabs.Content value="cli" className="mt-2">
                {isLoadingCli ? (
                  <View className="py-8 items-center justify-center">
                    <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs text-muted-foreground mt-2">Generating outbound token...</Text>
                  </View>
                ) : cliPairingData ? (
                  <>
                    <Text className="text-xs text-muted-foreground mb-2">
                      For headless remote VPS or cloud servers, start the daemon with this command:
                    </Text>

                    <Card className="p-3 bg-surface-secondary border border-border rounded-xl mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-1.5">
                          <Terminal size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Terminal Command
                          </Text>
                        </View>
                        <Button
                          variant="outline"
                          size="xs"
                          onPress={() => handleCopy(cliPairingData.installCommand)}
                          className="flex-row items-center gap-1 px-2 py-0.5"
                        >
                          {copied ? (
                            <>
                              <Check size={11} color={isLight ? '#262626' : '#f5f5f5'} />
                              <Text className="text-xs font-medium text-foreground">Copied</Text>
                            </>
                          ) : (
                            <>
                              <Copy size={11} color={isLight ? '#686868' : '#a3a3a3'} />
                              <Text className="text-xs font-medium text-muted-foreground">Copy</Text>
                            </>
                          )}
                        </Button>
                      </View>
                      <Text className="text-xs font-mono text-foreground leading-relaxed" selectable>
                        {cliPairingData.installCommand}
                      </Text>
                    </Card>

                    <Text className="text-xs text-muted-foreground mb-1.5">
                      Or paste a machine token or <Text className="font-mono text-foreground">ca_pair://</Text> link:
                    </Text>

                    <Input
                      value={pasteInput}
                      onChangeText={setPasteInput}
                      placeholder="ca_pair://connect?token=... or token"
                      size="sm"
                      variant="outline"
                      autoCapitalize="none"
                      className="mb-2"
                    />

                    {pasteFeedback ? (
                      <Card className={cn('p-2.5 rounded-lg mb-2', pasteFeedback.success ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20')}>
                        <Text className={cn('text-xs font-medium', pasteFeedback.success ? 'text-success' : 'text-destructive')}>
                          {pasteFeedback.text}
                        </Text>
                      </Card>
                    ) : null}

                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={handlePairPaste}
                      disabled={!pasteInput.trim() || isPairingPaste}
                      className="w-full"
                    >
                      {isPairingPaste ? (
                        <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                      ) : (
                        'Connect via Token'
                      )}
                    </Button>
                  </>
                ) : (
                  <View className="py-6 items-center justify-center">
                    <Text className="text-xs text-muted-foreground mb-3 text-center">
                      Failed to generate token. Ensure Gateway is reachable.
                    </Text>
                    <Button variant="outline" size="sm" onPress={loadCliToken}>
                      Retry
                    </Button>
                  </View>
                )}
              </Tabs.Content>
            </Tabs>

            {/* Connection Status Indicator */}
            <View className="pt-3 border-t border-border flex-row items-center justify-between mt-2">
              <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                {connectionState === 'connected' ? (
                  <>
                    <View className="w-2 h-2 rounded-full bg-success" />
                    <Text className="text-xs text-foreground font-medium" numberOfLines={1}>
                      Connected: {activeMachine?.name || 'Online'}
                    </Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="small" color={isLight ? '#686868' : '#a3a3a3'} style={{ transform: [{ scale: 0.65 }] }} />
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      Ready for node connection...
                    </Text>
                  </>
                )}
              </View>
              <Button variant="ghost" size="xs" onPress={onClose}>
                Close
              </Button>
            </View>
          </ScrollView>
        )}
      </Dialog.Content>
    </Dialog>
  );
};

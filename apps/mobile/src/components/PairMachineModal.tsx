import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  X,
  Server,
  Copy,
  Check,
  Terminal,
  QrCode,
  Link,
  CheckCircle2,
  Camera,
  Code2,
  RefreshCw,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
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
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconBox}>
              <Server size={18} color="#f0f6fc" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pair a Machine</Text>
              <Text style={styles.subtitle}>Link your local computer, workstation, or VPS</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#8b949e" />
            </TouchableOpacity>
          </View>

          {/* Success Overlay state */}
          {successResult ? (
            <View style={styles.successContainer}>
              <View style={styles.successIconBox}>
                <CheckCircle2 size={38} color="#0077b6" />
              </View>
              <Text style={styles.successTitle}>Machine Paired!</Text>
              <Text style={styles.successSubtitle}>
                {successResult.machineName} is now linked and starting up.
              </Text>
            </View>
          ) : (
            <>
              {/* Tab Selector */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'scan' && styles.tabItemActive]}
                  onPress={() => {
                    setActiveTab('scan');
                    setClaimError(null);
                    isScanningRef.current = false;
                  }}
                  activeOpacity={0.7}
                >
                  <Camera
                    size={14}
                    color={activeTab === 'scan' ? '#f0f6fc' : '#8b949e'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === 'scan' && styles.tabLabelActive,
                    ]}
                  >
                    Scan QR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'code' && styles.tabItemActive]}
                  onPress={() => {
                    setActiveTab('code');
                    setClaimError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Code2
                    size={14}
                    color={activeTab === 'code' ? '#f0f6fc' : '#8b949e'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === 'code' && styles.tabLabelActive,
                    ]}
                  >
                    Enter Code
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabItem, activeTab === 'cli' && styles.tabItemActive]}
                  onPress={() => {
                    setActiveTab('cli');
                    setClaimError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Terminal
                    size={14}
                    color={activeTab === 'cli' ? '#f0f6fc' : '#8b949e'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      activeTab === 'cli' && styles.tabLabelActive,
                    ]}
                  >
                    Headless / CLI
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Body */}
              <View style={styles.body}>
                {/* 1. Camera Scan Tab */}
                {activeTab === 'scan' ? (
                  <View style={styles.scannerWrapper}>
                    <Text style={styles.tabInstruction}>
                      Run <Text style={styles.codeBadge}>ca pair</Text> in your terminal and point camera at the QR code.
                    </Text>

                    <View style={styles.cameraBox}>
                      {!permission ? (
                        <View style={styles.cameraFallbackBox}>
                          <ActivityIndicator size="small" color="#0077b6" />
                          <Text style={styles.cameraFallbackText}>Checking camera permissions...</Text>
                        </View>
                      ) : !permission.granted ? (
                        <View style={styles.cameraFallbackBox}>
                          <View style={styles.permIconBox}>
                            <Camera size={26} color="#c9d1d9" />
                          </View>
                          <Text style={styles.cameraFallbackTitle}>Camera Access Required</Text>
                          <Text style={styles.cameraFallbackText}>
                            Enable camera access to scan pairing QR codes from your terminal.
                          </Text>
                          <TouchableOpacity
                            style={styles.grantPermBtn}
                            onPress={requestPermission}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.grantPermBtnText}>Grant Camera Access</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.switchCodeBtn}
                            onPress={() => setActiveTab('code')}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.switchCodeBtnText}>Or enter 6-digit code manually</Text>
                          </TouchableOpacity>
                        </View>
                      ) : cameraError ? (
                        <View style={styles.cameraFallbackBox}>
                          <Text style={styles.cameraFallbackTitle}>Camera Unavailable</Text>
                          <Text style={styles.cameraFallbackText}>{cameraError}</Text>
                          <TouchableOpacity
                            style={styles.grantPermBtn}
                            onPress={() => setActiveTab('code')}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.grantPermBtnText}>Enter Code Manually</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.cameraContainer}>
                          <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            barcodeScannerSettings={{
                              barcodeTypes: ['qr'],
                            }}
                            onBarcodeScanned={isClaiming ? undefined : handleBarcodeScanned}
                            onMountError={(e) => setCameraError(e.message)}
                          />

                          {/* Scanner Target Frame */}
                          <View style={styles.scannerOverlay}>
                            <View style={styles.scannerTargetBox}>
                              <View style={[styles.cornerGuide, styles.cornerTL]} />
                              <View style={[styles.cornerGuide, styles.cornerTR]} />
                              <View style={[styles.cornerGuide, styles.cornerBL]} />
                              <View style={[styles.cornerGuide, styles.cornerBR]} />
                            </View>
                          </View>

                          {isClaiming && (
                            <View style={styles.scannerLoadingMask}>
                              <ActivityIndicator size="small" color="#0077b6" />
                              <Text style={styles.scannerLoadingText}>Authorizing machine...</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {claimError ? (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{claimError}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* 2. Enter Code Tab */}
                {activeTab === 'code' ? (
                  <View style={styles.codeTabContent}>
                    <Text style={styles.tabInstruction}>
                      Run <Text style={styles.codeBadge}>ca pair</Text> in your terminal and enter the 6-character code:
                    </Text>

                    <View style={styles.codeInputWrapper}>
                      <TextInput
                        style={styles.codeInput}
                        value={codeInput}
                        onChangeText={(t) => {
                          setCodeInput(t.toUpperCase());
                          if (claimError) setClaimError(null);
                        }}
                        placeholder="CA-XXXX"
                        placeholderTextColor="#484f58"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={10}
                        returnKeyType="done"
                        onSubmitEditing={handleCodeSubmit}
                      />
                    </View>

                    {claimError ? (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{claimError}</Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        (!codeInput.trim() || isClaiming) && styles.primaryActionBtnDisabled,
                      ]}
                      onPress={handleCodeSubmit}
                      disabled={!codeInput.trim() || isClaiming}
                      activeOpacity={0.8}
                    >
                      {isClaiming ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Authorize & Connect</Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.hintText}>
                      Tip: The code expires in 10 minutes. If expired, run <Text style={styles.codeBadge}>ca pair</Text> again.
                    </Text>
                  </View>
                ) : null}

                {/* 3. Headless / CLI Tab */}
                {activeTab === 'cli' ? (
                  <View style={styles.cliTabContent}>
                    {isLoadingCli ? (
                      <View style={styles.loadingCliBox}>
                        <ActivityIndicator size="small" color="#0077b6" />
                        <Text style={styles.loadingCliText}>Generating outbound token...</Text>
                      </View>
                    ) : cliPairingData ? (
                      <>
                        <Text style={styles.tabInstruction}>
                          For headless remote VPS or cloud servers, start the daemon with this command:
                        </Text>

                        <View style={styles.codeSnippetBox}>
                          <View style={styles.codeSnippetHeader}>
                            <Terminal size={12} color="#8b949e" />
                            <Text style={styles.codeSnippetTitle}>Terminal Command</Text>
                            <TouchableOpacity
                              style={styles.copyPillBtn}
                              onPress={() => handleCopy(cliPairingData.installCommand)}
                              activeOpacity={0.7}
                            >
                              {copied ? (
                                <>
                                  <Check size={12} color="#f0f6fc" />
                                  <Text style={[styles.copyPillBtnText, { color: '#f0f6fc' }]}>
                                    Copied
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} color="#8b949e" />
                                  <Text style={styles.copyPillBtnText}>Copy</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                          <Text style={styles.codeSnippetText} selectable>
                            {cliPairingData.installCommand}
                          </Text>
                        </View>

                        {/* Paste token or connect URL */}
                        <Text style={[styles.tabInstruction, { marginTop: 8 }]}>
                          Or paste a machine token or <Text style={styles.codeBadge}>ca_pair://</Text> link:
                        </Text>

                        <View style={styles.pasteBox}>
                          <TextInput
                            style={styles.pasteInput}
                            value={pasteInput}
                            onChangeText={setPasteInput}
                            placeholder="ca_pair://connect?token=... or token"
                            placeholderTextColor="#484f58"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        {pasteFeedback ? (
                          <View
                            style={[
                              styles.feedbackBox,
                              pasteFeedback.success
                                ? styles.feedbackSuccess
                                : styles.feedbackError,
                            ]}
                          >
                            <Text
                              style={[
                                styles.feedbackText,
                                pasteFeedback.success
                                  ? styles.feedbackTextSuccess
                                  : styles.feedbackTextError,
                              ]}
                            >
                              {pasteFeedback.text}
                            </Text>
                          </View>
                        ) : null}

                        <TouchableOpacity
                          style={[
                            styles.pasteConnectBtn,
                            (!pasteInput.trim() || isPairingPaste) && styles.pasteConnectBtnDisabled,
                          ]}
                          onPress={handlePairPaste}
                          disabled={!pasteInput.trim() || isPairingPaste}
                          activeOpacity={0.8}
                        >
                          {isPairingPaste ? (
                            <ActivityIndicator size="small" color="#f0f6fc" />
                          ) : (
                            <Text style={styles.pasteConnectBtnText}>Connect via Token</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.cliErrorBox}>
                        <Text style={styles.cliErrorText}>
                          Failed to generate outbound token. Ensure Gateway is reachable.
                        </Text>
                        <TouchableOpacity
                          style={styles.retryBtn}
                          onPress={loadCliToken}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Machine Connection Status Bar */}
                <View style={styles.connectionStatusBar}>
                  {connectionState === 'connected' ? (
                    <View style={styles.statusConnectedRow}>
                      <CheckCircle2 size={15} color="#0077b6" />
                      <Text style={styles.statusConnectedText}>
                        Machine connected: {activeMachine?.name || 'Online'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.statusWaitingRow}>
                      <ActivityIndicator
                        size="small"
                        color="#8b949e"
                        style={{ transform: [{ scale: 0.75 }] }}
                      />
                      <Text style={styles.statusWaitingText}>
                        Ready for daemon connection...
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.doneBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0d1117',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#010409',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0077b6',
  },
  tabLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#f0f6fc',
  },
  body: {
    padding: 16,
  },
  tabInstruction: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  codeBadge: {
    color: '#48cae4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
  },
  scannerWrapper: {
    alignItems: 'center',
  },
  cameraBox: {
    width: '100%',
    height: 250,
    borderRadius: radii.md,
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    marginBottom: 12,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  scannerTargetBox: {
    width: 170,
    height: 170,
    position: 'relative',
  },
  cornerGuide: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#0077b6',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  scannerLoadingMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13, 17, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scannerLoadingText: {
    fontSize: 12,
    color: '#f0f6fc',
    fontWeight: '600',
  },
  cameraFallbackBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  permIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cameraFallbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
    textAlign: 'center',
  },
  cameraFallbackText: {
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 18,
  },
  grantPermBtn: {
    marginTop: 8,
    backgroundColor: '#0077b6',
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  grantPermBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  switchCodeBtn: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  switchCodeBtnText: {
    color: '#48cae4',
    fontSize: 12,
    fontWeight: '500',
  },
  codeTabContent: {
    paddingVertical: 6,
  },
  codeInputWrapper: {
    backgroundColor: '#010409',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0f6fc',
    textAlign: 'center',
    fontFamily: typography.mono,
    letterSpacing: 4,
  },
  primaryActionBtn: {
    backgroundColor: '#0077b6',
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryActionBtnDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 11,
    color: '#6e7681',
    textAlign: 'center',
    lineHeight: 16,
  },
  cliTabContent: {
    paddingVertical: 4,
  },
  loadingCliBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  loadingCliText: {
    fontSize: 12,
    color: '#8b949e',
  },
  codeSnippetBox: {
    backgroundColor: '#010409',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    marginBottom: 10,
  },
  codeSnippetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  codeSnippetTitle: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
    flex: 1,
    marginLeft: 6,
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#21262d',
    borderRadius: 4,
  },
  copyPillBtnText: {
    fontSize: 11,
    color: '#c9d1d9',
  },
  codeSnippetText: {
    padding: 10,
    fontFamily: typography.mono,
    fontSize: 11,
    color: '#f0f6fc',
    lineHeight: 16,
  },
  pasteBox: {
    backgroundColor: '#010409',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  pasteInput: {
    fontSize: 11,
    color: '#f0f6fc',
    fontFamily: typography.mono,
  },
  pasteConnectBtn: {
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.md,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pasteConnectBtnDisabled: {
    opacity: 0.5,
  },
  pasteConnectBtnText: {
    color: '#f0f6fc',
    fontSize: 12,
    fontWeight: '600',
  },
  cliErrorBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  cliErrorText: {
    color: '#f85149',
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderRadius: radii.sm,
  },
  retryBtnText: {
    color: '#f0f6fc',
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.40)',
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    width: '100%',
  },
  errorBannerText: {
    color: '#f85149',
    fontSize: 11,
    textAlign: 'center',
  },
  feedbackBox: {
    padding: 8,
    borderRadius: radii.sm,
    marginBottom: 10,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.40)',
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.40)',
  },
  feedbackText: {
    fontSize: 11,
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#f0f6fc',
  },
  feedbackTextError: {
    color: '#f85149',
  },
  connectionStatusBar: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  statusConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusConnectedText: {
    fontSize: 12,
    color: '#f0f6fc',
    fontWeight: '600',
  },
  statusWaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusWaitingText: {
    fontSize: 11,
    color: '#8b949e',
  },
  successContainer: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  successSubtitle: {
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#161b22',
    alignItems: 'flex-end',
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderRadius: radii.sm,
  },
  doneBtnText: {
    fontSize: 12,
    color: '#f0f6fc',
    fontWeight: '600',
  },
});

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
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  X,
  Server,
  Copy,
  Check,
  Terminal,
  QrCode,
  Link,
  CheckCircle2,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

interface PairMachineModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'qr' | 'terminal' | 'paste';

export const PairMachineModal: React.FC<PairMachineModalProps> = ({
  visible,
  onClose,
}) => {
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const generateMachinePairingToken = useDaemonStore((s) => s.generateMachinePairingToken);
  const pairWithPayload = useDaemonStore((s) => s.pairWithPayload);

  const [activeTab, setActiveTab] = useState<TabType>('qr');
  const [isLoading, setIsLoading] = useState(false);
  const [pairingData, setPairingData] = useState<{
    token: string;
    installCommand: string;
    instructions: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [isPairingPaste, setIsPairingPaste] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<{ success?: boolean; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      loadToken();
    } else {
      setPairingData(null);
      setCopied(false);
      setPasteInput('');
      setPasteFeedback(null);
      setActiveTab('qr');
    }
  }, [visible]);

  const loadToken = async () => {
    setIsLoading(true);
    const data = await generateMachinePairingToken();
    setPairingData(data);
    setIsLoading(false);
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

  const qrPayload = pairingData
    ? `ca_pair://connect?token=${encodeURIComponent(pairingData.token)}&gateway=${encodeURIComponent(gatewayUrl)}`
    : '';

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
              <Server size={18} color="#0077b6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pair a New Machine</Text>
              <Text style={styles.subtitle}>Link a local workstation, laptop, or VPS</Text>
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

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'qr' && styles.tabItemActive]}
              onPress={() => setActiveTab('qr')}
              activeOpacity={0.7}
            >
              <QrCode
                size={14}
                color={activeTab === 'qr' ? '#f0f6fc' : '#8b949e'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'qr' && styles.tabLabelActive,
                ]}
              >
                QR Code
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'terminal' && styles.tabItemActive]}
              onPress={() => setActiveTab('terminal')}
              activeOpacity={0.7}
            >
              <Terminal
                size={14}
                color={activeTab === 'terminal' ? '#f0f6fc' : '#8b949e'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'terminal' && styles.tabLabelActive,
                ]}
              >
                Terminal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'paste' && styles.tabItemActive]}
              onPress={() => setActiveTab('paste')}
              activeOpacity={0.7}
            >
              <Link
                size={14}
                color={activeTab === 'paste' ? '#f0f6fc' : '#8b949e'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'paste' && styles.tabLabelActive,
                ]}
              >
                Pair URL
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#0077b6" />
                <Text style={styles.loadingText}>Generating secure pairing payload...</Text>
              </View>
            ) : pairingData ? (
              <>
                {/* 1. QR Code Tab */}
                {activeTab === 'qr' ? (
                  <View style={styles.qrContainer}>
                    <View style={styles.qrCodeBox}>
                      <QRCode
                        value={qrPayload}
                        size={170}
                        color="#ffffff"
                        backgroundColor="#010409"
                      />
                    </View>
                    <Text style={styles.instructionText}>
                      Run <Text style={styles.codeHighlight}>ca pair</Text> on your machine or scan this code to link this device.
                    </Text>
                  </View>
                ) : null}

                {/* 2. Terminal Tab */}
                {activeTab === 'terminal' ? (
                  <View style={styles.tabContentBlock}>
                    <Text style={styles.instructionText}>
                      Run this command in the terminal where your Antigravity CLI is installed:
                    </Text>

                    <View style={styles.codeBox}>
                      <View style={styles.codeHeader}>
                        <Terminal size={12} color="#8b949e" />
                        <Text style={styles.codeLang}>Terminal Command</Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => handleCopy(pairingData.installCommand)}
                          activeOpacity={0.7}
                        >
                          {copied ? (
                            <>
                              <Check size={12} color="#0077b6" />
                              <Text style={[styles.copyBtnText, { color: '#0077b6' }]}>
                                Copied
                              </Text>
                            </>
                          ) : (
                            <>
                              <Copy size={12} color="#8b949e" />
                              <Text style={styles.copyBtnText}>Copy</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.codeContent} selectable>
                        {pairingData.installCommand}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* 3. Paste Code Tab */}
                {activeTab === 'paste' ? (
                  <View style={styles.tabContentBlock}>
                    <Text style={styles.instructionText}>
                      Paste a <Text style={styles.codeHighlight}>ca_pair://</Text> URL or raw machine token generated by the daemon:
                    </Text>

                    <View style={styles.pasteInputContainer}>
                      <TextInput
                        style={styles.pasteTextInput}
                        value={pasteInput}
                        onChangeText={setPasteInput}
                        placeholder="ca_pair://connect?token=... or token"
                        placeholderTextColor="#6e7681"
                        autoCapitalize="none"
                        autoCorrect={false}
                        multiline
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
                        styles.pairActionBtn,
                        (!pasteInput.trim() || isPairingPaste) && styles.pairActionBtnDisabled,
                      ]}
                      onPress={handlePairPaste}
                      disabled={!pasteInput.trim() || isPairingPaste}
                      activeOpacity={0.8}
                    >
                      {isPairingPaste ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.pairActionBtnText}>Connect Machine</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Live Status Tracker */}
                <View style={styles.statusBox}>
                  {connectionState === 'connected' ? (
                    <View style={styles.connectedRow}>
                      <CheckCircle2 size={16} color="#0077b6" />
                      <Text style={styles.connectedText}>
                        Machine connected: {activeMachine?.name || 'Online'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.waitingRow}>
                      <ActivityIndicator
                        size="small"
                        color="#0077b6"
                        style={{ transform: [{ scale: 0.8 }] }}
                      />
                      <Text style={styles.waitingText}>
                        Waiting for daemon to dial outbound...
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  Failed to generate token. Ensure Gateway is reachable.
                </Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={loadToken}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0d1117',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
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
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
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
    paddingVertical: 10,
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
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#8b949e',
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  qrCodeBox: {
    backgroundColor: '#010409',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContentBlock: {
    paddingVertical: 4,
  },
  instructionText: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  codeHighlight: {
    color: '#48cae4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  codeBox: {
    backgroundColor: '#010409',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    marginBottom: 14,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  codeLang: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
    flex: 1,
    marginLeft: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#21262d',
    borderRadius: 4,
  },
  copyBtnText: {
    fontSize: 11,
    color: '#c9d1d9',
  },
  codeContent: {
    padding: 10,
    fontFamily: typography.mono,
    fontSize: 12,
    color: '#3fb950',
    lineHeight: 18,
  },
  pasteInputContainer: {
    backgroundColor: '#010409',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 8,
    marginBottom: 10,
  },
  pasteTextInput: {
    height: 70,
    color: '#f0f6fc',
    fontFamily: typography.mono,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  pairActionBtn: {
    backgroundColor: '#0077b6',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pairActionBtnDisabled: {
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
  pairActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackBox: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(35, 134, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(35, 134, 54, 0.4)',
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.4)',
  },
  feedbackText: {
    fontSize: 12,
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#3fb950',
  },
  feedbackTextError: {
    color: '#f85149',
  },
  statusBox: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    fontSize: 12,
    color: '#0077b6',
    fontWeight: '600',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waitingText: {
    fontSize: 12,
    color: '#8b949e',
  },
  errorBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  errorText: {
    color: '#f85149',
    fontSize: 12,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderRadius: 6,
  },
  retryText: {
    color: '#f0f6fc',
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#161b22',
    alignItems: 'flex-end',
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#21262d',
    borderRadius: 6,
  },
  doneBtnText: {
    fontSize: 13,
    color: '#f0f6fc',
    fontWeight: '600',
  },
});

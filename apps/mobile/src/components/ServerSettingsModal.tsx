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
  ScrollView,
} from 'react-native';
import {
  X,
  Globe,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
  Radio,
} from './Icons';
import { colors } from '../theme/tokens';
import { useDaemonStore, EndpointTestResult } from '../stores/useDaemonStore';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const currentGatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const setServerEndpoints = useDaemonStore((s) => s.setServerEndpoints);
  const resetServerEndpoints = useDaemonStore((s) => s.resetServerEndpoints);
  const testServerEndpoints = useDaemonStore((s) => s.testServerEndpoints);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  const [inputGatewayUrl, setInputGatewayUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
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
          text: `Gateway online! Latency: ${res.gatewayLatencyMs}ms (${res.connectedDaemons ?? 0} machine(s) connected)`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Gateway unreachable: ${res.gatewayError || 'Connection failed'}. Verify network and URL.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Gateway test failed.' });
    } finally {
      setIsTesting(false);
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIconBox}>
                  <Globe size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Gateway Hub Endpoint</Text>
                  <Text style={styles.subtitle}>
                    Unified server for authentication, machines, and real-time streaming
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#8b949e" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
              >
                {/* Architecture Info Banner */}
                <View style={styles.infoBanner}>
                  <Radio size={14} color="#0096c7" style={{ marginTop: 2 }} />
                  <Text style={styles.infoBannerText}>
                    All mobile operations (Google OAuth, developer login, machine discovery, and WebRTC streaming) connect exclusively through this Gateway Hub.
                  </Text>
                </View>

                {/* Quick Presets */}
                <Text style={styles.inputLabel}>QUICK PRESETS</Text>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('https://cloud-agent-3q6w.onrender.com')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>Render (Cloud)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('https://unushered-chantal-unpsychotic.ngrok-free.dev')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>ngrok Tunnel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('http://127.0.0.1:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>Localhost (:8080)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('http://10.0.2.2:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>Android Emulator</Text>
                  </TouchableOpacity>
                </View>

                {/* Gateway URL Field */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Database size={13} color="#0077b6" />
                    <Text style={styles.fieldLabel}>Gateway Server URL</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={inputGatewayUrl}
                      onChangeText={(t) => {
                        setInputGatewayUrl(t);
                        setTestResult(null);
                      }}
                      placeholder="e.g. https://unushered-chantal-unpsychotic.ngrok-free.dev"
                      placeholderTextColor="#6e7681"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {testResult && (
                      <View style={styles.testBadge}>
                        {testResult.gatewayOk ? (
                          <View style={styles.badgeSuccess}>
                            <CheckCircle2 size={12} color="#0077b6" />
                            <Text style={styles.badgeSuccessText}>
                              {testResult.gatewayLatencyMs}ms • {testResult.connectedDaemons ?? 0} daemon(s)
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.badgeError}>
                            <XCircle size={12} color={colors.red} />
                            <Text style={styles.badgeErrorText}>Offline</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Live Test Status Feedback */}
                {statusMessage && (
                  <View
                    style={[
                      styles.feedbackBox,
                      statusMessage.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
                    ]}
                  >
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 size={14} color="#0077b6" />
                    ) : (
                      <XCircle size={14} color={colors.red} />
                    )}
                    <Text
                      style={[
                        styles.feedbackText,
                        statusMessage.type === 'success' ? styles.feedbackSuccessText : styles.feedbackErrorText,
                      ]}
                    >
                      {statusMessage.text}
                    </Text>
                  </View>
                )}

                {/* Test Connection Button */}
                <TouchableOpacity
                  style={styles.testButton}
                  onPress={handleTest}
                  disabled={isTesting}
                  activeOpacity={0.7}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color="#0077b6" />
                  ) : (
                    <>
                      <Zap size={14} color="#0077b6" />
                      <Text style={styles.testButtonText}>Test Connection</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Active Link Status Info */}
                {activeMachine && (
                  <View style={styles.activeMachineCard}>
                    <View style={styles.machineDot} />
                    <Text style={styles.activeMachineText}>
                      Linked Host: <Text style={{ color: '#f0f6fc', fontWeight: '600' }}>{activeMachine.name}</Text> ({activeMachine.platform})
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons Footer */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleReset}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={13} color="#8b949e" />
                  <Text style={styles.resetBtnText}>Defaults</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save & Connect</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(1, 4, 9, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 11,
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
  scrollArea: {
    flexShrink: 1,
  },
  body: {
    padding: 18,
    gap: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.25)',
    borderRadius: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#c9d1d9',
    lineHeight: 17,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 0.5,
    marginBottom: -8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  presetChipText: {
    fontSize: 12,
    color: '#c9d1d9',
    fontWeight: '500',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c9d1d9',
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    paddingRight: 110,
    color: '#f0f6fc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testBadge: {
    position: 'absolute',
    right: 8,
    alignSelf: 'center',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeSuccessText: {
    fontSize: 10,
    color: '#48cae4',
    fontWeight: '600',
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeErrorText: {
    fontSize: 10,
    color: colors.red,
    fontWeight: '600',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(0, 119, 182, 0.1)',
    borderColor: 'rgba(0, 119, 182, 0.3)',
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  feedbackText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  feedbackSuccessText: {
    color: '#48cae4',
  },
  feedbackErrorText: {
    color: colors.red,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  testButtonText: {
    color: '#0096c7',
    fontSize: 13,
    fontWeight: '600',
  },
  activeMachineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  machineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0077b6',
  },
  activeMachineText: {
    fontSize: 12,
    color: '#8b949e',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#161b22',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#8b949e',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#0077b6',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  saveBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
});

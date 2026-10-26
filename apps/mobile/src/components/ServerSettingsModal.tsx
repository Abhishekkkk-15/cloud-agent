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
  Server,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Database,
  Radio,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, EndpointTestResult } from '../stores/useDaemonStore';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const currentApiUrl = useDaemonStore((s) => s.apiUrl);
  const currentGatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const setServerEndpoints = useDaemonStore((s) => s.setServerEndpoints);
  const resetServerEndpoints = useDaemonStore((s) => s.resetServerEndpoints);
  const testServerEndpoints = useDaemonStore((s) => s.testServerEndpoints);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  const [inputApiUrl, setInputApiUrl] = useState('');
  const [inputGatewayUrl, setInputGatewayUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setInputApiUrl(currentApiUrl);
      setInputGatewayUrl(currentGatewayUrl);
      setTestResult(null);
      setStatusMessage(null);
    }
  }, [visible, currentApiUrl, currentGatewayUrl]);

  const handleApplyPreset = (api: string, gateway: string) => {
    setInputApiUrl(api);
    setInputGatewayUrl(gateway);
    setTestResult(null);
    setStatusMessage(null);
  };

  const handleTest = async () => {
    if (!inputApiUrl.trim() || !inputGatewayUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter both API and Gateway URLs.' });
      return;
    }
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await testServerEndpoints(inputApiUrl, inputGatewayUrl);
      setTestResult(res);
      if (res.apiOk && res.gatewayOk) {
        setStatusMessage({
          type: 'success',
          text: `Both endpoints online! API: ${res.apiLatencyMs}ms | Gateway: ${res.gatewayLatencyMs}ms (${res.connectedDaemons ?? 0} machine(s) linked)`,
        });
      } else if (!res.apiOk && !res.gatewayOk) {
        setStatusMessage({
          type: 'error',
          text: 'Both endpoints failed to respond. Check URL format and network accessibility.',
        });
      } else if (!res.apiOk) {
        setStatusMessage({
          type: 'error',
          text: `API endpoint unreachable: ${res.apiError || 'Failed to connect'}`,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Gateway endpoint unreachable: ${res.gatewayError || 'Failed to connect'}`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Endpoint test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!inputApiUrl.trim() || !inputGatewayUrl.trim()) {
      setStatusMessage({ type: 'error', text: 'API and Gateway URLs cannot be empty.' });
      return;
    }

    setIsSaving(true);
    try {
      await setServerEndpoints({
        apiUrl: inputApiUrl.trim(),
        gatewayUrl: inputGatewayUrl.trim(),
      });
      setStatusMessage({ type: 'success', text: 'Server endpoints updated successfully.' });
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 500);
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to save endpoints.' });
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetServerEndpoints();
      setInputApiUrl(useDaemonStore.getState().apiUrl);
      setInputGatewayUrl(useDaemonStore.getState().gatewayUrl);
      setTestResult(null);
      setStatusMessage({ type: 'success', text: 'Reset to default endpoints.' });
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
                  <Text style={styles.title}>Server & Network Endpoints</Text>
                  <Text style={styles.subtitle}>
                    Configure Cloud Agent API & Gateway Hub endpoints
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
                {/* Deployment Notice */}
                <View style={styles.infoBanner}>
                  <Radio size={14} color="#0096c7" style={{ marginTop: 2 }} />
                  <Text style={styles.infoBannerText}>
                    Ensure your deployed FastAPI (<Text style={styles.codeText}>:8000</Text>) and Gateway Hub (<Text style={styles.codeText}>:8080</Text>) share the same MongoDB and JWT secret.
                  </Text>
                </View>

                {/* Preset Chips */}
                <Text style={styles.inputLabel}>QUICK PRESETS</Text>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('http://127.0.0.1:8000', 'http://127.0.0.1:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>Localhost (127.0.0.1)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleApplyPreset('http://10.0.2.2:8000', 'http://10.0.2.2:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>Android Emulator</Text>
                  </TouchableOpacity>
                </View>

                {/* API URL Field */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Server size={13} color="#0077b6" />
                    <Text style={styles.fieldLabel}>FastAPI Backend URL</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={inputApiUrl}
                      onChangeText={(t) => {
                        setInputApiUrl(t);
                        setTestResult(null);
                      }}
                      placeholder="e.g. https://api.yourdomain.com or http://192.168.1.10:8000"
                      placeholderTextColor="#6e7681"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {testResult && (
                      <View style={styles.testBadge}>
                        {testResult.apiOk ? (
                          <View style={styles.badgeSuccess}>
                            <CheckCircle2 size={12} color="#0077b6" />
                            <Text style={styles.badgeSuccessText}>{testResult.apiLatencyMs}ms</Text>
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

                {/* Gateway URL Field */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Database size={13} color="#0077b6" />
                    <Text style={styles.fieldLabel}>Gateway Hub WebSocket / HTTP URL</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={inputGatewayUrl}
                      onChangeText={(t) => {
                        setInputGatewayUrl(t);
                        setTestResult(null);
                      }}
                      placeholder="e.g. https://gateway.yourdomain.com or http://192.168.1.10:8080"
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
                      <Text style={styles.testButtonText}>Test Connection to Endpoints</Text>
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
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#48cae4',
    fontWeight: '600',
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
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  textInput: {
    color: '#f0f6fc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingRight: 80,
  },
  testBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    bottom: 8,
    justifyContent: 'center',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#48cae4',
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.35)',
  },
  badgeErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.red,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(0, 119, 182, 0.1)',
    borderColor: 'rgba(0, 119, 182, 0.3)',
  },
  feedbackSuccessText: {
    flex: 1,
    fontSize: 12,
    color: '#48cae4',
    lineHeight: 16,
  },
  feedbackError: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  feedbackErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#ff7b72',
    lineHeight: 16,
  },
  feedbackText: {
    fontSize: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 119, 182, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    borderRadius: 10,
    paddingVertical: 11,
  },
  testButtonText: {
    color: '#0077b6',
    fontWeight: '600',
    fontSize: 13,
  },
  activeMachineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161b22',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#21262d',
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
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#8b949e',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#0077b6',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

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
  Bell,
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const currentGatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const setServerEndpoints = useDaemonStore((s) => s.setServerEndpoints);
  const resetServerEndpoints = useDaemonStore((s) => s.resetServerEndpoints);
  const testServerEndpoints = useDaemonStore((s) => s.testServerEndpoints);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const pushStatus = useDaemonStore((s) => s.pushStatus);
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const pushToken = useDaemonStore((s) => s.pushToken);
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalCard, isLight && styles.modalCardLight]}>
              {/* Header */}
              <View style={[styles.header, isLight && styles.headerLight]}>
                <View style={[styles.headerIconBox, isLight && styles.headerIconBoxLight]}>
                  <Globe size={18} color={isLight ? '#0077b6' : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, isLight && styles.titleLight]}>Gateway Hub Endpoint</Text>
                  <Text style={[styles.subtitle, isLight && styles.subtitleLight]}>
                    Unified server for authentication, machines, and real-time streaming
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeBtn, isLight && styles.closeBtnLight]}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={isLight ? '#57606a' : '#a3a3a3'} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={[styles.scrollArea, isLight && { backgroundColor: '#ffffff' }]}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
              >
                {/* Architecture Info Banner */}
                <View style={[styles.infoBanner, isLight && styles.infoBannerLight]}>
                  <Radio size={14} color={isLight ? '#0077b6' : '#fafafa'} style={{ marginTop: 2 }} />
                  <Text style={[styles.infoBannerText, isLight && styles.infoBannerTextLight]}>
                    All mobile operations (Google OAuth, machine discovery, and WebRTC streaming) connect exclusively through this Gateway Hub.
                  </Text>
                </View>

                {/* Quick Presets */}
                <Text style={[styles.inputLabel, isLight && { color: '#6e7681' }]}>QUICK PRESETS</Text>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={[styles.presetChip, isLight && styles.presetChipLight]}
                    onPress={() => handleApplyPreset('https://gateway.cloud-agent.abhishekkkk.in')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isLight && styles.presetChipTextLight]}>Cloud Gateway</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, isLight && styles.presetChipLight]}
                    onPress={() => handleApplyPreset('https://unushered-chantal-unpsychotic.ngrok-free.dev')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isLight && styles.presetChipTextLight]}>ngrok Tunnel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, isLight && styles.presetChipLight]}
                    onPress={() => handleApplyPreset('http://127.0.0.1:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isLight && styles.presetChipTextLight]}>Localhost (:8080)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.presetChip, isLight && styles.presetChipLight]}
                    onPress={() => handleApplyPreset('http://10.0.2.2:8080')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isLight && styles.presetChipTextLight]}>Android Emulator</Text>
                  </TouchableOpacity>
                </View>

                {/* Gateway URL Field */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Database size={13} color={isLight ? '#0077b6' : '#fafafa'} />
                    <Text style={[styles.fieldLabel, isLight && styles.fieldLabelLight]}>Gateway Server URL</Text>
                  </View>
                  <View style={[styles.inputContainer, isLight && styles.inputContainerLight]}>
                    <TextInput
                      style={[styles.textInput, isLight && styles.textInputLight]}
                      value={inputGatewayUrl}
                      onChangeText={(t) => {
                        setInputGatewayUrl(t);
                        setTestResult(null);
                      }}
                      placeholder="e.g. https://unushered-chantal-unpsychotic.ngrok-free.dev"
                      placeholderTextColor="#737373"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {testResult && (
                      <View style={styles.testBadge}>
                        {testResult.gatewayOk ? (
                          <View style={styles.badgeSuccess}>
                            <CheckCircle2 size={12} color="#fafafa" />
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
                      <CheckCircle2 size={14} color="#fafafa" />
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
                  style={[styles.testButton, isLight && styles.testButtonLight]}
                  onPress={handleTest}
                  disabled={isTesting}
                  activeOpacity={0.7}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                  ) : (
                    <>
                      <Zap size={14} color={isLight ? '#0077b6' : '#fafafa'} />
                      <Text style={[styles.testButtonText, isLight && styles.testButtonTextLight]}>Test Connection</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Native Push Notification Channel & Test */}
                <View style={[styles.pushCard, isLight && styles.pushCardLight]}>
                  <View style={styles.pushHeader}>
                    <View style={styles.pushTitleRow}>
                      <Bell size={14} color={isLight ? '#0077b6' : '#fafafa'} />
                      <Text style={[styles.pushTitle, isLight && styles.pushTitleLight]}>Native Push Notifications</Text>
                    </View>
                    <View style={[
                      styles.statusPill,
                      isPushRegistered
                        ? (isLight ? styles.statusPillActiveLight : styles.statusPillActive)
                        : (isLight ? styles.statusPillInactiveLight : styles.statusPillInactive)
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        isPushRegistered
                          ? (isLight ? styles.statusPillTextActiveLight : styles.statusPillTextActive)
                          : (isLight ? styles.statusPillTextInactiveLight : styles.statusPillTextInactive)
                      ]}>
                        {isPushRegistered ? 'Active' : 'Standby'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.pushStatusText, isLight && styles.pushStatusTextLight]} numberOfLines={4}>
                    {pushStatus}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.testPushButton, isLight && styles.testPushButtonLight, { flex: 1, marginTop: 0 }, isSendingTestPush && { opacity: 0.6 }]}
                      onPress={handleTestPush}
                      disabled={isSendingTestPush}
                      activeOpacity={0.7}
                    >
                      {isSendingTestPush ? (
                        <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                      ) : (
                        <>
                          <Bell size={13} color={isLight ? '#0077b6' : '#fafafa'} />
                          <Text style={[styles.testPushButtonText, isLight && styles.testPushButtonTextLight]}>Send Test Push</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.testPushButton,
                        isLight && styles.testPushButtonLight,
                        { marginTop: 0, backgroundColor: isLight ? '#f6f8fa' : '#21262d', paddingHorizontal: 14 }
                      ]}
                      onPress={async () => {
                        setIsSendingTestPush(true);
                        try {
                          await registerPushNotifications();
                        } finally {
                          setIsSendingTestPush(false);
                        }
                      }}
                      disabled={isSendingTestPush}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={13} color={isLight ? '#1f2328' : '#fafafa'} />
                      <Text style={[styles.testPushButtonText, isLight && styles.testPushButtonTextLight]}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Active Link Status Info */}
                {activeMachine && (
                  <View style={[styles.activeMachineCard, isLight && styles.activeMachineCardLight]}>
                    <View style={[styles.machineDot, isLight && { backgroundColor: '#0077b6' }]} />
                    <Text style={[styles.activeMachineText, isLight && styles.activeMachineTextLight]}>
                      Linked Host: <Text style={{ color: isLight ? '#1f2328' : '#fafafa', fontWeight: '600' }}>{activeMachine.name}</Text> ({activeMachine.platform})
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Action Buttons Footer */}
              <View style={[styles.footer, isLight && styles.footerLight]}>
                <TouchableOpacity
                  style={[styles.resetBtn, isLight && styles.resetBtnLight]}
                  onPress={handleReset}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={13} color={isLight ? '#6e7681' : '#a3a3a3'} />
                  <Text style={[styles.resetBtnText, isLight && styles.resetBtnTextLight]}>Defaults</Text>
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, isLight && styles.cancelBtnTextLight]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, isLight && styles.saveBtnLight, isSaving && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.7}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#0a0a0a'} />
                  ) : (
                    <Text style={[styles.saveBtnText, isLight && styles.saveBtnTextLight]}>Save & Connect</Text>
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
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#161616',
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#d4d4d4',
    lineHeight: 17,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a3a3a3',
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
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  presetChipText: {
    fontSize: 12,
    color: '#d4d4d4',
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
    color: '#d4d4d4',
  },
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    paddingRight: 110,
    color: '#fafafa',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeSuccessText: {
    fontSize: 10,
    color: '#fafafa',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
    color: '#fafafa',
  },
  feedbackErrorText: {
    color: colors.red,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 4,
  },
  testButtonText: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '600',
  },
  activeMachineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  machineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  activeMachineText: {
    fontSize: 12,
    color: '#a3a3a3',
  },
  pushCard: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  pushHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pushTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pushTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  statusPillInactive: {
    backgroundColor: '#262626',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: '#fafafa',
  },
  statusPillTextInactive: {
    color: '#a3a3a3',
  },
  pushStatusText: {
    fontSize: 12,
    color: '#a3a3a3',
    lineHeight: 16,
  },
  testPushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 2,
  },
  testPushButtonText: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#161616',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#fafafa',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  saveBtnText: {
    fontSize: 13,
    color: '#0a0a0a',
    fontWeight: '600',
  },
  modalCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  headerIconBoxLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  titleLight: {
    color: '#1f2328',
  },
  subtitleLight: {
    color: '#6e7681',
  },
  closeBtnLight: {
    backgroundColor: '#e1e4e8',
  },
  infoBannerLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  infoBannerTextLight: {
    color: '#57606a',
  },
  presetChipLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  presetChipTextLight: {
    color: '#1f2328',
  },
  fieldLabelLight: {
    color: '#1f2328',
  },
  inputContainerLight: {},
  textInputLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
    color: '#1f2328',
  },
  testButtonLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  testButtonTextLight: {
    color: '#0077b6',
  },
  pushCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  pushTitleLight: {
    color: '#1f2328',
  },
  statusPillActiveLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
    borderColor: 'rgba(0, 119, 182, 0.3)',
  },
  statusPillInactiveLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  statusPillTextActiveLight: {
    color: '#0077b6',
  },
  statusPillTextInactiveLight: {
    color: '#6e7681',
  },
  pushStatusTextLight: {
    color: '#6e7681',
  },
  testPushButtonLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  testPushButtonTextLight: {
    color: '#1f2328',
  },
  activeMachineCardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  activeMachineTextLight: {
    color: '#57606a',
  },
  footerLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#d0d7de',
  },
  resetBtnLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  resetBtnTextLight: {
    color: '#6e7681',
  },
  cancelBtnTextLight: {
    color: '#6e7681',
  },
  saveBtnLight: {
    backgroundColor: '#0077b6',
  },
  saveBtnTextLight: {
    color: '#ffffff',
  },
});

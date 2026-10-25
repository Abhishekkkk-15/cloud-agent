import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Server,
  Copy,
  Check,
  Terminal,
  Radio,
  CheckCircle2,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

interface PairMachineModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PairMachineModal: React.FC<PairMachineModalProps> = ({
  visible,
  onClose,
}) => {
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const generateMachinePairingToken = useDaemonStore((s) => s.generateMachinePairingToken);

  const [isLoading, setIsLoading] = useState(false);
  const [pairingData, setPairingData] = useState<{
    token: string;
    installCommand: string;
    instructions: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      loadToken();
    } else {
      setPairingData(null);
      setCopied(false);
    }
  }, [visible]);

  const loadToken = async () => {
    setIsLoading(true);
    const data = await generateMachinePairingToken();
    setPairingData(data);
    setIsLoading(false);
  };

  const handleCopy = () => {
    if (!pairingData) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
              <Server size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Pair a New Machine</Text>
              <Text style={styles.subtitle}>Link a local PC, laptop, or VPS</Text>
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

          {/* Body */}
          <View style={styles.body}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Generating secure pairing token...</Text>
              </View>
            ) : pairingData ? (
              <>
                <Text style={styles.instructionText}>
                  Run this command in the terminal where your Antigravity CLI is installed:
                </Text>

                {/* Code Terminal Box */}
                <View style={styles.codeBox}>
                  <View style={styles.codeHeader}>
                    <Terminal size={12} color="#8b949e" />
                    <Text style={styles.codeLang}>Terminal Command</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={handleCopy}
                      activeOpacity={0.7}
                    >
                      {copied ? (
                        <>
                          <Check size={12} color={colors.primary} />
                          <Text style={[styles.copyBtnText, { color: colors.primary }]}>
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

                {/* Live Status Tracker */}
                <View style={styles.statusBox}>
                  {connectionState === 'connected' ? (
                    <View style={styles.connectedRow}>
                      <CheckCircle2 size={16} color={colors.primary} />
                      <Text style={styles.connectedText}>
                        Machine connected: {activeMachine?.name || 'Online'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.waitingRow}>
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
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
    backgroundColor: colors.primarySubtle,
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
  body: {
    padding: 16,
    gap: 12,
  },
  instructionText: {
    fontSize: 13,
    color: '#c9d1d9',
    lineHeight: 18,
  },
  loadingBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#8b949e',
  },
  codeBox: {
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  codeLang: {
    fontSize: 11,
    color: '#8b949e',
    flex: 1,
    marginLeft: 6,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
    backgroundColor: '#21262d',
  },
  copyBtnText: {
    fontSize: 11,
    color: '#c9d1d9',
    fontWeight: '500',
  },
  codeContent: {
    padding: 12,
    fontSize: 12.5,
    color: '#f0f6fc',
    fontFamily: typography.mono,
    lineHeight: 18,
  },
  statusBox: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: radii.md,
    padding: 12,
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
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  errorBox: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#f85149',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#21262d',
    borderRadius: radii.sm,
  },
  retryText: {
    fontSize: 12,
    color: '#f0f6fc',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    alignItems: 'flex-end',
  },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#21262d',
    borderRadius: radii.md,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f0f6fc',
  },
});

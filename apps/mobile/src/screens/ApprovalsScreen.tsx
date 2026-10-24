import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  AlertTriangle,
  Clock,
  Server,
  Terminal,
  Shield,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Bot,
  Database,
  CheckCircle2,
  XCircle,
  GitCommit,
  GitBranch,
  Link,
  ShieldAlert,
  ShieldCheck,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';

interface ApprovalsScreenProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ApprovalsScreen: React.FC<ApprovalsScreenProps> = ({ onBack, onNavigateTab }) => {
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const decisionTrail = useDaemonStore((s) => s.decisionTrail);
  const respondApproval = useDaemonStore((s) => s.respondApproval);
  const activeMachine = useDaemonStore((s) => s.activeMachine);

  const [rememberRule, setRememberRule] = useState(false);
  const [isTreeExpanded, setIsTreeExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthorize = async () => {
    await respondApproval(true);
    Alert.alert('Action Authorized', 'Authorization token dispatched over WebRTC DataChannel to VPS Daemon.');
  };

  const handleDeny = async () => {
    await respondApproval(false);
    Alert.alert('Action Denied', 'Intervention token dispatched. Command aborted.');
  };

  const targetNode = pendingApproval?.targetNode || activeMachine?.name || 'DESKTOP-BJI38IC';

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Approvals & Security Checks"
        subtitle={`${targetNode} • HITL Gate`}
        onBack={onBack}
        onMore={() => {}}
      />

      {/* Sub-bar */}
      <View style={styles.subBar}>
        <View style={styles.subBarLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.subBarText}>
            {pendingApproval ? '1 action requires approval' : 'Zero-Trust Gateways Clear • 0 open ports'}
          </Text>
        </View>
        <View style={styles.hitlBadge}>
          <Shield size={11} color={colors.purple} />
          <Text style={styles.hitlBadgeText}>HITL Policy v2</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {pendingApproval ? (
          <>
            {/* Agent Interactivity Callout */}
            <View style={styles.agentCallout}>
              <View style={styles.agentCalloutHeader}>
                <View style={styles.agentIconBox}>
                  <Bot size={13} color={colors.purple} />
                </View>
                <Text style={styles.agentCalloutLabel}>{pendingApproval.caller || 'Antigravity Agent'} requested confirmation:</Text>
              </View>
              <Text style={styles.agentCalloutBody}>
                {pendingApproval.description}
              </Text>
            </View>

            {/* Critical Permission Approval Card */}
            <View style={styles.approvalCard}>
              {/* Top row */}
              <View style={styles.approvalHeaderRow}>
                <View style={styles.dangerPill}>
                  <AlertTriangle size={12} color={colors.red} />
                  <Text style={styles.dangerPillText}>HIGH PRIVILEGE · SYSTEMD & VOLUME</Text>
                </View>
                <View style={styles.timerBadge}>
                  <Clock size={11} color={colors.textMuted} />
                  <Text style={styles.timerText}>04:39</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.cardTitle}>Execute Shell Command</Text>
              <Text style={styles.cardSubtitle}>Elevated runtime privilege request for system daemon cycle</Text>

              {/* Target Metadata Pills */}
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Server size={12} color={colors.textMuted} />
                  <Text style={styles.metaLabel}>Target Node:</Text>
                  <Text style={styles.metaValue}>{targetNode}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Terminal size={12} color={colors.textMuted} />
                  <Text style={styles.metaLabel}>Caller:</Text>
                  <Text style={[styles.metaValue, { color: colors.blue }]}>
                    {pendingApproval.caller}
                  </Text>
                </View>
              </View>

              {/* Terminal Command Box */}
              <View style={styles.terminalBox}>
                <View style={styles.terminalHeader}>
                  <View style={styles.terminalHeaderLeft}>
                    <ShieldAlert size={13} color={colors.red} />
                    <Text style={styles.terminalTitle}>tool:{pendingApproval.tool} (root)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                  >
                    {copied ? <Check size={12} color={colors.green} /> : <Copy size={12} color={colors.textMuted} />}
                    <Text style={[styles.copyBtnText, copied && { color: colors.green }]}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.terminalBody}>
                  <Text style={styles.terminalCode}>
                    <Text style={styles.codePrompt}>$ </Text>
                    <Text style={styles.codeCmd}>{pendingApproval.command}</Text>
                  </Text>
                </View>
              </View>

              {/* Indicators */}
              <View style={styles.indicatorsRow}>
                <View style={styles.indicatorPillRed}>
                  <AlertTriangle size={11} color={colors.red} />
                  <Text style={styles.indicatorTextRed}>Elevated Root (Sudo)</Text>
                </View>
                <View style={styles.indicatorPillBlue}>
                  <Database size={11} color={colors.blue} />
                  <Text style={styles.indicatorTextBlue}>Volume Mutation</Text>
                </View>
                <View style={styles.indicatorPillGreen}>
                  <CheckCircle2 size={11} color={colors.green} />
                  <Text style={styles.indicatorTextGreen}>Zero-Trust Gate</Text>
                </View>
              </View>

              {/* Agent Reflection Justification */}
              <View style={styles.justificationBox}>
                <Text style={styles.justificationText}>
                  "Restarting daemon workers to flush socket queue and re-spool with updated config. Volume purge prevents redis deadlock."
                </Text>
              </View>

              {/* Remember Rule Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRememberRule(!rememberRule)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberRule && styles.checkboxActive]}>
                  {rememberRule && <Check size={12} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>Always permit this action for this session</Text>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.denyBtn}
                  onPress={handleDeny}
                  activeOpacity={0.8}
                >
                  <X size={16} color={colors.red} />
                  <Text style={styles.denyBtnText}>✕ Deny (Esc)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.authBtn}
                  onPress={handleAuthorize}
                  activeOpacity={0.8}
                >
                  <Check size={16} color="#ffffff" />
                  <Text style={styles.authBtnText}>✓ Authorize (↵)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          /* Empty State when no approval pending */
          <View style={styles.clearCard}>
            <View style={styles.clearIconCircle}>
              <ShieldCheck size={28} color={colors.green} />
            </View>
            <Text style={styles.clearTitle}>Zero-Trust Gateways Clear</Text>
            <Text style={styles.clearSubtitle}>
              No elevated privilege requests currently pending. The autonomous runtime will interrupt here if high-privilege shell or git operations occur.
            </Text>
          </View>
        )}

        {/* Collapsible Progress Tree */}
        <View style={styles.treeContainer}>
          <TouchableOpacity
            style={styles.treeHeader}
            onPress={() => setIsTreeExpanded(!isTreeExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.treeHeaderLeft}>
              <View style={styles.treeCheckCircle}>
                <Check size={11} color="#ffffff" />
              </View>
              <View style={styles.treeHeaderTextCol}>
                <Text style={styles.treeTitle}>Runtime Security Checks</Text>
                <Text style={styles.treeSubtitle}>33 security policies active</Text>
              </View>
            </View>
            <View style={styles.treeHeaderRight}>
              <Text style={styles.treeDuration}>Active</Text>
              {isTreeExpanded ? (
                <ChevronUp size={16} color={colors.textMuted} />
              ) : (
                <ChevronDown size={16} color={colors.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {isTreeExpanded && (
            <View style={styles.treeItemsList}>
              <View style={styles.treeItem}>
                <GitBranch size={14} color={colors.textMuted} />
                <Text style={styles.treeItemText}>Workspace Sandboxing: Strict</Text>
              </View>
              <View style={styles.treeItem}>
                <Link size={14} color={colors.blue} />
                <Text style={styles.treeItemText}>Inbound Ports: 0 Open (Zero-Trust)</Text>
              </View>
              <View style={styles.treeItem}>
                <GitCommit size={14} color={colors.purple} />
                <Text style={[styles.treeItemText, { color: colors.textPrimary }]}>
                  WebRTC P2P Direct Tunnel: Encrypted
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Decision Audit Trail */}
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>Decision Audit Trail</Text>
          <View style={styles.auditTimeBadge}>
            <Text style={styles.auditTimeBadgeText}>Past 24h</Text>
          </View>
        </View>

        <View style={styles.auditList}>
          {decisionTrail.length > 0 ? (
            decisionTrail.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.auditItem}>
                  <View style={item.approved ? styles.auditIconAuth : styles.auditIconDeny}>
                    {item.approved ? (
                      <Check size={11} color={colors.green} />
                    ) : (
                      <X size={11} color={colors.red} />
                    )}
                  </View>
                  <View style={styles.auditTexts}>
                    <Text style={styles.auditCmd} numberOfLines={1}>{item.command}</Text>
                    <View style={styles.auditMetaRow}>
                      <Text
                        style={[
                          styles.auditStatus,
                          { color: item.approved ? colors.green : colors.red },
                        ]}
                      >
                        {item.details}
                      </Text>
                      <Text style={styles.auditDot}>•</Text>
                      <Text style={styles.auditTime}>{item.timestamp}</Text>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            ))
          ) : (
            <View style={{ padding: 18, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: typography.mono }}>
                Zero privileged actions executed in this session yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  subBar: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.green,
  },
  subBarText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  hitlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  hitlBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  agentCallout: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 12,
    marginBottom: 14,
  },
  agentCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  agentIconBox: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.purpleSubtle,
    borderWidth: 1,
    borderColor: colors.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentCalloutLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  agentCalloutBody: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  approvalCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 16,
  },
  approvalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dangerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.md,
  },
  dangerPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.red,
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  timerText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontFamily: typography.mono,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  terminalBox: {
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  terminalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  terminalTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    fontFamily: typography.mono,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  terminalBody: {
    padding: 10,
  },
  terminalCode: {
    fontSize: 12,
    fontFamily: typography.mono,
    lineHeight: 18,
  },
  codePrompt: {
    color: colors.textMuted,
  },
  codeCmd: {
    color: colors.textPrimary,
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  indicatorPillRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  indicatorTextRed: {
    fontSize: 11,
    color: colors.red,
    fontFamily: typography.mono,
  },
  indicatorPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  indicatorTextBlue: {
    fontSize: 11,
    color: colors.blue,
    fontFamily: typography.mono,
  },
  indicatorPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  indicatorTextGreen: {
    fontSize: 11,
    color: colors.green,
    fontFamily: typography.mono,
  },
  justificationBox: {
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 10,
  },
  justificationText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.greenBg,
    borderColor: colors.green,
  },
  checkboxLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  denyBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.redBg,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  denyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.red,
  },
  authBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.greenBg,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  authBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  clearCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  clearIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  clearTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  clearSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  treeContainer: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: 16,
  },
  treeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  treeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  treeCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  treeHeaderTextCol: {
    flex: 1,
  },
  treeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  treeSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  treeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  treeDuration: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  treeItemsList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    padding: 12,
    gap: 8,
  },
  treeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  treeItemText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  auditTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  auditTimeBadge: {
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  auditTimeBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  auditList: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 12,
  },
  auditItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  auditIconAuth: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  auditIconDeny: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  auditTexts: {
    flex: 1,
  },
  auditCmd: {
    fontSize: 12,
    fontFamily: typography.mono,
    color: colors.textPrimary,
  },
  auditMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  auditStatus: {
    fontSize: 11,
    fontWeight: '500',
  },
  auditDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  auditTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginVertical: 10,
  },
});

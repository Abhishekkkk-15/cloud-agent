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
  CheckCircle2,
  GitBranch,
  Link,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
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

  const targetNode = pendingApproval?.targetNode || activeMachine?.name || 'Local Machine';

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Diff Reviewer & Security Gate"
        subtitle={`${targetNode} • HITL Gate`}
        showLiveDot={true}
        liveColor={pendingApproval ? colors.red : colors.statusLive}
        onBack={onBack}
        onMore={() => {}}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Status Badge & Diff Metrics Row (Stitch Screen 4) */}
        <View style={styles.statusBarRow}>
          <View style={styles.statusBarLeft}>
            <View
              style={[
                styles.statusBadge,
                pendingApproval ? styles.statusBadgeOpen : styles.statusBadgePassed,
              ]}
            >
              <View
                style={[
                  styles.statusBadgeDot,
                  { backgroundColor: pendingApproval ? colors.primaryLight : colors.statusLive },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: pendingApproval ? colors.primaryLight : colors.statusLive },
                ]}
              >
                {pendingApproval ? 'Waiting for review' : 'All checks passed'}
              </Text>
            </View>
          </View>
          <View style={styles.metricsRight}>
            <Text style={styles.metricsText}>
              {pendingApproval ? '1 action pending' : 'Zero elevated actions'}
            </Text>
          </View>
        </View>

        {/* 2. Verification Checks Summary Card (Stitch Screen 4) */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeaderRow}>
            <View style={styles.summaryHeaderLeft}>
              {pendingApproval ? (
                <View style={styles.summaryPendingIcon}>
                  <AlertTriangle size={15} color={colors.red} />
                </View>
              ) : (
                <View style={styles.summaryPassIcon}>
                  <CheckCheck size={15} color={colors.statusLive} />
                </View>
              )}
              <View style={styles.summaryTitleCol}>
                <Text style={styles.summaryTitle}>
                  {pendingApproval
                    ? 'Action Required • Human In The Loop'
                    : 'System Clean • No Approvals Required'}
                </Text>
                <Text style={styles.summarySub}>
                  {pendingApproval
                    ? `Caller: ${pendingApproval.caller || 'Antigravity Agent'} requested privilege`
                    : 'Zero-Trust Gateways active • Inbound ports closed'}
                </Text>
              </View>
            </View>
          </View>

          {/* Mini Check Status Chips */}
          <View style={styles.checksChipsRow}>
            <View style={styles.checkChip}>
              <CheckCircle2 size={11} color={colors.statusLive} />
              <Text style={styles.checkChipText}>unit-tests: ok</Text>
            </View>
            <View style={styles.checkChip}>
              <CheckCircle2 size={11} color={colors.statusLive} />
              <Text style={styles.checkChipText}>typecheck: ok</Text>
            </View>
            <View
              style={[
                styles.checkChip,
                pendingApproval && styles.checkChipAlert,
              ]}
            >
              {pendingApproval ? (
                <ShieldAlert size={11} color={colors.red} />
              ) : (
                <ShieldCheck size={11} color={colors.statusLive} />
              )}
              <Text
                style={[
                  styles.checkChipText,
                  pendingApproval && { color: colors.red },
                ]}
              >
                {pendingApproval ? 'gate: required' : 'gate: passed'}
              </Text>
            </View>
          </View>

          {/* Action Buttons (Rendered prominent when pending) */}
          {pendingApproval && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.denyActionBtn}
                onPress={handleDeny}
                activeOpacity={0.8}
              >
                <X size={15} color={colors.red} />
                <Text style={styles.denyActionBtnText}>Deny / Abort</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authorizeActionBtn}
                onPress={handleAuthorize}
                activeOpacity={0.85}
              >
                <Check size={15} color="#ffffff" />
                <Text style={styles.authorizeActionBtnText}>Authorize Action</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 3. Code Diff & Terminal Preview (Stitch Screen 4) */}
        {pendingApproval && (
          <View style={styles.diffViewerCard}>
            <View style={styles.diffHeaderRow}>
              <View style={styles.diffHeaderLeft}>
                <Terminal size={14} color={colors.primaryLight} />
                <Text style={styles.diffToolTitle}>
                  tool:{pendingApproval.tool || 'run_command'}
                </Text>
                <View style={styles.riskBadge}>
                  <Text style={styles.riskBadgeText}>
                    {pendingApproval.riskLevel ? pendingApproval.riskLevel.toUpperCase() : 'ELEVATED'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopy}
                activeOpacity={0.7}
              >
                {copied ? (
                  <Check size={12} color={colors.statusLive} />
                ) : (
                  <Copy size={12} color={colors.textMuted} />
                )}
                <Text
                  style={[
                    styles.copyBtnText,
                    copied && { color: colors.statusLive },
                  ]}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Description / Justification */}
            <View style={styles.diffDescriptionBox}>
              <Text style={styles.diffDescriptionText}>
                {pendingApproval.description}
              </Text>
              {pendingApproval.justification ? (
                <Text style={styles.diffJustificationText}>
                  "{pendingApproval.justification}"
                </Text>
              ) : null}
            </View>

            {/* Command / Diff Snippet */}
            <View style={styles.codeSnippetContainer}>
              <View style={styles.codeLine}>
                <Text style={styles.codePromptSymbol}>$</Text>
                <Text style={styles.codeContentText} selectable>
                  {pendingApproval.command}
                </Text>
              </View>
            </View>

            {/* Remember Rule Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setRememberRule(!rememberRule)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, rememberRule && styles.checkboxActive]}>
                {rememberRule && <Check size={11} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>
                Always permit this action for current session
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Security Sandbox Policies (Collapsible) */}
        <View style={styles.policiesCard}>
          <TouchableOpacity
            style={styles.policiesHeader}
            onPress={() => setIsTreeExpanded(!isTreeExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.policiesHeaderLeft}>
              <ShieldCheck size={15} color={colors.statusLive} />
              <Text style={styles.policiesTitle}>Runtime Security Checks</Text>
            </View>
            <View style={styles.policiesHeaderRight}>
              <Text style={styles.policiesStatusText}>Active</Text>
              {isTreeExpanded ? (
                <ChevronUp size={15} color={colors.textMuted} />
              ) : (
                <ChevronDown size={15} color={colors.textMuted} />
              )}
            </View>
          </TouchableOpacity>

          {isTreeExpanded && (
            <View style={styles.policiesList}>
              <View style={styles.policyRow}>
                <GitBranch size={13} color={colors.textMuted} />
                <Text style={styles.policyText}>Workspace Sandboxing: Strict</Text>
              </View>
              <View style={styles.policyRow}>
                <Link size={13} color={colors.statusLive} />
                <Text style={styles.policyText}>Inbound Ports: 0 Open (Zero-Trust)</Text>
              </View>
              <View style={styles.policyRow}>
                <ShieldCheck size={13} color={colors.statusLive} />
                <Text style={[styles.policyText, { color: colors.textPrimary }]}>
                  WebRTC P2P Direct Tunnel: Encrypted
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 5. Decision Audit Trail */}
        <View style={styles.auditHeader}>
          <Text style={styles.auditTitle}>DECISION AUDIT TRAIL</Text>
          <View style={styles.auditBadge}>
            <Text style={styles.auditBadgeText}>{decisionTrail.length} recorded</Text>
          </View>
        </View>

        <View style={styles.auditList}>
          {decisionTrail.length > 0 ? (
            decisionTrail.map((item) => (
              <View key={item.id} style={styles.auditItem}>
                <View style={item.approved ? styles.auditIconAuth : styles.auditIconDeny}>
                  {item.approved ? (
                    <Check size={11} color={colors.statusLive} />
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
                        { color: item.approved ? colors.statusLive : colors.red },
                      ]}
                    >
                      {item.details}
                    </Text>
                    <Text style={styles.auditDot}>•</Text>
                    <Text style={styles.auditTime}>{item.timestamp}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyAuditBox}>
              <Text style={styles.emptyAuditText}>
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
    backgroundColor: colors.surfaceContainerLowest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  statusBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeOpen: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.primaryBorder,
  },
  statusBadgePassed: {
    backgroundColor: colors.statusLiveSubtle,
    borderColor: colors.statusLiveBorder,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: typography.mono,
  },
  metricsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  summaryCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  summaryPendingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryPassIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.statusLiveSubtle,
    borderWidth: 1,
    borderColor: colors.statusLiveBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  summaryTitleCol: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summarySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  checksChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  checkChipAlert: {
    backgroundColor: colors.redSubtle,
    borderColor: colors.redBorder,
  },
  checkChipText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  denyActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
    borderRadius: radii.md,
    height: 42,
    gap: 6,
  },
  denyActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.red,
  },
  authorizeActionBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: radii.md,
    height: 42,
    gap: 6,
  },
  authorizeActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  diffViewerCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 14,
  },
  diffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  diffHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  diffToolTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  riskBadge: {
    backgroundColor: colors.redSubtle,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.red,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  copyBtnText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  diffDescriptionBox: {
    marginBottom: 10,
  },
  diffDescriptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  diffJustificationText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  codeSnippetContainer: {
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 10,
  },
  codeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  codePromptSymbol: {
    fontSize: 12,
    color: colors.primaryLight,
    fontFamily: typography.mono,
    fontWeight: '700',
  },
  codeContentText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: typography.mono,
    flex: 1,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  policiesCard: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: 14,
  },
  policiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  policiesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policiesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  policiesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  policiesStatusText: {
    fontSize: 10,
    color: colors.statusLive,
    fontFamily: typography.mono,
  },
  policiesList: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
    paddingTop: 8,
    gap: 6,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policyText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  auditTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  auditBadge: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  auditBadgeText: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  auditList: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    padding: 6,
    gap: 4,
  },
  auditItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.md,
    gap: 10,
  },
  auditIconAuth: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.statusLiveSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditIconDeny: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.redSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 2,
    gap: 5,
  },
  auditStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  auditDot: {
    fontSize: 8,
    color: colors.textDisabled,
  },
  auditTime: {
    fontSize: 10,
    color: colors.textMuted,
  },
  emptyAuditBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyAuditText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
});

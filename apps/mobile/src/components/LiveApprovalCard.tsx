import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ShieldAlert, Check, X, Terminal } from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import type { ApprovalRequest } from '../stores/useDaemonStore';

interface LiveApprovalCardProps {
  approval: ApprovalRequest;
  onAuthorize: () => Promise<void> | void;
  onDeny: () => Promise<void> | void;
  isResponding?: boolean;
}

export const LiveApprovalCard: React.FC<LiveApprovalCardProps> = ({
  approval,
  onAuthorize,
  onDeny,
  isResponding = false,
}) => {
  return (
    <View style={styles.cardContainer}>
      {/* Top Header Pill Row */}
      <View style={styles.headerRow}>
        <View style={styles.askerBadge}>
          <Text style={styles.askerBadgeText}>
            {approval.caller || 'Antigravity'} • {approval.targetNode || 'Host Daemon'}
          </Text>
        </View>
        <View style={styles.riskBadge}>
          <Text style={styles.riskBadgeText}>
            {approval.riskLevel ? approval.riskLevel.toUpperCase() : 'PRIVILEGED'}
          </Text>
        </View>
      </View>

      {/* Title & Icon */}
      <View style={styles.titleRow}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={15} color="#fafafa" />
        </View>
        <Text style={styles.titleText}>Action Confirmation Required</Text>
      </View>

      {/* Description */}
      {approval.description ? (
        <Text style={styles.descriptionText} numberOfLines={2}>
          {approval.description}
        </Text>
      ) : null}

      {/* Code / Command Preview Box (Paradev Inset Box) */}
      <View style={styles.codeBox}>
        <View style={styles.codeHeader}>
          <Terminal size={12} color="#a3a3a3" />
          <Text style={styles.codeToolName}>tool: {approval.tool || 'bash'}</Text>
        </View>
        <Text style={styles.codeContent} selectable numberOfLines={4}>
          {approval.command || 'No command details available.'}
        </Text>
      </View>

      {/* Decision Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.denyBtn, isResponding && styles.btnDisabled]}
          onPress={onDeny}
          disabled={isResponding}
          activeOpacity={0.75}
        >
          <X size={14} color="#ef4444" />
          <Text style={styles.denyBtnText}>Deny</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.authorizeBtn, isResponding && styles.btnDisabled]}
          onPress={onAuthorize}
          disabled={isResponding}
          activeOpacity={0.85}
        >
          {isResponding ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Check size={14} color="#0a0a0a" />
              <Text style={styles.authorizeBtnText}>Authorize</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1C1C1C', // Paradev ApprovalCard background
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 13,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  askerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  askerBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#a3a3a3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  riskBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ef4444',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#fafafa',
  },
  descriptionText: {
    fontSize: 12,
    color: '#a3a3a3',
    lineHeight: 17,
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: '#121212',
    borderRadius: radii.btn,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeToolName: {
    fontSize: 10.5,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeContent: {
    padding: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11.5,
    color: '#fafafa',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  denyBtn: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.btn,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  denyBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ef4444',
  },
  authorizeBtn: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.btn,
    backgroundColor: '#fafafa',
  },
  authorizeBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

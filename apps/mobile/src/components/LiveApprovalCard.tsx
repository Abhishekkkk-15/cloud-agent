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
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <ShieldAlert size={16} color="#f85149" />
        </View>
        <View style={styles.titleCol}>
          <Text style={styles.titleText}>Action Confirmation Required</Text>
          <Text style={styles.subtitleText} numberOfLines={1}>
            {approval.targetNode || 'Host Daemon'} • {approval.caller || 'Antigravity'}
          </Text>
        </View>
        <View style={styles.riskBadge}>
          <Text style={styles.riskBadgeText}>
            {approval.riskLevel ? `${approval.riskLevel.toUpperCase()}` : 'PRIVILEGED'}
          </Text>
        </View>
      </View>

      {/* Description */}
      {approval.description ? (
        <Text style={styles.descriptionText} numberOfLines={2}>
          {approval.description}
        </Text>
      ) : null}

      {/* Code / Command Preview Box */}
      <View style={styles.codeBox}>
        <View style={styles.codeHeader}>
          <Terminal size={12} color="#8b949e" />
          <Text style={styles.codeToolName}>tool: {approval.tool || 'bash'}</Text>
        </View>
        <Text style={styles.codeContent} selectable numberOfLines={4}>
          {approval.command || 'No command details available.'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.denyBtn, isResponding && styles.btnDisabled]}
          onPress={onDeny}
          disabled={isResponding}
          activeOpacity={0.7}
        >
          <X size={14} color="#f85149" />
          <Text style={styles.denyBtnText}>Deny Action</Text>
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
              <Check size={14} color="#ffffff" />
              <Text style={styles.authorizeBtnText}>Authorize Execution</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#161b22',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.4)',
    padding: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  subtitleText: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 1,
  },
  riskBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.4)',
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#f85149',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 12,
    color: '#c9d1d9',
    lineHeight: 17,
    marginBottom: 8,
  },
  codeBox: {
    backgroundColor: '#010409',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    marginBottom: 10,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#0d1117',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
  },
  codeToolName: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeContent: {
    padding: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#48cae4',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  denyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.sm,
    paddingVertical: 9,
  },
  denyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f85149',
  },
  authorizeBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0077b6',
    borderRadius: radii.sm,
    paddingVertical: 9,
  },
  authorizeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

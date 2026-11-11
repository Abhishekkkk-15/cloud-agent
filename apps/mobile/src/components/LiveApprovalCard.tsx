import React from 'react';
import { View } from 'react-native';
import { Card, Badge, Button, Spinner, Text, cn } from 'panelui-native';
import { ShieldAlert, Check, X, Terminal } from './Icons';
import { useDaemonStore, type ApprovalRequest } from '../stores/useDaemonStore';

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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const riskLevel = approval.riskLevel ? approval.riskLevel.toUpperCase() : 'PRIVILEGED';
  const isHighRisk = riskLevel === 'PRIVILEGED' || riskLevel === 'ELEVATED' || riskLevel === 'CRITICAL';

  return (
    <Card className="my-2 p-3.5 bg-surface border border-border rounded-2xl shadow-sm">
      {/* Top Header Row */}
      <View className="flex-row items-center justify-between mb-2.5">
        <Badge variant="outline" size="sm" className="px-2 py-0.5">
          <Text className="text-[11px] font-mono font-medium text-muted-foreground">
            {approval.caller || 'Antigravity'} • {approval.targetNode || 'Host Daemon'}
          </Text>
        </Badge>
        <Badge
          variant={isHighRisk ? 'destructive' : 'secondary'}
          size="sm"
          className="px-2 py-0.5"
        >
          <Text
            className={cn(
              'text-[10px] font-bold tracking-wider',
              isHighRisk ? 'text-destructive-foreground' : 'text-foreground'
            )}
          >
            {riskLevel}
          </Text>
        </Badge>
      </View>

      {/* Title & Icon */}
      <View className="flex-row items-center gap-2 mb-1.5">
        <View className="w-6 h-6 rounded-md bg-destructive/10 border border-destructive/25 items-center justify-center">
          <ShieldAlert size={14} color="#ef4444" />
        </View>
        <Text className="text-sm font-semibold text-foreground flex-1">
          Action Confirmation Required
        </Text>
      </View>

      {/* Description */}
      {approval.description ? (
        <Text className="text-xs text-muted-foreground leading-relaxed mb-2.5" numberOfLines={2}>
          {approval.description}
        </Text>
      ) : null}

      {/* Code / Command Preview Box */}
      <View className="p-2.5 rounded-xl bg-surface-secondary border border-border mb-3">
        <View className="flex-row items-center gap-1.5 mb-1.5 pb-1 border-b border-border">
          <Terminal size={12} color={isLight ? '#262626' : '#a3a3a3'} />
          <Text className="text-[11px] font-mono text-muted-foreground">
            tool: {approval.tool || 'bash'}
          </Text>
        </View>
        <Text
          className="text-xs font-mono text-foreground leading-relaxed select-all"
          selectable
          numberOfLines={4}
        >
          {approval.command || 'No command details available.'}
        </Text>
      </View>

      {/* Decision Action Buttons */}
      <View className="flex-row items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-destructive/30 bg-destructive/5 flex-row items-center justify-center gap-1.5 py-2"
          onPress={onDeny}
          disabled={isResponding}
        >
          <X size={14} color="#ef4444" />
          <Text className="text-xs font-semibold text-destructive">Deny</Text>
        </Button>

        <Button
          variant="primary"
          size="sm"
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2"
          onPress={onAuthorize}
          disabled={isResponding}
        >
          {isResponding ? (
            <Spinner size="sm" color={isLight ? '#fafafa' : '#262626'} />
          ) : (
            <>
              <Check size={14} color={isLight ? '#fafafa' : '#262626'} />
              <Text className="text-xs font-semibold text-primary-foreground">Authorize</Text>
            </>
          )}
        </Button>
      </View>
    </Card>
  );
};

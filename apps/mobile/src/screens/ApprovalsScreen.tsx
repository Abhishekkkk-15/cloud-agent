import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Badge,
  Button,
  Checkbox,
  Item,
  Text,
  ScrollHeader,
  Spinner,
  toast,
  cn,
} from 'panelui-native';
import {
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  X,
  ChevronLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
  Bell,
} from '../components/Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { getGlossyHeaderTokens } from '../theme/tokens';

interface ApprovalsScreenProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ApprovalsScreen: React.FC<ApprovalsScreenProps> = ({ onBack }) => {
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const decisionTrail = useDaemonStore((s) => s.decisionTrail);
  const respondApproval = useDaemonStore((s) => s.respondApproval);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight), [isLight]);

  const [rememberRule, setRememberRule] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    toast.show({
      variant: 'default',
      label: 'Command copied to clipboard',
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      await respondApproval(true);
      toast.show({
        variant: 'success',
        label: 'Action Authorized',
        description: 'Command authorization dispatched to host daemon.',
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      await respondApproval(false);
      toast.show({
        variant: 'destructive',
        label: 'Action Denied',
        description: 'Command execution aborted.',
      });
    } finally {
      setIsDenying(false);
    }
  };

  const targetNode = pendingApproval?.targetNode || activeMachine?.name || 'Local Machine';

  return (
    <ScrollHeader className="flex-1 bg-background" inset={true}>
      <ScrollHeader.Bar divider={false} surface="blur">
        {onBack && (
          <TouchableOpacity
            style={[
              { width: 44, height: 44, borderRadius: 22 },
              glossyHeader.containerStyle,
            ]}
            className="items-center justify-center mr-2.5 active:opacity-70"
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={24} color={glossyHeader.iconColor} />
          </TouchableOpacity>
        )}
        <ScrollHeader.Title className="text-base font-semibold text-foreground">
          Command Approvals
        </ScrollHeader.Title>
      </ScrollHeader.Bar>

      <ScrollHeader.Large className="px-4 pb-3">
        <ScrollHeader.Title className="text-2xl font-bold text-foreground">
          Command Approvals
        </ScrollHeader.Title>
        <ScrollHeader.Description className="text-xs text-muted-foreground mt-0.5">
          {targetNode}
        </ScrollHeader.Description>
      </ScrollHeader.Large>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Status Bar Row */}
        <View className="flex-row items-center justify-between mb-3">
          <Badge
            variant={pendingApproval ? 'destructive' : 'success'}
            size="sm"
            className="px-2.5 py-1"
          >
            <Text className="text-xs font-semibold">
              {pendingApproval ? 'Pending Review' : 'All Clear'}
            </Text>
          </Badge>
          <Text className="text-xs font-mono text-muted-foreground">
            {pendingApproval ? '1 action pending' : '0 actions pending'}
          </Text>
        </View>

        {/* 2. Checks Summary Card */}
        <Card className="p-4 bg-surface border border-border rounded-xl mb-3">
          <View className="flex-row items-center gap-3">
            <View
              className={cn(
                'w-9 h-9 rounded-full items-center justify-center border',
                pendingApproval
                  ? 'bg-destructive/10 border-destructive/25'
                  : 'bg-success/10 border-success/25'
              )}
            >
              {pendingApproval ? (
                <AlertTriangle size={16} color="#ef4444" />
              ) : (
                <CheckCheck size={16} color="#10b981" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">
                {pendingApproval
                  ? 'Action Approval Required'
                  : 'No Actions Pending'}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {pendingApproval
                  ? `Caller: ${pendingApproval.caller || 'Agent'} requested command execution`
                  : 'All tool execution policies satisfied'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          {pendingApproval && (
            <View className="flex-row items-center gap-2 pt-3 mt-3 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onPress={handleDeny}
                disabled={isDenying || isAuthorizing}
                className="flex-1 flex-row items-center justify-center gap-1.5"
              >
                {isDenying ? (
                  <Spinner size="sm" color="#ffffff" />
                ) : (
                  <>
                    <X size={14} color="#ffffff" />
                    <Text className="text-xs font-semibold text-destructive-foreground">Deny / Abort</Text>
                  </>
                )}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onPress={handleAuthorize}
                disabled={isDenying || isAuthorizing}
                className="flex-1 flex-row items-center justify-center gap-1.5"
              >
                {isAuthorizing ? (
                  <Spinner size="sm" color={isLight ? '#fafafa' : '#262626'} />
                ) : (
                  <>
                    <Check size={14} color={isLight ? '#fafafa' : '#262626'} />
                    <Text className="text-xs font-semibold text-primary-foreground">Authorize Action</Text>
                  </>
                )}
              </Button>
            </View>
          )}
        </Card>

        {/* Lock-Screen Push Notifications Hint */}
        {!pendingApproval && (
          <Card className="p-3 bg-surface border border-border rounded-xl mb-3 flex-row items-center gap-2.5">
            <View className="w-7 h-7 rounded-lg bg-surface-secondary items-center justify-center border border-border">
              <Bell size={13} color={isPushRegistered ? '#10b981' : (isLight ? '#686868' : '#a3a3a3')} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs font-semibold text-foreground">
                  Lock-Screen Approvals Active
                </Text>
                <Badge variant={isPushRegistered ? 'success' : 'secondary'} size="sm" className="px-1.5 py-0">
                  <Text className="text-[10px] font-medium">{isPushRegistered ? 'Push Ready' : 'In-App'}</Text>
                </Badge>
              </View>
              <Text className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                When new bash commands need review, actionable [✓ Approve] & [✕ Reject] alerts arrive directly on your lock screen.
              </Text>
            </View>
          </Card>
        )}

        {/* 3. Code Diff & Terminal Command Preview */}
        {pendingApproval && (
          <Card className="p-3 bg-surface-secondary border border-border rounded-xl mb-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-1.5">
                <Terminal size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                <Text className="text-xs font-mono font-medium text-foreground">
                  tool:{pendingApproval.tool || 'run_command'}
                </Text>
                <Badge variant="destructive" size="sm" className="px-1.5 py-0">
                  <Text className="text-[10px] font-bold text-destructive-foreground">
                    {pendingApproval.riskLevel ? pendingApproval.riskLevel.toUpperCase() : 'ELEVATED'}
                  </Text>
                </Badge>
              </View>
              <Button
                variant="outline"
                size="xs"
                onPress={handleCopy}
                className="flex-row items-center gap-1 px-2 py-0.5"
              >
                {copied ? (
                  <>
                    <Check size={11} color="#10b981" />
                    <Text className="text-xs font-medium text-success">Copied</Text>
                  </>
                ) : (
                  <>
                    <Copy size={11} color={isLight ? '#686868' : '#a3a3a3'} />
                    <Text className="text-xs font-medium text-muted-foreground">Copy</Text>
                  </>
                )}
              </Button>
            </View>

            {/* Description & Justification */}
            <View className="mb-2">
              <Text className="text-xs text-foreground font-medium mb-0.5">
                {pendingApproval.description}
              </Text>
              {pendingApproval.justification ? (
                <Text className="text-xs text-muted-foreground italic">
                  "{pendingApproval.justification}"
                </Text>
              ) : null}
            </View>

            {/* Snippet */}
            <View className="p-2.5 rounded-lg bg-surface border border-border mb-3">
              <View className="flex-row items-start gap-1.5">
                <Text className="text-xs font-mono font-bold text-muted-foreground">$</Text>
                <Text className="text-xs font-mono text-foreground flex-1 leading-relaxed" selectable>
                  {pendingApproval.command}
                </Text>
              </View>
            </View>

            {/* Remember Checkbox */}
            <Checkbox
              checked={rememberRule}
              onCheckedChange={setRememberRule}
              label="Always permit this action for current session"
            />
          </Card>
        )}

        {/* 4. Decision Audit Trail */}
        <View className="flex-row items-center justify-between mb-2 px-1">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Decision Audit Trail
          </Text>
          <Badge variant="outline" size="sm" className="px-1.5 py-0">
            <Text className="text-[11px] font-mono text-muted-foreground">{decisionTrail.length} recorded</Text>
          </Badge>
        </View>

        {decisionTrail.length > 0 ? (
          decisionTrail.map((item) => (
            <Item
              key={item.id}
              variant="default"
              size="xs"
              className="px-3 py-2 rounded-xl mb-1.5"
            >
              <Item.Media variant="icon">
                {item.approved ? (
                  <Check size={14} color="#10b981" />
                ) : (
                  <X size={14} color="#ef4444" />
                )}
              </Item.Media>
              <Item.Content>
                <Item.Title className="text-xs font-mono font-medium text-foreground" numberOfLines={1}>
                  {item.command}
                </Item.Title>
                <Item.Description className={cn('text-[11px]', item.approved ? 'text-success' : 'text-destructive')}>
                  {item.details} • {item.timestamp}
                </Item.Description>
              </Item.Content>
            </Item>
          ))
        ) : (
          <Card className="p-4 bg-surface border border-border rounded-xl items-center justify-center">
            <Text className="text-xs text-muted-foreground text-center">
              No actions executed in this session yet.
            </Text>
          </Card>
        )}
      </ScrollView>
    </ScrollHeader>
  );
};

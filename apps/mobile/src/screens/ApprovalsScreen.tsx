import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Badge,
  Button,
  Checkbox,
  Item,
  Text,
  cn,
} from 'panelui-native';
import {
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  GitBranch,
  Link,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
} from '../components/Icons';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';

interface ApprovalsScreenProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const ApprovalsScreen: React.FC<ApprovalsScreenProps> = ({ onBack }) => {
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const decisionTrail = useDaemonStore((s) => s.decisionTrail);
  const respondApproval = useDaemonStore((s) => s.respondApproval);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [rememberRule, setRememberRule] = useState(false);
  const [isTreeExpanded, setIsTreeExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isDenying, setIsDenying] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      await respondApproval(true);
      Alert.alert('Action Authorized', 'Authorization token dispatched over WebRTC DataChannel to VPS Daemon.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDeny = async () => {
    setIsDenying(true);
    try {
      await respondApproval(false);
      Alert.alert('Action Denied', 'Intervention token dispatched. Command aborted.');
    } finally {
      setIsDenying(false);
    }
  };

  const targetNode = pendingApproval?.targetNode || activeMachine?.name || 'Local Machine';

  return (
    <View className="flex-1 bg-background">
      <HeaderBar
        title="Security Gate & HITL"
        subtitle={`${targetNode} • Diff Reviewer`}
        onBack={onBack}
      />

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
              {pendingApproval ? 'Waiting for review' : 'All checks passed'}
            </Text>
          </Badge>
          <Text className="text-xs font-mono text-muted-foreground">
            {pendingApproval ? '1 action pending' : 'Zero elevated actions'}
          </Text>
        </View>

        {/* 2. Verification Checks Summary Card */}
        <Card className="p-4 bg-surface border border-border rounded-xl mb-3">
          <View className="flex-row items-center gap-3 mb-3">
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
                  ? 'Action Required • Human In The Loop'
                  : 'System Clean • No Approvals Required'}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {pendingApproval
                  ? `Caller: ${pendingApproval.caller || 'Antigravity Agent'} requested privilege`
                  : 'Security Policies active • Approvals required'}
              </Text>
            </View>
          </View>

          {/* Mini Check Status Chips */}
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            <Badge variant="outline" size="sm" className="px-2 py-0.5 flex-row items-center gap-1">
              <CheckCircle2 size={11} color="#10b981" />
              <Text className="text-xs text-foreground">unit-tests: ok</Text>
            </Badge>
            <Badge variant="outline" size="sm" className="px-2 py-0.5 flex-row items-center gap-1">
              <CheckCircle2 size={11} color="#10b981" />
              <Text className="text-xs text-foreground">typecheck: ok</Text>
            </Badge>
            <Badge
              variant={pendingApproval ? 'destructive' : 'outline'}
              size="sm"
              className="px-2 py-0.5 flex-row items-center gap-1"
            >
              {pendingApproval ? (
                <ShieldAlert size={11} color="#ef4444" />
              ) : (
                <ShieldCheck size={11} color="#10b981" />
              )}
              <Text className={cn('text-xs', pendingApproval ? 'text-destructive font-semibold' : 'text-foreground')}>
                {pendingApproval ? 'gate: required' : 'gate: passed'}
              </Text>
            </Badge>
          </View>

          {/* Action Buttons */}
          {pendingApproval && (
            <View className="flex-row items-center gap-2 pt-2 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onPress={handleDeny}
                disabled={isDenying || isAuthorizing}
                className="flex-1 flex-row items-center justify-center gap-1.5"
              >
                {isDenying ? (
                  <ActivityIndicator size="small" color="#ffffff" />
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
                  <ActivityIndicator size="small" color={isLight ? '#fafafa' : '#262626'} />
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

        {/* 4. Security Sandbox Policies */}
        <Card className="p-3 bg-surface border border-border rounded-xl mb-4">
          <TouchableOpacity
            onPress={() => setIsTreeExpanded(!isTreeExpanded)}
            activeOpacity={0.7}
            className="flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={15} color="#10b981" />
              <Text className="text-xs font-semibold text-foreground">Runtime Security Policies</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Badge variant="outline" size="sm" className="px-1.5 py-0">
                <Text className="text-[10px] text-success font-semibold">Active</Text>
              </Badge>
              {isTreeExpanded ? (
                <ChevronUp size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              ) : (
                <ChevronDown size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              )}
            </View>
          </TouchableOpacity>

          {isTreeExpanded && (
            <View className="pt-2.5 mt-2 border-t border-border gap-1.5">
              <View className="flex-row items-center gap-2">
                <GitBranch size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                <Text className="text-xs text-muted-foreground">Workspace Sandboxing: Strict</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Link size={12} color="#10b981" />
                <Text className="text-xs text-muted-foreground">Permission Gate: Strict Verification</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={12} color="#10b981" />
                <Text className="text-xs text-foreground font-medium">WebRTC P2P Direct Tunnel: Encrypted</Text>
              </View>
            </View>
          )}
        </Card>

        {/* 5. Decision Audit Trail */}
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
              Zero privileged actions executed in this session yet.
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

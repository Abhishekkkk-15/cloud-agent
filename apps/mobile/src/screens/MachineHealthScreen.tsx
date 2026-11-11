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
  Progress,
  Item,
  Text,
  GridItem,
  cn,
} from 'panelui-native';
import {
  Server,
  Cpu,
  Layers,
  HardDrive,
  Radio,
  RefreshCw,
  Zap,
  Power,
  ChevronRight,
  Bell,
  Bug,
  GitPullRequest,
  Github,
  GitBranch,
  User,
  Mail,
  Terminal,
} from '../components/Icons';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MachineSwitcherModal } from '../components/MachineSwitcherModal';
import { PairMachineModal } from '../components/PairMachineModal';
import { ServerSettingsModal } from '../components/ServerSettingsModal';
import { AutoHealerModal } from '../components/AutoHealerModal';
import { GitHubWebhookModal } from '../components/GitHubWebhookModal';

interface MachineHealthScreenProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const MachineHealthScreen: React.FC<MachineHealthScreenProps> = ({
  onBack,
  onNavigateTab,
}) => {
  const connectionState = useDaemonStore((s) => s.connectionState);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const pingHeartbeat = useDaemonStore((s) => s.pingHeartbeat);
  const refreshStatus = useDaemonStore((s) => s.refreshStatus);
  const pushStatus = useDaemonStore((s) => s.pushStatus);
  const isPushRegistered = useDaemonStore((s) => s.isPushRegistered);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const activeProposal = useDaemonStore((s) => s.activeProposal);
  const activePrReview = useDaemonStore((s) => s.activePrReview);
  const isAutoHealerModalVisible = useDaemonStore((s) => s.isAutoHealerModalVisible);
  const isSimulatingIncident = useDaemonStore((s) => s.isSimulatingIncident);
  const simulateAutoHealerIncident = useDaemonStore((s) => s.simulateAutoHealerIncident);
  const simulatePrReview = useDaemonStore((s) => s.simulatePrReview);
  const dismissAutoHealer = useDaemonStore((s) => s.dismissAutoHealer);
  const openAutoHealerProposal = useDaemonStore((s) => s.openAutoHealerProposal);
  const openAutoPrReview = useDaemonStore((s) => s.openAutoPrReview);
  const githubStatus = useDaemonStore((s) => s.githubStatus);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [isPinging, setIsPinging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMachineSwitcher, setShowMachineSwitcher] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    await pingHeartbeat();
    setIsPinging(false);
  };

  const handleSimulateBug = async () => {
    const res = await simulateAutoHealerIncident();
    if (!res.success) {
      Alert.alert('Simulation Note', res.message);
    }
  };

  const handleSimulatePr = async () => {
    const res = await simulatePrReview();
    if (!res.success) {
      Alert.alert('Simulation Note', res.message);
    }
  };

  const isConnected = connectionState === 'connected';

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const uptimeStr = daemonStatus?.uptime ? formatUptime(daemonStatus.uptime) : 'Online';
  const pidStr = daemonStatus?.pid ? String(daemonStatus.pid) : 'Daemon';
  const hostName = activeMachine?.name || daemonStatus?.hostname || 'Local Machine';
  const platformStr = activeMachine
    ? `${activeMachine.platform} ${activeMachine.arch}`
    : daemonStatus
    ? `${daemonStatus.platform} ${daemonStatus.arch}`
    : 'Host System';

  const adapters = daemonStatus?.adapters?.map((a) => {
    const avail = daemonStatus?.availability?.[a.id];
    return {
      id: a.id,
      name: a.displayName || a.name || a.id,
      version: avail?.version ? `agy ${avail.version}` : (a.version || 'installed'),
      binaryPath: avail?.binaryPath || a.binaryPath || 'stdio RPC',
      status: avail?.available ? ('active' as const) : ('ready' as const),
    };
  }) || [];

  const cpuPercent = daemonStatus?.telemetry?.cpu?.percent ?? 0;
  const ramPercent = daemonStatus?.telemetry?.ram?.percent ?? 0;
  const diskPercent = daemonStatus?.telemetry?.disk?.percent ?? 0;

  return (
    <View className="flex-1 bg-background">
      <HeaderBar
        title="Machine & CLI Health"
        subtitle={`${hostName} • ${platformStr}`}
        onBack={onBack}
        onMore={handleRefresh}
        rightElement={
          <View className="flex-row items-center gap-1.5">
            {isRefreshing && (
              <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} style={{ transform: [{ scale: 0.75 }] }} />
            )}
            <Button
              variant="outline"
              size="xs"
              className="flex-row items-center gap-1 px-2.5 py-1"
              onPress={() => setShowMachineSwitcher(true)}
            >
              <Server size={13} color={isLight ? '#262626' : '#f5f5f5'} />
              <Text className="text-xs font-medium text-foreground">Switch</Text>
            </Button>
          </View>
        }
      />

      {/* Sub-bar */}
      <View className="px-4 py-2 bg-surface border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <View
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-success' : 'bg-destructive'
            )}
          />
          <Text className="text-xs text-muted-foreground font-mono" numberOfLines={1}>
            {isConnected ? 'GATEWAY CONNECTED' : connectionState.toUpperCase()} • PID: {pidStr} • Uptime: {uptimeStr}
          </Text>
        </View>
        <Badge variant="outline" size="xs">
          {pingRtt || '18ms'}
        </Badge>
      </View>

      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="p-4 gap-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Host System State Card */}
        <Card className="p-4 bg-card border border-border rounded-2xl">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-10 h-10 rounded-xl bg-surface items-center justify-center border border-border">
                <Server size={20} color={isLight ? '#262626' : '#f5f5f5'} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {hostName}
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                  {platformStr}
                </Text>
              </View>
            </View>

            <Badge variant={isConnected ? 'success' : 'destructive'} size="sm">
              {isConnected ? 'Connected' : connectionState}
            </Badge>
          </View>
        </Card>

        {/* Telemetry & Resource Pools */}
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Telemetry & Resource Pools
          </Text>

          <GridItem.Group columns={2} gap={10} rowHeight={135} size="sm">
            {/* CPU Metric */}
            <GridItem colSpan={1} rowSpan={1} className="p-3 bg-card border-border">
              <GridItem.Media variant="icon">
                <Cpu size={16} color={isLight ? '#262626' : '#f5f5f5'} />
              </GridItem.Media>
              <GridItem.Title>CPU Load</GridItem.Title>
              <GridItem.Value
                className={cn(
                  'text-xl font-bold font-mono',
                  cpuPercent > 85 ? 'text-destructive' : cpuPercent > 70 ? 'text-warning' : 'text-success'
                )}
              >
                {cpuPercent}%
              </GridItem.Value>
              <GridItem.Description numberOfLines={1}>
                {daemonStatus?.telemetry?.cpu?.cores ?? 4} Cores • {daemonStatus?.telemetry?.cpu?.speedMhz ? `${daemonStatus.telemetry.cpu.speedMhz} MHz` : 'Active'}
              </GridItem.Description>
              <GridItem.Footer>
                <Progress
                  value={cpuPercent}
                  color={cpuPercent > 85 ? 'destructive' : cpuPercent > 70 ? 'warning' : 'success'}
                  size="sm"
                />
              </GridItem.Footer>
            </GridItem>

            {/* RAM Metric */}
            <GridItem colSpan={1} rowSpan={1} className="p-3 bg-card border-border">
              <GridItem.Media variant="icon">
                <Layers size={16} color={isLight ? '#262626' : '#f5f5f5'} />
              </GridItem.Media>
              <GridItem.Title>Physical RAM</GridItem.Title>
              <GridItem.Value className="text-xl font-bold font-mono">
                {daemonStatus?.telemetry?.ram?.usedGb ?? 0} GB
              </GridItem.Value>
              <GridItem.Description numberOfLines={1}>
                {ramPercent}% of {daemonStatus?.telemetry?.ram?.totalGb ?? 0} GB
              </GridItem.Description>
              <GridItem.Footer>
                <Progress
                  value={ramPercent}
                  color={ramPercent > 85 ? 'destructive' : ramPercent > 70 ? 'warning' : 'success'}
                  size="sm"
                />
              </GridItem.Footer>
            </GridItem>

            {/* Persistent Storage Volume Metric (Full Width Bento Card) */}
            <GridItem colSpan={2} rowSpan={1} className="p-3 bg-card border-border">
              <View className="flex-row items-center justify-between w-full">
                <View className="flex-row items-center gap-2 flex-1 mr-2">
                  <GridItem.Media variant="icon">
                    <HardDrive size={16} color={isLight ? '#262626' : '#f5f5f5'} />
                  </GridItem.Media>
                  <View className="flex-1">
                    <GridItem.Title>Disk Storage</GridItem.Title>
                    <GridItem.Description numberOfLines={1}>
                      {daemonStatus?.telemetry?.disk ? `Free: ${daemonStatus.telemetry.disk.freeGb} GB • Direct I/O` : 'Direct I/O NDJSON'}
                    </GridItem.Description>
                  </View>
                </View>
                <GridItem.Value className="text-base font-bold font-mono shrink-0">
                  {daemonStatus?.telemetry?.disk ? `${daemonStatus.telemetry.disk.usedGb} / ${daemonStatus.telemetry.disk.totalGb} GB (${diskPercent}%)` : 'Active'}
                </GridItem.Value>
              </View>
              <GridItem.Footer>
                <Progress
                  value={diskPercent}
                  color={diskPercent > 90 ? 'destructive' : diskPercent > 75 ? 'warning' : 'success'}
                  size="sm"
                />
              </GridItem.Footer>
            </GridItem>
          </GridItem.Group>
        </View>

        {/* Active Coding Adapters */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Coding Adapters
            </Text>
            <Badge variant="outline" size="xs">
              {adapters.length} registered
            </Badge>
          </View>

          {adapters.length === 0 ? (
            <Card className="p-4 bg-card border border-border rounded-2xl items-center">
              <Text className="text-xs text-muted-foreground font-mono text-center">
                No adapters detected yet. Connect daemon to register CLI tools.
              </Text>
            </Card>
          ) : (
            <Card className="bg-card border border-border rounded-2xl overflow-hidden p-0">
              {adapters.map((adapter, idx) => (
                <View
                  key={adapter.id || idx}
                  className={cn(
                    'p-3 flex-row items-center justify-between',
                    idx > 0 && 'border-t border-border'
                  )}
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <View className="w-8 h-8 rounded-lg bg-surface items-center justify-center border border-border">
                      <Terminal size={15} color={isLight ? '#262626' : '#f5f5f5'} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-xs font-semibold text-foreground">
                          {adapter.name || adapter.id}
                        </Text>
                        <Badge variant="outline" size="xs">
                          {adapter.version || 'installed'}
                        </Badge>
                      </View>
                      <Text className="text-[11px] font-mono text-muted-foreground mt-0.5" numberOfLines={1}>
                        {adapter.binaryPath || 'stdio RPC'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Badge variant={adapter.status === 'active' ? 'default' : 'secondary'} size="xs">
                      {adapter.status === 'active' ? 'Active' : 'Ready'}
                    </Badge>
                    <ChevronRight size={14} color={isLight ? '#686868' : '#a3a3a3'} />
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        {/* Push Notifications & Gateway */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Push Notifications & Gateway
            </Text>
            <Button variant="ghost" size="xs" onPress={() => setShowServerSettings(true)}>
              Configure
            </Button>
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setShowServerSettings(true)}>
            <Card className="p-4 bg-card border border-border rounded-2xl gap-2.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Bell size={15} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-sm font-semibold text-foreground">
                    Native Push Notifications
                  </Text>
                </View>
                <Badge variant={isPushRegistered ? 'default' : 'secondary'} size="xs">
                  {isPushRegistered ? 'Active' : 'Standby'}
                </Badge>
              </View>

              <Text className="text-xs text-muted-foreground leading-relaxed" numberOfLines={2}>
                {pushStatus}
              </Text>

              <View className="pt-2.5 border-t border-border flex-row items-center justify-between gap-2">
                <Text className="text-[11px] font-mono text-muted-foreground flex-1" numberOfLines={1}>
                  Gateway: {gatewayUrl.replace(/^https?:\/\//, '')}
                </Text>
                <View className="flex-row items-center gap-1 shrink-0">
                  <Text className="text-xs font-semibold text-foreground">Configure</Text>
                  <ChevronRight size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Autonomous On-Call & PR Reviewer */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Autonomous On-Call & PR Reviewer
            </Text>
            <Button variant="ghost" size="xs" onPress={() => setShowGithubModal(true)}>
              Webhook & Token
            </Button>
          </View>

          <Card className="p-4 bg-card border border-border rounded-2xl gap-3">
            {/* Active Proposal Card */}
            {activeProposal && (
              <TouchableOpacity
                className="p-3 bg-success/10 border border-success/20 rounded-xl flex-row items-center justify-between"
                onPress={() => openAutoHealerProposal(activeProposal)}
                activeOpacity={0.7}
              >
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Bug size={13} color="#10b981" />
                    <Text className="text-xs font-bold text-foreground">Fix Proposal Ready</Text>
                  </View>
                  <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                    {activeProposal.title}
                  </Text>
                </View>
                <Text className="text-xs font-semibold text-foreground">Review →</Text>
              </TouchableOpacity>
            )}

            {/* Active PR Review Card */}
            {activePrReview && (
              <TouchableOpacity
                className="p-3 bg-surface border border-border rounded-xl flex-row items-center justify-between"
                onPress={() => openAutoPrReview(activePrReview)}
                activeOpacity={0.7}
              >
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <GitPullRequest size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-bold text-foreground">
                      PR Review Ready ({activePrReview.verdict})
                    </Text>
                  </View>
                  <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
                    PR #{activePrReview.prNumber}: {activePrReview.prTitle}
                  </Text>
                </View>
                <Text className="text-xs font-semibold text-foreground">Review →</Text>
              </TouchableOpacity>
            )}

            <Text className="text-xs text-muted-foreground leading-relaxed">
              24/7 on-call agent listens to GitHub & Sentry webhooks, investigates bugs, writes tests, applies fixes, and conducts PR reviews autonomously.
            </Text>

            <View className="flex-row items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 flex-row items-center gap-1.5 border-destructive/30 bg-destructive/10"
                onPress={handleSimulateBug}
                disabled={isSimulatingIncident}
              >
                {isSimulatingIncident ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Bug size={14} color="#ef4444" />
                    <Text className="text-xs font-semibold text-destructive">Simulate Bug</Text>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="flex-1 flex-row items-center gap-1.5"
                onPress={handleSimulatePr}
                disabled={isSimulatingIncident}
              >
                {isSimulatingIncident ? (
                  <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} />
                ) : (
                  <>
                    <GitPullRequest size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-semibold text-foreground">Simulate PR</Text>
                  </>
                )}
              </Button>
            </View>
          </Card>
        </View>

        {/* Dedicated GitHub & Git Host Identity Section */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              GitHub & Git Identity
            </Text>
            <Button variant="ghost" size="xs" onPress={() => setShowGithubModal(true)}>
              {githubStatus?.authenticated ? 'Manage →' : 'Configure →'}
            </Button>
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={() => setShowGithubModal(true)}>
            <Card className="p-4 bg-card border border-border rounded-2xl gap-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                  <View className="w-9 h-9 rounded-xl bg-surface items-center justify-center border border-border">
                    <Github size={18} color={isLight ? '#262626' : '#f5f5f5'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-foreground">
                      GitHub & Git Identity
                    </Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      {githubStatus?.authenticated
                        ? `Authenticated as @${githubStatus.username}`
                        : 'Personal Access Token & Git author profile'}
                    </Text>
                  </View>
                </View>

                <Badge variant={githubStatus?.authenticated ? 'default' : 'secondary'} size="xs">
                  {githubStatus?.authenticated ? 'Active' : 'Standby'}
                </Badge>
              </View>

              {/* Git identity metadata pill row if authenticated */}
              {githubStatus?.authenticated && (
                <View className="flex-row items-center flex-wrap gap-2 pt-2 border-t border-border">
                  {githubStatus.gitUserName ? (
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                      <User size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                      <Text className="text-xs font-medium text-foreground">
                        {githubStatus.gitUserName}
                      </Text>
                    </View>
                  ) : null}

                  {githubStatus.gitUserEmail ? (
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                      <Mail size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                      <Text className="text-xs font-medium text-foreground">
                        {githubStatus.gitUserEmail}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border">
                    <GitBranch size={12} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-medium text-foreground">
                      {githubStatus.source === 'token' ? 'PAT Token' : 'Host gh'}
                    </Text>
                  </View>
                </View>
              )}

              <View className="pt-2 border-t border-border flex-row items-center justify-between">
                <Text className="text-[11px] text-muted-foreground">
                  Host: <Text className="font-semibold text-foreground">{hostName}</Text>
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text className="text-xs font-medium text-foreground">Configure Identity</Text>
                  <ChevronRight size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Daemon Operations Bento Grid */}
        <View className="gap-2 mb-6">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Daemon Operations
          </Text>

          <GridItem.Group columns={2} gap={10} rowHeight={130} size="sm">
            <GridItem
              colSpan={1}
              rowSpan={1}
              onPress={handlePing}
              disabled={isPinging}
              className="p-3 pb-3.5 bg-card border-border"
            >
              <GridItem.Media variant="icon">
                {isPinging ? (
                  <ActivityIndicator size="small" color={isLight ? '#262626' : '#f5f5f5'} style={{ transform: [{ scale: 0.75 }] }} />
                ) : (
                  <Radio size={16} color={isLight ? '#262626' : '#f5f5f5'} />
                )}
              </GridItem.Media>
              <GridItem.Title>Heartbeat</GridItem.Title>
              <GridItem.Value className="text-base font-semibold">
                {isPinging ? 'Pinging...' : 'Ping Node'}
              </GridItem.Value>
              <GridItem.Description numberOfLines={1}>
                Check P2P latency
              </GridItem.Description>
            </GridItem>

            <GridItem
              colSpan={1}
              rowSpan={1}
              onPress={async () => {
                await handleRefresh();
                Alert.alert('Refreshed', 'Machine state and adapters queried from Daemon.');
              }}
              disabled={isRefreshing}
              className="p-3 pb-3.5 bg-card border-border"
            >
              <GridItem.Media variant="icon">
                <RefreshCw size={16} color={isLight ? '#262626' : '#f5f5f5'} />
              </GridItem.Media>
              <GridItem.Title>Host State</GridItem.Title>
              <GridItem.Value className="text-base font-semibold">
                Flush Cache
              </GridItem.Value>
              <GridItem.Description numberOfLines={1}>
                Sync tools & CLI
              </GridItem.Description>
            </GridItem>

            <GridItem
              colSpan={1}
              rowSpan={1}
              onPress={() => onNavigateTab && onNavigateTab('sessions')}
              className="p-3 pb-3.5 bg-card border-border"
            >
              <GridItem.Media variant="icon">
                <Zap size={16} color={isLight ? '#262626' : '#f5f5f5'} />
              </GridItem.Media>
              <GridItem.Title>Daemon Logs</GridItem.Title>
              <GridItem.Value className="text-base font-semibold">
                STDOUT
              </GridItem.Value>
              <GridItem.Description numberOfLines={1}>
                Live stream console
              </GridItem.Description>
            </GridItem>

            <GridItem
              colSpan={1}
              rowSpan={1}
              onPress={() => Alert.alert('Restart Daemon', `Restart command dispatched to ${hostName}.`)}
              className="p-3 pb-3.5 bg-card border-border border-destructive/30"
            >
              <GridItem.Media variant="icon" className="bg-destructive/10 border-destructive/20">
                <Power size={16} color="#ef4444" />
              </GridItem.Media>
              <GridItem.Title className="text-destructive">Daemon</GridItem.Title>
              <GridItem.Value className="text-base font-semibold text-destructive">
                Restart
              </GridItem.Value>
              <GridItem.Description numberOfLines={1} className="text-destructive/70">
                Reboot host daemon
              </GridItem.Description>
            </GridItem>
          </GridItem.Group>
        </View>
      </ScrollView>

      {/* Machine & VPS Switcher Modal */}
      <MachineSwitcherModal
        visible={showMachineSwitcher}
        onClose={() => setShowMachineSwitcher(false)}
        onPairNew={() => setShowPairModal(true)}
      />

      {/* Machine Pairing Modal */}
      <PairMachineModal
        visible={showPairModal}
        onClose={() => setShowPairModal(false)}
      />

      {/* Server & Push Notifications Modal */}
      <ServerSettingsModal
        visible={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />

      {/* Autonomous On-Call & PR Review Modal */}
      <AutoHealerModal
        visible={isAutoHealerModalVisible}
        onClose={dismissAutoHealer}
      />

      {/* GitHub Credentials & Webhook Setup Modal */}
      <GitHubWebhookModal
        visible={showGithubModal}
        onClose={() => setShowGithubModal(false)}
      />
    </View>
  );
};

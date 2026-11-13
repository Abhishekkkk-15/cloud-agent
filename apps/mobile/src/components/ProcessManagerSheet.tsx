import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  BottomSheet,
  Button,
  Badge,
  Card,
  Progress,
  Text,
  Spinner,
  EmptyState,
  toast,
  cn,
} from 'panelui-native';
import {
  Server,
  Cpu,
  Layers,
  Power,
  RefreshCw,
  Trash2,
  Play,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  X,
  Activity,
  HardDrive,
  Clock,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import type { CliWorkerInfo } from '@cloud-agent/cli-interface';

interface ProcessManagerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'daemon' | 'workers';
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(isoDate?: string): string {
  if (!isoDate) return 'Just now';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (isNaN(diffMs) || diffMs < 10000) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return `${Math.floor(diffMs / 1000)}s ago`;
}

export const ProcessManagerSheet: React.FC<ProcessManagerSheetProps> = ({
  isOpen,
  onClose,
  initialTab = 'daemon',
}) => {
  const [activeTab, setActiveTab] = useState<'daemon' | 'workers'>(initialTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);

  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const cliWorkers = useDaemonStore((s) => s.cliWorkers);
  const isLoadingWorkers = useDaemonStore((s) => s.isLoadingWorkers);
  const isRestartingDaemon = useDaemonStore((s) => s.isRestartingDaemon);
  const daemonLogLines = useDaemonStore((s) => s.daemonLogLines);
  const isLoadingDaemonLogs = useDaemonStore((s) => s.isLoadingDaemonLogs);

  const fetchCliWorkers = useDaemonStore((s) => s.fetchCliWorkers);
  const killCliWorker = useDaemonStore((s) => s.killCliWorker);
  const restartCliWorker = useDaemonStore((s) => s.restartCliWorker);
  const killAllIdleCliWorkers = useDaemonStore((s) => s.killAllIdleCliWorkers);
  const restartDaemonService = useDaemonStore((s) => s.restartDaemonService);
  const stopDaemonService = useDaemonStore((s) => s.stopDaemonService);
  const fetchDaemonLogs = useDaemonStore((s) => s.fetchDaemonLogs);
  const refreshStatus = useDaemonStore((s) => s.refreshStatus);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      handleRefreshAll();
    }
  }, [isOpen, initialTab]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchCliWorkers(),
        refreshStatus(),
        fetchDaemonLogs(100),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const idleWorkerCount = useMemo(() => {
    return cliWorkers.filter((w) => !w.isBusy).length;
  }, [cliWorkers]);

  const handleRestartDaemon = () => {
    Alert.alert(
      'Restart Cloud Agent Daemon?',
      'The daemon background service will restart on the host machine. The mobile client will auto-reconnect once the daemon finishes restarting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart Daemon',
          style: 'destructive',
          onPress: async () => {
            const ok = await restartDaemonService();
            if (ok) {
              toast.show({
                variant: 'default',
                label: 'Daemon Restart Signaled',
                description: 'Host service is cycling. Reconnecting in a few seconds...',
              });
            } else {
              toast.show({
                variant: 'destructive',
                label: 'Restart Failed',
                description: 'Could not deliver restart signal to host daemon.',
              });
            }
          },
        },
      ]
    );
  };

  const handleStopDaemon = () => {
    Alert.alert(
      'Stop Cloud Agent Daemon?',
      'The daemon background service will stop on the host machine. You will need SSH or direct terminal access on the host to restart it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Service',
          style: 'destructive',
          onPress: async () => {
            const ok = await stopDaemonService();
            if (ok) {
              toast.show({
                variant: 'warning',
                label: 'Daemon Stopped',
                description: 'Host background service has been shut down.',
              });
              onClose();
            } else {
              toast.show({
                variant: 'destructive',
                label: 'Stop Failed',
                description: 'Could not deliver stop signal to host daemon.',
              });
            }
          },
        },
      ]
    );
  };

  const handleKillWorker = (worker: CliWorkerInfo) => {
    const doKill = async () => {
      setActionSessionId(worker.sessionId);
      try {
        const ok = await killCliWorker(worker.sessionId);
        if (ok) {
          toast.show({
            variant: 'default',
            label: 'Worker Terminated',
            description: `Worker PID ${worker.pid || worker.sessionId} was terminated.`,
          });
        }
      } finally {
        setActionSessionId(null);
      }
    };

    if (worker.isBusy) {
      Alert.alert(
        'Terminate Busy Worker?',
        `Worker PID ${worker.pid || worker.sessionId} is currently executing a prompt turn. Killing it will abort the active response immediately.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Terminate Now', style: 'destructive', onPress: doKill },
        ]
      );
    } else {
      doKill();
    }
  };

  const handleRestartWorker = async (worker: CliWorkerInfo) => {
    setActionSessionId(worker.sessionId);
    try {
      const ok = await restartCliWorker(worker.sessionId);
      if (ok) {
        toast.show({
          variant: 'default',
          label: 'Worker Restarted',
          description: `Worker PID ${worker.pid || worker.sessionId} was recycled and respooled.`,
        });
      }
    } finally {
      setActionSessionId(null);
    }
  };

  const handleKillAllIdle = () => {
    if (idleWorkerCount === 0) return;
    Alert.alert(
      'Kill All Idle Workers?',
      `Terminate ${idleWorkerCount} idle persistent CLI worker child process${idleWorkerCount === 1 ? '' : 'es'} to reclaim host memory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Kill Idle Workers',
          style: 'destructive',
          onPress: async () => {
            const count = await killAllIdleCliWorkers();
            toast.show({
              variant: 'default',
              label: 'Idle Workers Terminated',
              description: `Reclaimed host memory from ${count} worker process${count === 1 ? '' : 'es'}.`,
            });
          },
        },
      ]
    );
  };

  // Telemetry Metrics
  const ramInfo = daemonStatus?.telemetry?.ram;
  const cpuInfo = daemonStatus?.telemetry?.cpu;
  const memUsedGb = ramInfo?.usedGb ?? 0;
  const memTotalGb = ramInfo?.totalGb ?? 0;
  const memPercent = ramInfo?.percent ?? 0;
  const cpuPercent = cpuInfo?.percent ?? 0;
  const cpuCores = cpuInfo?.cores ?? 1;
  const hostName = activeMachine?.name || daemonStatus?.hostname || 'Compute Node';
  const hostPlatform = daemonStatus?.platform || activeMachine?.platform || 'Host';
  const daemonPid = daemonStatus?.pid ?? 'Active';
  const nodeVersion = daemonStatus?.nodeVersion || 'Node.js';
  const uptimeStr = formatUptime(daemonStatus?.uptime);

  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Content size="full" className="bg-popover border-t border-border p-0">
        {/* Header */}
        <BottomSheet.Header className="px-4 py-3.5 border-b border-border bg-surface">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
                <Cpu size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                    Process & Node Manager
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-emerald-500" />
                </View>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {hostName} • {hostPlatform}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              <TouchableOpacity
                onPress={handleRefreshAll}
                disabled={isRefreshing}
                className="w-8 h-8 rounded-lg bg-surface-secondary border border-border items-center justify-center"
                activeOpacity={0.7}
              >
                {isRefreshing ? (
                  <Spinner size="sm" />
                ) : (
                  <RefreshCw size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                className="w-8 h-8 rounded-lg bg-surface-secondary border border-border items-center justify-center"
                activeOpacity={0.7}
              >
                <X size={15} color={isLight ? '#262626' : '#f5f5f5'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Segmented Tab Switcher */}
          <View className="flex-row items-center p-1 mt-3 bg-surface-secondary rounded-xl border border-border">
            <TouchableOpacity
              onPress={() => setActiveTab('daemon')}
              className={cn(
                'flex-1 py-1.5 rounded-lg items-center justify-center flex-row gap-1.5',
                activeTab === 'daemon' ? 'bg-card shadow-sm border border-border' : ''
              )}
              activeOpacity={0.7}
            >
              <Server size={13} color={activeTab === 'daemon' ? (isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
              <Text
                className={cn(
                  'text-xs font-semibold',
                  activeTab === 'daemon' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Daemon Service
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('workers')}
              className={cn(
                'flex-1 py-1.5 rounded-lg items-center justify-center flex-row gap-1.5',
                activeTab === 'workers' ? 'bg-card shadow-sm border border-border' : ''
              )}
              activeOpacity={0.7}
            >
              <Layers size={13} color={activeTab === 'workers' ? (isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
              <Text
                className={cn(
                  'text-xs font-semibold',
                  activeTab === 'workers' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                CLI Workers
              </Text>
              {cliWorkers.length > 0 && (
                <View
                  className={cn(
                    'px-1.5 py-0.2 rounded-full',
                    activeTab === 'workers' ? 'bg-primary' : 'bg-surface'
                  )}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-bold',
                      activeTab === 'workers' ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {cliWorkers.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheet.Header>

        {/* Tab Content */}
        <BottomSheet.Body className="p-4 bg-popover">
          {activeTab === 'daemon' ? (
            <View className="gap-4 pb-6">
              {/* Host Metadata Card */}
              <Card className="p-3.5 bg-card border border-border rounded-2xl">
                <View className="flex-row items-center justify-between mb-3 pb-2.5 border-b border-border">
                  <View className="flex-row items-center gap-2">
                    <Server size={15} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Daemon Service Status
                    </Text>
                  </View>
                  <Badge variant="default" size="xs">
                    PID {daemonPid}
                  </Badge>
                </View>

                <View className="flex-row flex-wrap gap-y-3">
                  <View className="w-1/2 pr-2">
                    <Text className="text-[11px] text-muted-foreground">Host System</Text>
                    <Text className="text-xs font-medium text-foreground mt-0.5" numberOfLines={1}>
                      {hostPlatform}
                    </Text>
                  </View>

                  <View className="w-1/2 pl-2">
                    <Text className="text-[11px] text-muted-foreground">Runtime</Text>
                    <Text className="text-xs font-medium text-foreground mt-0.5" numberOfLines={1}>
                      {nodeVersion}
                    </Text>
                  </View>

                  <View className="w-1/2 pr-2">
                    <Text className="text-[11px] text-muted-foreground">Service Uptime</Text>
                    <Text className="text-xs font-medium text-foreground mt-0.5">
                      {uptimeStr}
                    </Text>
                  </View>

                  <View className="w-1/2 pl-2">
                    <Text className="text-[11px] text-muted-foreground">CLI Worker Pool</Text>
                    <Text className="text-xs font-medium text-foreground mt-0.5">
                      {cliWorkers.length} persistent {cliWorkers.length === 1 ? 'worker' : 'workers'}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Resource Gauges */}
              <Card className="p-3.5 bg-card border border-border rounded-2xl">
                <Text className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                  Host Resources
                </Text>

                {/* RAM */}
                <View className="mb-3.5">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-1.5">
                      <HardDrive size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                      <Text className="text-xs font-medium text-foreground">RAM Memory</Text>
                    </View>
                    <Text className="text-xs font-mono text-muted-foreground">
                      {memUsedGb} GB / {memTotalGb} GB ({memPercent}%)
                    </Text>
                  </View>
                  <Progress
                    value={memPercent}
                    size="sm"
                    color={memPercent > 85 ? 'destructive' : memPercent > 70 ? 'warning' : 'primary'}
                    className="h-2 rounded-full"
                  />
                </View>

                {/* CPU */}
                <View>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-1.5">
                      <Cpu size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                      <Text className="text-xs font-medium text-foreground">CPU Utilization ({cpuCores} cores)</Text>
                    </View>
                    <Text className="text-xs font-mono text-muted-foreground">
                      {cpuPercent}%
                    </Text>
                  </View>
                  <Progress
                    value={cpuPercent}
                    size="sm"
                    color={cpuPercent > 85 ? 'destructive' : cpuPercent > 70 ? 'warning' : 'primary'}
                    className="h-2 rounded-full"
                  />
                </View>
              </Card>

              {/* Daemon Operations */}
              <View className="gap-2">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Lifecycle Controls
                </Text>

                <View className="flex-row gap-2.5">
                  <Button
                    variant="outline"
                    size="md"
                    onPress={handleRestartDaemon}
                    disabled={isRestartingDaemon}
                    className="flex-1 rounded-xl flex-row items-center justify-center gap-2 border-border"
                  >
                    {isRestartingDaemon ? (
                      <Spinner size="sm" />
                    ) : (
                      <RefreshCw size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                    )}
                    <Text className="text-xs font-semibold text-foreground">
                      {isRestartingDaemon ? 'Restarting...' : 'Restart Daemon'}
                    </Text>
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onPress={handleStopDaemon}
                    className="flex-1 rounded-xl flex-row items-center justify-center gap-2 border-destructive/30 bg-destructive/10"
                  >
                    <Power size={14} color="#ef4444" />
                    <Text className="text-xs font-semibold text-destructive">
                      Stop Daemon
                    </Text>
                  </Button>
                </View>
              </View>

              {/* Host Daemon Logs */}
              <Card className="bg-card border border-border rounded-2xl overflow-hidden">
                <TouchableOpacity
                  onPress={() => setIsLogsExpanded((prev) => !prev)}
                  className="p-3.5 flex-row items-center justify-between bg-surface"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-2">
                    <Terminal size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                    <Text className="text-xs font-semibold text-foreground">
                      Daemon Logs (daemon.log)
                    </Text>
                    {daemonLogLines.length > 0 && (
                      <Badge variant="secondary" size="xs">
                        {daemonLogLines.length} lines
                      </Badge>
                    )}
                  </View>

                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        fetchDaemonLogs(100);
                      }}
                      className="p-1 rounded-md bg-surface-secondary"
                    >
                      <RefreshCw size={12} color={isLight ? '#686868' : '#a3a3a3'} />
                    </TouchableOpacity>
                    {isLogsExpanded ? (
                      <ChevronUp size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                    ) : (
                      <ChevronDown size={15} color={isLight ? '#686868' : '#a3a3a3'} />
                    )}
                  </View>
                </TouchableOpacity>

                {isLogsExpanded && (
                  <View className="p-3 bg-surface-secondary border-t border-border">
                    {isLoadingDaemonLogs ? (
                      <View className="py-6 items-center justify-center">
                        <Spinner size="sm" />
                      </View>
                    ) : daemonLogLines.length === 0 ? (
                      <Text className="text-xs text-muted-foreground italic py-3 text-center">
                        No daemon log entries recorded yet.
                      </Text>
                    ) : (
                      <ScrollView
                        nestedScrollEnabled
                        className="max-h-56"
                        showsVerticalScrollIndicator
                      >
                        {daemonLogLines.map((line, idx) => (
                          <Text
                            key={idx}
                            className="text-[11px] font-mono text-muted-foreground leading-relaxed select-text"
                          >
                            {line}
                          </Text>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}
              </Card>
            </View>
          ) : (
            /* Workers Tab */
            <View className="gap-3 pb-6">
              {/* Workers Toolbar */}
              <View className="flex-row items-center justify-between pb-1">
                <View>
                  <Text className="text-xs font-semibold text-foreground">
                    Active Persistent Workers
                  </Text>
                  <Text className="text-[11px] text-muted-foreground">
                    {cliWorkers.length} {cliWorkers.length === 1 ? 'process' : 'processes'} spooled
                  </Text>
                </View>

                {idleWorkerCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={handleKillAllIdle}
                    className="px-2.5 py-1 rounded-xl flex-row items-center gap-1.5 border-destructive/30 bg-destructive/10"
                  >
                    <Trash2 size={12} color="#ef4444" />
                    <Text className="text-xs font-semibold text-destructive">
                      Kill All Idle ({idleWorkerCount})
                    </Text>
                  </Button>
                )}
              </View>

              {isLoadingWorkers ? (
                <View className="py-12 items-center justify-center">
                  <Spinner size="md" />
                  <Text className="text-xs text-muted-foreground mt-2">
                    Querying host worker pool...
                  </Text>
                </View>
              ) : cliWorkers.length === 0 ? (
                <Card className="p-6 bg-card border border-border rounded-2xl items-center justify-center my-4">
                  <View className="w-12 h-12 rounded-2xl bg-surface-secondary border border-border items-center justify-center mb-3">
                    <Cpu size={22} color={isLight ? '#686868' : '#a3a3a3'} />
                  </View>
                  <Text className="text-sm font-semibold text-foreground text-center">
                    No Active Workers Spooled
                  </Text>
                  <Text className="text-xs text-muted-foreground text-center mt-1 max-w-xs leading-normal">
                    Warm persistent coding-agent workers will spool automatically as soon as an agent turn is initiated.
                  </Text>
                </Card>
              ) : (
                cliWorkers.map((worker) => {
                  const isActioning = actionSessionId === worker.sessionId;

                  return (
                    <Card
                      key={worker.sessionId}
                      className="p-3.5 bg-card border border-border rounded-2xl gap-2.5"
                    >
                      {/* Top Row: PID & Session Title */}
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center gap-2">
                            <Badge variant={worker.isBusy ? 'warning' : 'default'} size="xs">
                              PID {worker.pid || 'Active'}
                            </Badge>
                            <Badge
                              variant={worker.isBusy ? 'warning' : 'secondary'}
                              size="xs"
                              className={worker.isBusy ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}
                            >
                              {worker.isBusy ? 'Executing Turn' : 'Idle (Ready)'}
                            </Badge>
                          </View>

                          <Text
                            className="text-[13px] font-semibold text-foreground mt-1.5"
                            numberOfLines={1}
                          >
                            {worker.sessionTitle || worker.sessionId}
                          </Text>

                          {worker.workspaceName && (
                            <Text
                              className="text-[11px] text-muted-foreground mt-0.5"
                              numberOfLines={1}
                            >
                              Workspace: {worker.workspaceName}
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Meta Badges */}
                      <View className="flex-row items-center flex-wrap gap-1.5">
                        {worker.activeModel && (
                          <View className="px-2 py-0.5 rounded-md bg-surface border border-border">
                            <Text className="text-[11px] font-mono text-muted-foreground">
                              {worker.activeModel}
                            </Text>
                          </View>
                        )}
                        {worker.activeEffort && (
                          <View className="px-2 py-0.5 rounded-md bg-surface border border-border">
                            <Text className="text-[11px] text-muted-foreground">
                              Effort: {worker.activeEffort}
                            </Text>
                          </View>
                        )}
                        {worker.activeMode && (
                          <View className="px-2 py-0.5 rounded-md bg-surface border border-border">
                            <Text className="text-[11px] text-muted-foreground">
                              Mode: {worker.activeMode}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Timing Row */}
                      <View className="flex-row items-center justify-between pt-1 border-t border-border">
                        <Text className="text-[10px] text-muted-foreground">
                          Started: {formatTimeAgo(worker.startedAt)}
                        </Text>
                        <Text className="text-[10px] text-muted-foreground">
                          Active: {formatTimeAgo(worker.lastActiveAt)}
                        </Text>
                      </View>

                      {/* Actions */}
                      <View className="flex-row items-center justify-end gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="xs"
                          onPress={() => handleRestartWorker(worker)}
                          disabled={isActioning}
                          className="px-2.5 py-1 rounded-lg border-border"
                        >
                          {isActioning ? (
                            <Spinner size="sm" />
                          ) : (
                            <RefreshCw size={12} color={isLight ? '#262626' : '#f5f5f5'} />
                          )}
                          <Text className="text-xs font-medium text-foreground ml-1">
                            Restart
                          </Text>
                        </Button>

                        <Button
                          variant="outline"
                          size="xs"
                          onPress={() => handleKillWorker(worker)}
                          disabled={isActioning}
                          className="px-2.5 py-1 rounded-lg border-destructive/30 bg-destructive/10"
                        >
                          <Trash2 size={12} color="#ef4444" />
                          <Text className="text-xs font-medium text-destructive ml-1">
                            Kill Worker
                          </Text>
                        </Button>
                      </View>
                    </Card>
                  );
                })
              )}
            </View>
          )}
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  );
};

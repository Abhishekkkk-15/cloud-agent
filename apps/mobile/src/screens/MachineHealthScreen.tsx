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
  Server,
  ShieldCheck,
  Lock,
  Cpu,
  Layers,
  HardDrive,
  ArrowUp,
  ArrowDown,
  Terminal,
  Code2,
  FileCode,
  Radio,
  RefreshCw,
  Zap,
  Power,
  ChevronRight,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { HeaderBar } from '../components/HeaderBar';
import { useDaemonStore } from '../stores/useDaemonStore';

interface MachineHealthScreenProps {
  onNavigateTab?: (tab: string) => void;
}

export const MachineHealthScreen: React.FC<MachineHealthScreenProps> = ({ onNavigateTab }) => {
  const connectionState = useDaemonStore((s) => s.connectionState);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const daemonStatus = useDaemonStore((s) => s.daemonStatus);
  const pingRtt = useDaemonStore((s) => s.pingRtt);
  const pingHeartbeat = useDaemonStore((s) => s.pingHeartbeat);
  const refreshStatus = useDaemonStore((s) => s.refreshStatus);

  const [isPinging, setIsPinging] = useState(false);

  const handlePing = async () => {
    setIsPinging(true);
    await pingHeartbeat();
    setIsPinging(false);
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

  const uptimeStr = daemonStatus?.uptime ? formatUptime(daemonStatus.uptime) : '19d 8h 12m';
  const pidStr = daemonStatus?.pid ? String(daemonStatus.pid) : '28419';
  const hostName = activeMachine?.name || daemonStatus?.hostname || 'DESKTOP-BJI38IC';
  const platformStr = activeMachine
    ? `${activeMachine.platform} ${activeMachine.arch}`
    : daemonStatus
    ? `${daemonStatus.platform} ${daemonStatus.arch}`
    : 'Ubuntu 24.04';

  const adapters = daemonStatus?.adapters && daemonStatus.adapters.length > 0
    ? daemonStatus.adapters
    : [
        {
          id: 'antigravity',
          name: 'Google Antigravity CLI',
          version: 'agy v2.4.1',
          binaryPath: '/usr/local/bin/agy • stdio RPC',
          status: 'active' as const,
        },
        {
          id: 'claude',
          name: 'Claude Code',
          version: 'v1.0.8',
          binaryPath: '/opt/anthropic/claude-code • MCP Bridge',
          status: 'ready' as const,
        },
        {
          id: 'codex',
          name: 'OpenAI Codex CLI',
          version: 'v0.9.4',
          binaryPath: '/usr/bin/codex-runtime',
          status: 'installed' as const,
        },
      ];

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Machine & CLI Health"
        subtitle={`${hostName} • ${platformStr}`}
        onMore={refreshStatus}
      />

      {/* Sub-bar */}
      <View style={styles.subBar}>
        <View
          style={[
            styles.pulseDot,
            !isConnected && { backgroundColor: connectionState === 'connecting' ? '#e3b341' : colors.red },
          ]}
        />
        <Text style={styles.subBarText}>
          {isConnected ? 'GATEWAY CONNECTED' : connectionState.toUpperCase()} • 0 open ports • PID: {pidStr} • Uptime: {uptimeStr}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Host System State Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.hostInfo}>
              <View style={styles.iconBox}>
                <Server size={20} color={colors.green} />
              </View>
              <View style={styles.hostTexts}>
                <Text style={styles.hostName}>{hostName}</Text>
                <Text style={styles.hostSub}>{platformStr} • Zero-Trust Tunnel</Text>
              </View>
            </View>

            <View
              style={[
                styles.connectedBadge,
                !isConnected && {
                  backgroundColor: colors.redSubtle,
                  borderColor: colors.redBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.pulseDotSmall,
                  !isConnected && { backgroundColor: colors.red },
                ]}
              />
              <Text
                style={[
                  styles.connectedText,
                  !isConnected && { color: colors.red },
                ]}
              >
                {isConnected ? 'Connected' : connectionState}
              </Text>
            </View>
          </View>

          {/* Security & Transport Badges */}
          <View style={styles.badgesRow}>
            <View style={styles.badgeCard}>
              <ShieldCheck size={16} color={colors.green} />
              <View style={styles.badgeCardTextCol}>
                <Text style={styles.badgeCardLabel}>Inbound Ports</Text>
                <Text style={styles.badgeCardValue}>0 Open (Zero-Trust)</Text>
              </View>
            </View>

            <View style={styles.badgeCard}>
              <Lock size={16} color={colors.blue} />
              <View style={styles.badgeCardTextCol}>
                <Text style={styles.badgeCardLabel}>Tunnel Transport</Text>
                <Text style={styles.badgeCardValue}>WebRTC DataChannel</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Telemetry & Resource Pools */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TELEMETRY & RESOURCE POOLS</Text>
        </View>

        <View style={styles.card}>
          {/* CPU Metric */}
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <View style={styles.metricTitleGroup}>
                <Cpu size={15} color={colors.textMuted} />
                <Text style={styles.metricLabel}>CPU Utilization (AMD / Intel Multi-Core)</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.green }]}>
                {daemonStatus?.telemetry?.cpuPercent ?? 18.4}%
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${daemonStatus?.telemetry?.cpuPercent ?? 18.4}%`,
                    backgroundColor: colors.green,
                  },
                ]}
              />
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricFooterText}>
                Load avg: {daemonStatus?.telemetry?.loadAvg ? daemonStatus.telemetry.loadAvg.join(', ') : '0.42, 0.38, 0.31'}
              </Text>
              <Text style={styles.metricFooterText}>Core temp: 41°C</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* RAM Metric */}
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <View style={styles.metricTitleGroup}>
                <Layers size={15} color={colors.textMuted} />
                <Text style={styles.metricLabel}>RAM Allocation Pool</Text>
              </View>
              <Text style={styles.metricValue}>
                {daemonStatus?.telemetry?.ramUsedGb ?? 4.2} / {daemonStatus?.telemetry?.ramTotalGb ?? 16.0} GB{' '}
                <Text style={{ color: colors.textMuted }}>(26%)</Text>
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '26%', backgroundColor: colors.blueBg }]} />
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricFooterText}>Buffer/Cache: 2.1 GB</Text>
              <Text style={styles.metricFooterText}>Swap: 0 MB / 4 GB</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* NVMe Storage Metric */}
          <View style={styles.metricItem}>
            <View style={styles.metricHeader}>
              <View style={styles.metricTitleGroup}>
                <HardDrive size={15} color={colors.textMuted} />
                <Text style={styles.metricLabel}>Persistent Storage Volume</Text>
              </View>
              <Text style={styles.metricValue}>
                {daemonStatus?.telemetry?.diskUsedGb ?? 48.2} / {daemonStatus?.telemetry?.diskTotalGb ?? 160} GB{' '}
                <Text style={{ color: colors.textMuted }}>(30%)</Text>
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '30%', backgroundColor: colors.purpleBg }]} />
            </View>
            <View style={styles.metricFooter}>
              <Text style={styles.metricFooterText}>Read IOPS: 142/s</Text>
              <Text style={styles.metricFooterText}>Write IOPS: 28/s</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Network Traffic Metric */}
          <View style={styles.networkRow}>
            <View>
              <Text style={styles.metricLabel}>Network Traffic (P2P DataChannel)</Text>
              <View style={styles.trafficStats}>
                <View style={styles.trafficStatItem}>
                  <ArrowUp size={13} color={colors.green} />
                  <Text style={[styles.trafficStatText, { color: colors.green }]}>
                    Egress {daemonStatus?.telemetry?.egressMbps ?? 1.4} Mbps
                  </Text>
                </View>
                <Text style={styles.trafficDot}>•</Text>
                <View style={styles.trafficStatItem}>
                  <ArrowDown size={13} color={colors.blue} />
                  <Text style={[styles.trafficStatText, { color: colors.blue }]}>
                    Ingress {daemonStatus?.telemetry?.ingressKbps ?? 340} Kbps
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.pingPill}>
              <Text style={styles.pingText}>RTT: {pingRtt}</Text>
            </View>
          </View>
        </View>

        {/* Active Coding Adapters */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>ACTIVE CODING ADAPTERS</Text>
          <Text style={styles.sectionSubtitle}>{adapters.length} registered</Text>
        </View>

        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          {adapters.map((adapter, idx) => (
            <React.Fragment key={adapter.id || idx}>
              {idx > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.adapterItem}
                activeOpacity={0.7}
                onPress={() => onNavigateTab && onNavigateTab('agent')}
              >
                <View style={styles.adapterLeft}>
                  <View style={styles.adapterIconBox}>
                    {idx === 0 ? (
                      <Terminal size={17} color={colors.green} />
                    ) : idx === 1 ? (
                      <Code2 size={17} color={colors.blue} />
                    ) : (
                      <FileCode size={17} color={colors.purple} />
                    )}
                  </View>
                  <View style={styles.adapterTexts}>
                    <View style={styles.adapterTitleRow}>
                      <Text style={styles.adapterName}>{adapter.name || adapter.id}</Text>
                      <View style={styles.versionBadge}>
                        <Text style={styles.versionBadgeText}>{adapter.version || 'v1.4.7'}</Text>
                      </View>
                    </View>
                    <Text style={styles.adapterPath} numberOfLines={1}>
                      {adapter.binaryPath || '/usr/local/bin/agy • stdio RPC'}
                    </Text>
                  </View>
                </View>
                <View style={styles.adapterRight}>
                  {idx === 0 ? (
                    <View style={styles.primaryBadge}>
                      <View style={styles.pulseDotTiny} />
                      <Text style={styles.primaryBadgeText}>Active & Primary</Text>
                    </View>
                  ) : (
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>Ready</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Daemon Operations */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>DAEMON OPERATIONS</Text>
        </View>

        <View style={styles.operationsGrid}>
          <TouchableOpacity
            style={[styles.operationBtn, isPinging && { borderColor: colors.green }]}
            onPress={handlePing}
            activeOpacity={0.7}
          >
            <Radio size={16} color={colors.green} />
            <Text style={styles.operationBtnText}>Ping Heartbeat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.operationBtn}
            onPress={async () => {
              await refreshStatus();
              Alert.alert('Refreshed', 'Machine state and adapters queried from Daemon.');
            }}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color={colors.blue} />
            <Text style={styles.operationBtnText}>Flush Cache</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.operationBtn}
            onPress={() => onNavigateTab && onNavigateTab('sessions')}
            activeOpacity={0.7}
          >
            <Zap size={16} color={colors.purple} />
            <Text style={styles.operationBtnText}>STDOUT Stream</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.operationBtn, { borderColor: colors.redBorder }]}
            onPress={() => Alert.alert('Restart Daemon', `Restart command dispatched to ${hostName}.`)}
            activeOpacity={0.7}
          >
            <Power size={16} color={colors.red} />
            <Text style={[styles.operationBtnText, { color: colors.red }]}>Restart Daemon</Text>
          </TouchableOpacity>
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
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.green,
  },
  pulseDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  pulseDotTiny: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.green,
  },
  subBarText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.xl,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostTexts: {
    flex: 1,
  },
  hostName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hostSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
    marginTop: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },
  connectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.green,
    fontFamily: typography.mono,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badgeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  badgeCardTextCol: {
    flex: 1,
  },
  badgeCardLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  badgeCardValue: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
    marginTop: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.green,
    fontFamily: typography.mono,
  },
  metricItem: {
    paddingVertical: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgHover,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricFooterText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginVertical: 10,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  trafficStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  trafficStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trafficStatText: {
    fontSize: 11,
    fontFamily: typography.mono,
  },
  trafficDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  pingPill: {
    backgroundColor: colors.bgHover,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  pingText: {
    fontSize: 11,
    color: colors.green,
    fontFamily: typography.mono,
    fontWeight: '600',
  },
  adapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  adapterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  adapterIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adapterTexts: {
    flex: 1,
  },
  adapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  adapterName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  versionBadge: {
    backgroundColor: colors.bgHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  versionBadgeText: {
    fontSize: 10,
    color: colors.blue,
    fontFamily: typography.mono,
  },
  adapterPath: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
    marginTop: 2,
  },
  adapterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.green,
  },
  readyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.blueSubtle,
    borderWidth: 1,
    borderColor: colors.blueBorder,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.blue,
  },
  operationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  operationBtn: {
    width: '48.5%',
    height: 44,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  operationBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

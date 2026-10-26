import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Server,
  X,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  ChevronRight,
  Radio,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, type MachineInfo } from '../stores/useDaemonStore';

interface MachineSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  onPairNew: () => void;
}

export const MachineSwitcherModal: React.FC<MachineSwitcherModalProps> = ({
  visible,
  onClose,
  onPairNew,
}) => {
  const machines = useDaemonStore((s) => s.machines);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const isLoadingMachines = useDaemonStore((s) => s.isLoadingMachines);
  const fetchMachines = useDaemonStore((s) => s.fetchMachines);
  const selectMachine = useDaemonStore((s) => s.selectMachine);
  const unpairMachine = useDaemonStore((s) => s.unpairMachine);

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!visible) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMachines();
    setIsRefreshing(false);
  };

  const handleSelect = async (machine: MachineInfo) => {
    if (activeMachine?.machineId === machine.machineId) {
      onClose();
      return;
    }
    setSwitchingId(machine.machineId);
    try {
      await selectMachine(machine);
      onClose();
    } finally {
      setSwitchingId(null);
    }
  };

  const handleUnpair = (machine: MachineInfo) => {
    Alert.alert(
      'Unpair Machine',
      `Are you sure you want to unpair "${machine.name}"? You will need a new pairing token to reconnect it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            const ok = await unpairMachine(machine.machineId);
            if (!ok) {
              Alert.alert('Error', 'Failed to unpair machine from Gateway.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconBox}>
              <Server size={18} color="#0077b6" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Machines & VPSs</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{machines.length}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>Select an active VPS or workstation</Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing || isLoadingMachines}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw
                size={16}
                color={isRefreshing ? '#0077b6' : '#8b949e'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#8b949e" />
            </TouchableOpacity>
          </View>

          {/* Machine List */}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingMachines && machines.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#0077b6" />
                <Text style={styles.loadingText}>Fetching paired machines...</Text>
              </View>
            ) : machines.length === 0 ? (
              <View style={styles.emptyBox}>
                <Server size={32} color="#6e7681" />
                <Text style={styles.emptyTitle}>No Paired Machines</Text>
                <Text style={styles.emptySubtitle}>
                  You don't have any active VPS or local workstation paired with this account yet.
                </Text>
              </View>
            ) : (
              machines.map((machine) => {
                const isActive = activeMachine?.machineId === machine.machineId;
                const isSwitchingThis = switchingId === machine.machineId;

                return (
                  <TouchableOpacity
                    key={machine.machineId}
                    style={[
                      styles.machineCard,
                      isActive && styles.machineCardActive,
                    ]}
                    onPress={() => handleSelect(machine)}
                    activeOpacity={0.7}
                    disabled={isSwitchingThis}
                  >
                    {/* Status Dot */}
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: machine.isOnline
                            ? '#3fb950'
                            : '#6e7681',
                        },
                      ]}
                    />

                    {/* Machine Details */}
                    <View style={styles.machineInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.machineName} numberOfLines={1}>
                          {machine.name}
                        </Text>
                        {isActive ? (
                          <View style={styles.activePill}>
                            <Check size={11} color="#0077b6" />
                            <Text style={styles.activePillText}>Active</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.machineSub} numberOfLines={1}>
                        {machine.platform} ({machine.arch}) •{' '}
                        <Text
                          style={{
                            color: machine.isOnline ? '#3fb950' : '#8b949e',
                          }}
                        >
                          {machine.isOnline ? 'Online' : 'Offline'}
                        </Text>
                      </Text>
                    </View>

                    {/* Action Right */}
                    <View style={styles.cardActions}>
                      {isSwitchingThis ? (
                        <ActivityIndicator size="small" color="#0077b6" />
                      ) : !isActive ? (
                        <TouchableOpacity
                          style={styles.switchBtn}
                          onPress={() => handleSelect(machine)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.switchBtnText}>Switch</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={styles.trashBtn}
                        onPress={() => handleUnpair(machine)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={14} color="#6e7681" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer: Pair New Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.pairNewBtn}
              onPress={() => {
                onClose();
                onPairNew();
              }}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.pairNewBtnText}>Pair Another Machine / VPS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#0d1117',
    borderRadius: radii.xl || 20,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#21262d',
    backgroundColor: '#161b22',
    gap: 12,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  countBadge: {
    backgroundColor: '#0077b6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 1,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listScroll: {
    maxHeight: 380,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  machineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  machineCardActive: {
    borderColor: '#0077b6',
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  machineInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  machineName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0077b6',
  },
  machineSub: {
    fontSize: 12,
    color: '#8b949e',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchBtn: {
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  trashBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#8b949e',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#21262d',
    backgroundColor: '#161b22',
  },
  pairNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0077b6',
    paddingVertical: 11,
    borderRadius: 10,
  },
  pairNewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

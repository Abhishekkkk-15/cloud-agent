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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
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

        <View style={[styles.modalCard, isLight && styles.modalCardLight]}>
          {/* Header */}
          <View style={[styles.header, isLight && styles.headerLight]}>
            <View style={[styles.headerIconBox, isLight && styles.headerIconBoxLight]}>
              <Server size={18} color={isLight ? '#0077b6' : '#fafafa'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, isLight && styles.titleLight]}>Machines & VPSs</Text>
                <View style={[styles.countBadge, isLight && styles.countBadgeLight]}>
                  <Text style={[styles.countBadgeText, isLight && styles.countBadgeTextLight]}>{machines.length}</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, isLight && styles.subtitleLight]}>Select an active VPS or workstation</Text>
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, isLight && styles.actionBtnLight]}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={isRefreshing || isLoadingMachines}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw
                size={16}
                color={isRefreshing ? (isLight ? '#0077b6' : '#fafafa') : (isLight ? '#57606a' : '#a3a3a3')}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, isLight && styles.actionBtnLight]}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={isLight ? '#57606a' : '#a3a3a3'} />
            </TouchableOpacity>
          </View>

          {/* Machine List */}
          <ScrollView
            style={[styles.listScroll, isLight && styles.listScrollLight]}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingMachines && machines.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                <Text style={[styles.loadingText, isLight && styles.loadingTextLight]}>Fetching paired machines...</Text>
              </View>
            ) : machines.length === 0 ? (
              <View style={styles.emptyBox}>
                <Server size={32} color={isLight ? '#8c959f' : '#737373'} />
                <Text style={[styles.emptyTitle, isLight && styles.emptyTitleLight]}>No Paired Machines</Text>
                <Text style={[styles.emptySubtitle, isLight && styles.emptySubtitleLight]}>
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
                      isLight && styles.machineCardLight,
                      isActive && (isLight ? styles.machineCardActiveLight : styles.machineCardActive),
                    ]}
                    onPress={() => handleSelect(machine)}
                    activeOpacity={0.7}
                    disabled={isSwitchingThis}
                  >


                    {/* Machine Details */}
                    <View style={styles.machineInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.machineName, isLight && styles.machineNameLight]} numberOfLines={1}>
                          {machine.name}
                        </Text>
                        {isActive ? (
                          <View style={[styles.activePill, isLight && styles.activePillLight]}>
                            <Check size={11} color={isLight ? '#0077b6' : '#fafafa'} />
                            <Text style={[styles.activePillText, isLight && styles.activePillTextLight]}>Active</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.machineSub, isLight && styles.machineSubLight]} numberOfLines={1}>
                        {machine.platform} ({machine.arch}) •{' '}
                        <Text
                          style={{
                            color: machine.isOnline ? (isLight ? '#1a7f37' : '#fafafa') : '#737373',
                          }}
                        >
                          {machine.isOnline ? 'Online' : 'Offline'}
                        </Text>
                      </Text>
                    </View>

                    {/* Action Right */}
                    <View style={styles.cardActions}>
                      {isSwitchingThis ? (
                        <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
                      ) : !isActive ? (
                        <TouchableOpacity
                          style={[styles.switchBtn, isLight && styles.switchBtnLight]}
                          onPress={() => handleSelect(machine)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.switchBtnText, isLight && styles.switchBtnTextLight]}>Switch</Text>
                        </TouchableOpacity>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.trashBtn, isLight && styles.trashBtnLight]}
                        onPress={() => handleUnpair(machine)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={14} color={isLight ? '#8c959f' : '#737373'} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer: Pair New Button */}
          <View style={[styles.footer, isLight && styles.footerLight]}>
            <TouchableOpacity
              style={[styles.pairNewBtn, isLight && styles.pairNewBtnLight]}
              onPress={() => {
                onClose();
                onPairNew();
              }}
              activeOpacity={0.8}
            >
              <Plus size={16} color={isLight ? '#ffffff' : '#0a0a0a'} />
              <Text style={[styles.pairNewBtnText, isLight && styles.pairNewBtnTextLight]}>Pair Another Machine / VPS</Text>
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
    backgroundColor: '#0a0a0a',
    borderRadius: radii.xl || 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#161616',
    gap: 12,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    color: '#fafafa',
  },
  countBadge: {
    backgroundColor: '#fafafa',
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
    color: '#a3a3a3',
    marginTop: 1,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
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
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  machineCardActive: {
    borderColor: '#fafafa',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    color: '#fafafa',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fafafa',
  },
  machineSub: {
    fontSize: 12,
    color: '#a3a3a3',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchBtn: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fafafa',
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
    color: '#a3a3a3',
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fafafa',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#161616',
  },
  pairNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fafafa',
    paddingVertical: 11,
    borderRadius: 10,
  },
  pairNewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a0a0a',
  },

  // Light Theme Overrides
  modalCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#e1e4e8',
  },
  headerIconBoxLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
  },
  titleLight: {
    color: '#1f2328',
  },
  subtitleLight: {
    color: '#6e7681',
  },
  countBadgeLight: {
    backgroundColor: '#eaeef2',
  },
  countBadgeTextLight: {
    color: '#57606a',
  },
  actionBtnLight: {
    backgroundColor: '#eaeef2',
  },
  listScrollLight: {
    backgroundColor: '#ffffff',
  },
  loadingTextLight: {
    color: '#6e7681',
  },
  emptyTitleLight: {
    color: '#1f2328',
  },
  emptySubtitleLight: {
    color: '#6e7681',
  },
  machineCardLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  machineCardActiveLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderColor: '#0077b6',
  },
  machineNameLight: {
    color: '#1f2328',
  },
  machineSubLight: {
    color: '#6e7681',
  },
  activePillLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
    borderColor: 'rgba(0, 119, 182, 0.3)',
  },
  activePillTextLight: {
    color: '#0077b6',
  },
  switchBtnLight: {
    backgroundColor: '#eaeef2',
  },
  switchBtnTextLight: {
    color: '#0077b6',
  },
  trashBtnLight: {
    backgroundColor: '#eaeef2',
  },
  footerLight: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e1e4e8',
  },
  pairNewBtnLight: {
    backgroundColor: '#0077b6',
  },
  pairNewBtnTextLight: {
    color: '#ffffff',
  },
});

import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Dialog,
  Button,
  Badge,
  Text,
  GridItem,
  Spinner,
  toast,
  cn,
} from 'panelui-native';
import {
  Server,
  X,
  Check,
  Plus,
  RefreshCw,
  Trash2,
} from './Icons';
import { useDaemonStore, type MachineInfo } from '../stores/useDaemonStore';
import { getGlossyGridItemTokens } from '../theme/tokens';

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
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const glossyGridItem = useMemo(() => getGlossyGridItemTokens(isLight, isSwiss), [isLight, isSwiss]);
  const machines = useDaemonStore((s) => s.machines);
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const isLoadingMachines = useDaemonStore((s) => s.isLoadingMachines);
  const fetchMachines = useDaemonStore((s) => s.fetchMachines);
  const selectMachine = useDaemonStore((s) => s.selectMachine);
  const unpairMachine = useDaemonStore((s) => s.unpairMachine);

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
              toast.show({
                variant: 'destructive',
                label: 'Unpair Failed',
                description: 'Failed to unpair machine from Gateway.',
              });
            } else {
              toast.show({
                variant: 'default',
                label: 'Machine Unpaired',
                description: `Disconnected ${machine.name}.`,
              });
            }
          },
        },
      ]
    );
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content className="w-full max-w-md bg-popover border border-border p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
              <Server size={16} color={isLight ? '#262626' : '#f5f5f5'} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Dialog.Title className="text-base font-semibold text-foreground">
                  Compute Nodes
                </Dialog.Title>
                <Badge variant="outline" size="sm" className="px-1.5 py-0">
                  <Text className="text-[11px] font-mono text-muted-foreground">{machines.length}</Text>
                </Badge>
              </View>
              <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
                Select an active VPS or workstation
              </Dialog.Description>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onPress={handleRefresh}
              disabled={isRefreshing || isLoadingMachines}
              className="w-7 h-7 p-0 items-center justify-center rounded-lg"
            >
              <RefreshCw
                size={14}
                color={isRefreshing ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')}
              />
            </Button>
            <Dialog.Close>
              <Button
                variant="ghost"
                size="sm"
                className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              >
                <X size={15} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
            </Dialog.Close>
          </View>
        </View>

        {/* Machine List */}
        <ScrollView
          style={{ maxHeight: 360 }}
          contentContainerStyle={{ padding: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoadingMachines && machines.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Spinner size="sm" />
              <Text className="text-xs text-muted-foreground mt-2">Fetching paired nodes...</Text>
            </View>
          ) : machines.length === 0 ? (
            <View className="py-8 items-center justify-center">
              <Server size={28} color={isLight ? '#a3a3a3' : '#737373'} />
              <Text className="text-sm font-semibold text-foreground mt-2">No Paired Nodes</Text>
              <Text className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                You don't have any active VPS or local workstation linked to this account yet.
              </Text>
            </View>
          ) : (
            <GridItem.Group columns={1} gap={8} rowHeight={74} size="sm">
              {machines.map((machine) => {
                const isActive = activeMachine?.machineId === machine.machineId;
                const isSwitchingThis = switchingId === machine.machineId;

                return (
                  <GridItem
                    key={machine.machineId}
                    colSpan={1}
                    rowSpan={1}
                    onPress={() => handleSelect(machine)}
                    disabled={isSwitchingThis}
                    className="p-2.5 flex-row items-center justify-between"
                    style={[
                      glossyGridItem.containerStyle,
                      isActive ? { borderColor: 'rgba(245, 245, 245, 0.4)' } : undefined,
                    ]}
                  >
                    <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                      <GridItem.Media variant="icon">
                        <Server size={14} color={isLight ? '#262626' : '#f5f5f5'} />
                      </GridItem.Media>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 mb-0.5">
                          <GridItem.Title numberOfLines={1}>{machine.name}</GridItem.Title>
                          {isActive && (
                            <Badge variant="default" size="xs">Active</Badge>
                          )}
                        </View>
                        <GridItem.Description numberOfLines={1}>
                          {machine.platform} ({machine.arch}) • {machine.isOnline ? 'Online' : 'Offline'}
                        </GridItem.Description>
                      </View>
                    </View>

                    <View className="flex-row items-center gap-1.5 shrink-0">
                      {isSwitchingThis ? (
                        <Spinner size="sm" />
                      ) : !isActive ? (
                        <Button
                          variant="outline"
                          size="xs"
                          onPress={() => handleSelect(machine)}
                        >
                          Switch
                        </Button>
                      ) : null}

                      <TouchableOpacity
                        onPress={() => handleUnpair(machine)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        className="p-1.5 rounded-lg"
                      >
                        <Trash2 size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                      </TouchableOpacity>
                    </View>
                  </GridItem>
                );
              })}
            </GridItem.Group>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="p-3 border-t border-border bg-surface flex-row items-center justify-between">
          <Button
            variant="primary"
            size="sm"
            onPress={() => {
              onClose();
              onPairNew();
            }}
            className="flex-1 flex-row items-center justify-center gap-1.5"
          >
            <Plus size={14} color={isLight ? '#fafafa' : '#262626'} />
            <Text className="text-xs font-semibold text-primary-foreground">Pair Another Compute Node</Text>
          </Button>
        </View>
      </Dialog.Content>
    </Dialog>
  );
};

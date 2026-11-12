import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Button, Spinner, Text } from 'panelui-native';
import { WifiOff, RefreshCw } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const isNetworkOnline = useDaemonStore((s) => s.isNetworkOnline);
  const checkNetwork = useDaemonStore((s) => s.checkNetwork);

  const [isRetrying, setIsRetrying] = useState(false);

  if (isNetworkOnline) {
    return null;
  }

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await checkNetwork();
    } finally {
      setIsRetrying(false);
    }
  };

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16);

  return (
    <View
      className="absolute left-4 right-4 z-50 pointer-events-box-none"
      style={{ top: topInset + 6 }}
      pointerEvents="box-none"
    >
      <Card className="p-2.5 bg-destructive/15 border border-destructive/30 rounded-xl flex-row items-center justify-between shadow-lg">
        <View className="flex-row items-center gap-2 flex-1 mr-2">
          <WifiOff size={15} color="#ef4444" />
          <View className="flex-1">
            <Text className="text-xs font-semibold text-destructive">
              Network Offline
            </Text>
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              Waiting for network reconnection
            </Text>
          </View>
        </View>

        <Button
          variant="outline"
          size="xs"
          className="border-destructive/30 bg-destructive/10 flex-row items-center gap-1.5 h-7 px-2.5"
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <Spinner size="sm" color="#ef4444" />
          ) : (
            <>
              <RefreshCw size={11} color="#ef4444" />
              <Text className="text-xs font-medium text-destructive">Retry</Text>
            </>
          )}
        </Button>
      </Card>
    </View>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff, Wifi, RefreshCw } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { mobileP2P } from '../lib/p2p-client';

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const isNetworkOnline = useDaemonStore((s) => s.isNetworkOnline);
  const checkNetwork = useDaemonStore((s) => s.checkNetwork);

  // Track if we just came back online to show brief "Back online" indicator
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const prevOnlineRef = useRef(isNetworkOnline);

  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (!isNetworkOnline) {
      // Slid down into view
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
      prevOnlineRef.current = false;
    } else if (!prevOnlineRef.current && isNetworkOnline) {
      // Just reconnected!
      prevOnlineRef.current = true;
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setShowBackOnline(false);
        });
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-80);
    }
  }, [isNetworkOnline, translateY]);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await checkNetwork();
      mobileP2P.reconnectNow();
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  if (isNetworkOnline && !showBackOnline) {
    return null;
  }

  const topOffset = Math.max(
    insets.top + (Platform.OS === 'ios' ? 8 : 12),
    Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 12
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.pill,
          isLight ? styles.pillLight : styles.pillDark,
          showBackOnline && (isLight ? styles.pillBackOnlineLight : styles.pillBackOnlineDark),
        ]}
      >
        {showBackOnline ? (
          <>
            <Wifi size={14} color="#2da44e" />
            <Text style={[styles.text, styles.textBackOnline]}>
              Back online • Mesh synced
            </Text>
          </>
        ) : (
          <>
            <WifiOff size={14} color="#f85149" />
            <Text style={[styles.text, isLight ? styles.textLight : styles.textDark]}>
              You are offline
            </Text>
            <TouchableOpacity
              style={[
                styles.retryBtn,
                isLight ? styles.retryBtnLight : styles.retryBtnDark,
              ]}
              onPress={handleRetry}
              activeOpacity={0.7}
              disabled={isRetrying}
            >
              <RefreshCw
                size={12}
                color={isLight ? '#0077b6' : '#48cae4'}
                style={isRetrying ? { opacity: 0.5 } : undefined}
              />
              <Text
                style={[
                  styles.retryText,
                  isLight ? styles.retryTextLight : styles.retryTextDark,
                ]}
              >
                {isRetrying ? 'Checking...' : 'Retry'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  pillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e1e4e8',
  },
  pillDark: {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
  },
  pillBackOnlineLight: {
    borderColor: 'rgba(45, 164, 78, 0.4)',
    backgroundColor: '#f6fdf8',
  },
  pillBackOnlineDark: {
    borderColor: 'rgba(45, 164, 78, 0.4)',
    backgroundColor: '#0d1912',
  },
  text: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  textLight: {
    color: '#1f2328',
  },
  textDark: {
    color: '#f0f6fc',
  },
  textBackOnline: {
    color: '#2da44e',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 4,
  },
  retryBtnLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
  },
  retryBtnDark: {
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
  },
  retryText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  retryTextLight: {
    color: '#0077b6',
  },
  retryTextDark: {
    color: '#48cae4',
  },
});

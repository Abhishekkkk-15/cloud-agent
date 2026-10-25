import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Sparkles, ShieldAlert, AlertTriangle, Check, X } from './Icons';
import { colors, radii } from '../theme/tokens';
import { onInAppNotification, type NotificationPayload } from '../lib/notifications';

export const NotificationBanner: React.FC = () => {
  const [currentNotif, setCurrentNotif] = useState<NotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const hideTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onInAppNotification((payload) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setCurrentNotif(payload);

      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        mass: 0.8,
        useNativeDriver: true,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, 4500);
    });

    return () => {
      unsubscribe();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [translateY]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentNotif(null);
    });
  };

  if (!currentNotif) return null;

  const renderIcon = () => {
    switch (currentNotif.type) {
      case 'turn_complete':
        return <Sparkles size={16} color="#3fb950" />;
      case 'approval_required':
        return <ShieldAlert size={16} color="#f85149" />;
      case 'error':
        return <AlertTriangle size={16} color="#f85149" />;
      default:
        return <Sparkles size={16} color="#0077b6" />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[
          styles.banner,
          currentNotif.type === 'approval_required'
            ? styles.bannerApproval
            : currentNotif.type === 'error'
            ? styles.bannerError
            : styles.bannerDefault,
        ]}
        activeOpacity={0.85}
        onPress={handleDismiss}
      >
        <View style={styles.iconCircle}>{renderIcon()}</View>
        <View style={styles.textCol}>
          <Text style={styles.titleText} numberOfLines={1}>
            {currentNotif.title}
          </Text>
          <Text style={styles.bodyText} numberOfLines={2}>
            {currentNotif.body}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={14} color="#8b949e" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 16,
    left: 12,
    right: 12,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerDefault: {
    borderColor: '#30363d',
  },
  bannerApproval: {
    borderColor: 'rgba(248, 81, 73, 0.45)',
    backgroundColor: '#1c1517',
  },
  bannerError: {
    borderColor: 'rgba(248, 81, 73, 0.45)',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textCol: {
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  bodyText: {
    fontSize: 12,
    color: '#c9d1d9',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 4,
  },
});

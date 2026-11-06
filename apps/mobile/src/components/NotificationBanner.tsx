import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, ShieldAlert, AlertTriangle, Check, X, ChevronRight } from './Icons';
import { colors, radii } from '../theme/tokens';
import { onInAppNotification, type NotificationPayload } from '../lib/notifications';
import { useDaemonStore } from '../stores/useDaemonStore';

interface NotificationBannerProps {
  onNavigate?: (screen: 'agent' | 'health' | 'approvals' | 'sessions') => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onNavigate }) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const [currentNotif, setCurrentNotif] = useState<NotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const hideTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = onInAppNotification((payload) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      translateY.setValue(-160);
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

  const handleBannerPress = () => {
    if (currentNotif?.type === 'approval_required') {
      onNavigate?.('approvals');
    } else if (currentNotif?.type === 'turn_complete') {
      onNavigate?.('agent');
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    Animated.timing(translateY, {
      toValue: -160,
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
        return <Sparkles size={16} color={isLight ? '#0077b6' : '#fafafa'} />;
      case 'approval_required':
        return <ShieldAlert size={16} color="#f85149" />;
      case 'error':
        return <AlertTriangle size={16} color="#f85149" />;
      default:
        return <Sparkles size={16} color={isLight ? '#0077b6' : '#fafafa'} />;
    }
  };

  return (
    <Modal
      visible={Boolean(currentNotif)}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalBackdrop}>
        <TouchableWithoutFeedback onPress={handleDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.container,
            {
              top: topInset + (Platform.OS === 'ios' ? 8 : 10),
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
                : (isLight ? styles.bannerDefaultLight : styles.bannerDefault),
            ]}
            activeOpacity={0.88}
            onPress={handleBannerPress}
          >
            <View
              style={[
                styles.iconCircle,
                currentNotif.type === 'approval_required' || currentNotif.type === 'error'
                  ? styles.iconCircleAlert
                  : (isLight ? styles.iconCircleDefaultLight : styles.iconCircleDefault),
              ]}
            >
              {renderIcon()}
            </View>

            <View style={styles.textCol}>
              <Text style={[styles.titleText, isLight && styles.titleTextLight]} numberOfLines={1}>
                {currentNotif.title}
              </Text>
              <Text style={[styles.bodyText, isLight && styles.bodyTextLight]} numberOfLines={2}>
                {currentNotif.body}
              </Text>
            </View>

            <View style={styles.rightActions}>
              <ChevronRight size={14} color={isLight ? '#57606a' : '#737373'} />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleDismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={13} color={isLight ? '#57606a' : '#a3a3a3'} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 22, 0.96)',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 10,
  },
  bannerDefault: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bannerApproval: {
    borderColor: 'rgba(248, 81, 73, 0.45)',
    backgroundColor: 'rgba(28, 20, 22, 0.96)',
  },
  bannerError: {
    borderColor: 'rgba(248, 81, 73, 0.45)',
    backgroundColor: 'rgba(28, 20, 22, 0.96)',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconCircleDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconCircleAlert: {
    backgroundColor: 'rgba(248, 81, 73, 0.18)',
  },
  textCol: {
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  bodyText: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 2,
    lineHeight: 16,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDefaultLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: '#d0d7de',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircleDefaultLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.10)',
    borderColor: 'rgba(0, 119, 182, 0.25)',
  },
  titleTextLight: {
    color: '#1f2328',
  },
  bodyTextLight: {
    color: '#57606a',
  },
});

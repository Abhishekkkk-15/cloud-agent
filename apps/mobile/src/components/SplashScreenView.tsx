import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useDaemonStore } from '../stores/useDaemonStore';

export function SplashScreenView() {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  // Smooth pulse animation for the emblem glow / indicator
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in view
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Subtle pulsing loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [fadeAnim, pulseAnim]);

  return (
    <View style={[styles.container, isLight && styles.containerLight]}>
      <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
        {/* Brand Squircle Emblem */}
        <Animated.View
          style={[
            styles.emblemWrapper,
            isLight && styles.emblemWrapperLight,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Title & Technical Classification */}
        <View style={styles.titleBlock}>
          <Text style={[styles.brandTitle, isLight && styles.brandTitleLight]}>
            CLOUD AGENT
          </Text>
          <Text style={[styles.brandSubtitle, isLight && styles.brandSubtitleLight]}>
            AUTONOMOUS ENCLAVE MESH
          </Text>
        </View>

        {/* Pacific Azure Blue Activity Indicator */}
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#0077b6" />
          <Text style={[styles.statusText, isLight && styles.statusTextLight]}>
            Initializing secure runtime...
          </Text>
        </View>
      </Animated.View>

      {/* Security & Verification Footer */}
      <View style={styles.footer}>
        <View style={styles.securityPill}>
          <View style={styles.greenDot} />
          <Text style={[styles.footerText, isLight && styles.footerTextLight]}>
            E2E ENCRYPTED P2P • v1.0.0
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerLight: {
    backgroundColor: '#ffffff',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emblemWrapper: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#161b22',
    borderWidth: 1.5,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0077b6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  emblemWrapperLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
    shadowOpacity: 0.15,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f0f6fc',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  brandTitleLight: {
    color: '#1f2328',
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  brandSubtitleLight: {
    color: '#656d76',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 119, 182, 0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8b949e',
    letterSpacing: 0.5,
  },
  statusTextLight: {
    color: '#57606a',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(33, 38, 45, 0.6)',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0077b6',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6e7681',
    letterSpacing: 1.5,
  },
  footerTextLight: {
    color: '#8c959f',
  },
});

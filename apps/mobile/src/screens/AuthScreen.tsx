import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import {
  Sun,
  Moon,
  Globe,
  WifiOff,
  RefreshCw,
  Zap,
  Cloud,
} from '../components/Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { ServerSettingsModal } from '../components/ServerSettingsModal';
import { isRunningInExpoGo } from '../lib/notifications';

WebBrowser.maybeCompleteAuthSession();

/**
 * Pixel-perfect Cloud Agent Logo matching the design brief:
 * Outlined cloud shape with inner terminal prompt (> _) and sparkle star ✦ at top right.
 */
interface CloudAgentLogoProps {
  color?: string;
  size?: number;
}

export const CloudAgentLogo: React.FC<CloudAgentLogoProps> = ({
  color = '#111827',
  size = 130,
}) => {
  const width = size;
  const height = (size * 100) / 130;

  return (
    <Svg width={width} height={height} viewBox="0 0 130 100" fill="none">
      {/* Cloud Outline */}
      <Path
        d="M 40 68 L 82 68 C 93 68, 101 60, 101 49 C 101 39, 93 32, 83 32 C 82 32, 80 32, 79 33 C 76 21, 65 14, 53 14 C 40 14, 30 23, 28 35 C 27 35, 26 35, 25 35 C 16 35, 9 42, 9 51 C 9 60, 16 68, 26 68 Z"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Terminal Prompt: > _ */}
      <Path
        d="M 44 45 L 51 51 L 44 57"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M 58 57 L 70 57"
        stroke={color}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Sparkle Star ✦ at top-right curve */}
      <Path
        d="M 98 12 Q 98 22 106 22 Q 98 22 98 32 Q 98 22 90 22 Q 98 22 98 12 Z"
        fill={color}
      />
    </Svg>
  );
};

/**
 * Google 4-Color Flat Brand Mark
 */
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

/**
 * Organic, soft cloud curves in backdrop (matching top-left & bottom-right billows)
 */
const BackgroundClouds: React.FC<{ isLight: boolean }> = ({ isLight }) => {
  const primaryFill = isLight ? '#f3f5f8' : 'rgba(255, 255, 255, 0.035)';
  const secondaryFill = isLight ? '#f9fafb' : 'rgba(255, 255, 255, 0.02)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        {/* Top-left billow */}
        <Path
          d="M -60 260 C 20 260 70 200 90 140 C 110 50 170 30 250 20 C 280 15 310 -10 320 -40 L -60 -40 Z"
          fill={primaryFill}
        />
        <Path
          d="M -80 340 C 10 340 100 270 120 180 C 140 80 190 50 260 40 L -80 -40 Z"
          fill={secondaryFill}
        />

        {/* Bottom-right billow */}
        <Path
          d="M 450 600 C 370 600 320 660 300 720 C 280 800 220 830 140 840 L 450 880 Z"
          fill={primaryFill}
        />
        <Path
          d="M 470 520 C 380 520 290 590 270 670 C 250 770 200 800 130 820 L 470 880 Z"
          fill={secondaryFill}
        />
      </Svg>
    </View>
  );
};

function parseAuthCallbackUrl(urlStr: string): {
  token?: string;
  refreshToken?: string;
  userId?: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  error?: string;
} {
  try {
    const url = new URL(urlStr);
    return {
      token: url.searchParams.get('token') || undefined,
      refreshToken: url.searchParams.get('refreshToken') || undefined,
      userId: url.searchParams.get('userId') || undefined,
      email: url.searchParams.get('email') || undefined,
      name: url.searchParams.get('name') || undefined,
      avatarUrl:
        url.searchParams.get('avatarUrl') ||
        url.searchParams.get('avatar_url') ||
        url.searchParams.get('picture') ||
        undefined,
      error: url.searchParams.get('error') || undefined,
    };
  } catch {
    const queryPart = urlStr.includes('?') ? urlStr.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    return {
      token: params.get('token') || undefined,
      refreshToken: params.get('refreshToken') || undefined,
      userId: params.get('userId') || undefined,
      email: params.get('email') || undefined,
      name: params.get('name') || undefined,
      avatarUrl:
        params.get('avatarUrl') ||
        params.get('avatar_url') ||
        params.get('picture') ||
        undefined,
      error: params.get('error') || undefined,
    };
  }
}

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const insets = useSafeAreaInsets();
  const theme = useDaemonStore((s) => s.theme);
  const toggleTheme = useDaemonStore((s) => s.toggleTheme);
  const loginWithToken = useDaemonStore((s) => s.loginWithToken);
  const loginWithDev = useDaemonStore((s) => s.loginWithDev);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const isNetworkOnline = useDaemonStore((s) => s.isNetworkOnline);
  const checkNetwork = useDaemonStore((s) => s.checkNetwork);

  const isLight = theme === 'light';
  const isExpoGo = isRunningInExpoGo();

  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingDev, setIsLoadingDev] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const handleDevLogin = async () => {
    try {
      setIsLoadingDev(true);
      const ok = await loginWithDev();
      if (ok) {
        if (onSuccess) onSuccess();
      } else {
        Alert.alert(
          'Dev Login Error',
          `Could not connect to Gateway at ${gatewayUrl}. Please ensure gateway server is running.`
        );
      }
    } catch (err: any) {
      Alert.alert('Dev Login Error', err?.message || 'Dev login failed.');
    } finally {
      setIsLoadingDev(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isNetworkOnline) {
      Alert.alert(
        'No Internet Connection',
        'You are currently offline. Please check your internet connection before signing in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => checkNetwork() },
        ]
      );
      return;
    }

    try {
      setIsLoadingGoogle(true);

      // Deep-link callback URL: cloud-agent://auth
      const returnUrl = makeRedirectUri({ scheme: 'cloud-agent', path: 'auth' });
      const authUrl = `${gatewayUrl}/auth/google?returnUrl=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

      if (result.type === 'success' && result.url) {
        const parsed = parseAuthCallbackUrl(result.url);

        if (parsed.error) {
          Alert.alert('Sign-In Error', `Google authentication failed: ${parsed.error}`);
          return;
        }

        if (parsed.token) {
          const ok = await loginWithToken(parsed.token, {
            id: parsed.userId || 'user',
            email: parsed.email || '',
            name: parsed.name || 'User',
            avatarUrl: parsed.avatarUrl,
          });

          if (ok) {
            if (onSuccess) onSuccess();
          } else {
            Alert.alert(
              'Sign-In Failed',
              `Could not complete login on Gateway at ${gatewayUrl}.`
            );
          }
        } else {
          Alert.alert('Sign-In Error', 'No authorization token returned.');
        }
      }
    } catch (err: any) {
      console.error('[AuthScreen] Google OAuth error:', err);
      Alert.alert(
        'Google Sign-In Error',
        err?.message || 'Google OAuth prompt could not be initialized.'
      );
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  return (
    <View style={[styles.container, isLight ? styles.containerLight : styles.containerDark]}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />

      {/* Ambient Organic Cloud Backdrop */}
      <BackgroundClouds isLight={isLight} />

      {/* Top Bar Actions: Theme Switcher & Gateway Modal */}
      <View
        style={[
          styles.topBar,
          { top: Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16) },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.topBarBtn,
            isLight ? styles.topBarBtnLight : styles.topBarBtnDark,
          ]}
          onPress={() => setShowServerSettings(true)}
          activeOpacity={0.7}
          accessibilityLabel="Server Endpoint Settings"
        >
          <Globe size={18} color={isLight ? '#57606a' : '#c9d1d9'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.topBarBtn,
            isLight ? styles.topBarBtnLight : styles.topBarBtnDark,
          ]}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Dark / Light Theme"
        >
          {isLight ? (
            <Moon size={18} color="#111827" />
          ) : (
            <Sun size={18} color="#f0f6fc" />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Center Content */}
      <View style={styles.centerSection}>
        {/* Cloud Agent Outline Logo with Terminal Prompt & Sparkle */}
        <View style={styles.logoWrapper}>
          <CloudAgentLogo
            color={isLight ? '#111827' : '#f0f6fc'}
            size={136}
          />
        </View>

        {/* Brand Headline */}
        <Text style={[styles.title, isLight ? styles.titleLight : styles.titleDark]}>
          Cloud Agent
        </Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, isLight ? styles.subtitleLight : styles.subtitleDark]}>
          Run your coding agent{'\n'}from anywhere.
        </Text>

        {/* Primary Action: Continue with Google Pill Button */}
        <TouchableOpacity
          style={[
            styles.googlePillBtn,
            isLight ? styles.googlePillBtnLight : styles.googlePillBtnDark,
            (isLoadingGoogle || isLoadingDev) && styles.btnDisabled,
          ]}
          onPress={handleGoogleLogin}
          disabled={isLoadingGoogle || isLoadingDev}
          activeOpacity={0.8}
        >
          {isLoadingGoogle ? (
            <ActivityIndicator size="small" color={isLight ? '#111827' : '#ffffff'} />
          ) : (
            <>
              <GoogleIcon size={22} />
              <View
                style={[
                  styles.btnDivider,
                  isLight ? styles.btnDividerLight : styles.btnDividerDark,
                ]}
              />
              <Text
                style={[
                  styles.googlePillText,
                  isLight ? styles.googlePillTextLight : styles.googlePillTextDark,
                ]}
              >
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Developer / Test Account Login (Exclusively visible when running inside Expo Go client) */}
        {isExpoGo && (
          <View style={styles.expoGoDevSection}>
            <View style={styles.cloudDividerRow}>
              <View
                style={[
                  styles.cloudDividerLine,
                  isLight ? styles.cloudDividerLineLight : styles.cloudDividerLineDark,
                ]}
              />
              <View style={styles.cloudIconBox}>
                <Cloud
                  size={15}
                  color={isLight ? '#9ca3af' : '#6e7681'}
                />
              </View>
              <View
                style={[
                  styles.cloudDividerLine,
                  isLight ? styles.cloudDividerLineLight : styles.cloudDividerLineDark,
                ]}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.devConnectRow,
                (isLoadingDev || isLoadingGoogle) && styles.btnDisabled,
              ]}
              onPress={handleDevLogin}
              disabled={isLoadingDev || isLoadingGoogle}
              activeOpacity={0.7}
            >
              {isLoadingDev ? (
                <ActivityIndicator size="small" color="#0077b6" />
              ) : (
                <>
                  <Zap size={14} color={isLight ? '#0077b6' : '#48cae4'} />
                  <Text
                    style={[
                      styles.devConnectText,
                      isLight ? styles.devConnectTextLight : styles.devConnectTextDark,
                    ]}
                  >
                    Expo Go Test / Developer Account
                  </Text>
                  <View
                    style={[
                      styles.devBadge,
                      isLight ? styles.devBadgeLight : styles.devBadgeDark,
                    ]}
                  >
                    <Text
                      style={[
                        styles.devBadgeText,
                        isLight ? styles.devBadgeTextLight : styles.devBadgeTextDark,
                      ]}
                    >
                      Dev Only
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Offline Warning Notice */}
        {!isNetworkOnline && (
          <View
            style={[
              styles.offlineCard,
              isLight ? styles.offlineCardLight : styles.offlineCardDark,
            ]}
          >
            <WifiOff size={14} color="#f85149" />
            <Text
              style={[
                styles.offlineText,
                isLight ? styles.offlineTextLight : styles.offlineTextDark,
              ]}
            >
              No internet connection
            </Text>
            <TouchableOpacity
              style={[
                styles.offlineRetryBtn,
                isLight ? styles.offlineRetryBtnLight : styles.offlineRetryBtnDark,
              ]}
              onPress={() => checkNetwork()}
              activeOpacity={0.7}
            >
              <RefreshCw size={12} color={isLight ? '#0077b6' : '#48cae4'} />
              <Text
                style={[
                  styles.offlineRetryText,
                  isLight ? styles.offlineRetryTextLight : styles.offlineRetryTextDark,
                ]}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Server & Network Endpoints Modal */}
      <ServerSettingsModal
        visible={showServerSettings}
        onClose={() => setShowServerSettings(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  containerLight: {
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },

  // Top Bar Actions
  topBar: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
  },
  topBarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  topBarBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  topBarBtnDark: {
    backgroundColor: '#161b22',
    borderColor: '#30363d',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },

  // Main Center Section
  centerSection: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 12,
    textAlign: 'center',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: 16.5,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 44,
  },
  subtitleLight: {
    color: '#4b5563',
  },
  subtitleDark: {
    color: '#9ca3af',
  },

  // Google Pill Button
  googlePillBtn: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  googlePillBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#111827',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  googlePillBtnDark: {
    backgroundColor: '#161b22',
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  btnDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 16,
  },
  btnDividerLight: {
    backgroundColor: '#e5e7eb',
  },
  btnDividerDark: {
    backgroundColor: '#30363d',
  },
  googlePillText: {
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  googlePillTextLight: {
    color: '#111827',
  },
  googlePillTextDark: {
    color: '#f0f6fc',
  },
  btnDisabled: {
    opacity: 0.65,
  },

  // Offline Warning Notice
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  offlineCardLight: {
    backgroundColor: '#fff8f7',
    borderColor: '#ffc1be',
  },
  offlineCardDark: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    borderColor: 'rgba(248, 81, 73, 0.3)',
  },
  offlineText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  offlineTextLight: {
    color: '#cf222e',
  },
  offlineTextDark: {
    color: '#f85149',
  },
  offlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 4,
  },
  offlineRetryBtnLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.1)',
  },
  offlineRetryBtnDark: {
    backgroundColor: 'rgba(0, 119, 182, 0.2)',
  },
  offlineRetryText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  offlineRetryTextLight: {
    color: '#0077b6',
  },
  offlineRetryTextDark: {
    color: '#48cae4',
  },

  // Expo Go Developer Section
  expoGoDevSection: {
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
  },
  cloudDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 240,
    marginTop: 20,
    marginBottom: 16,
  },
  cloudDividerLine: {
    flex: 1,
    height: 1,
  },
  cloudDividerLineLight: {
    backgroundColor: '#e5e7eb',
  },
  cloudDividerLineDark: {
    backgroundColor: '#262626',
  },
  cloudIconBox: {
    marginHorizontal: 12,
  },
  devConnectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  devConnectText: {
    fontSize: 13,
    fontWeight: '500',
  },
  devConnectTextLight: {
    color: '#0077b6',
  },
  devConnectTextDark: {
    color: '#48cae4',
  },
  devBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  devBadgeLight: {
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderColor: 'rgba(0, 119, 182, 0.2)',
  },
  devBadgeDark: {
    backgroundColor: 'rgba(0, 119, 182, 0.15)',
    borderColor: 'rgba(0, 119, 182, 0.35)',
  },
  devBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  devBadgeTextLight: {
    color: '#0077b6',
  },
  devBadgeTextDark: {
    color: '#48cae4',
  },
});

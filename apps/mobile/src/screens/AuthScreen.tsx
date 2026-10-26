import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  Bot,
  Zap,
  Lock,
  ArrowRight,
  ShieldCheck,
  Server,
  Globe,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';
import { ServerSettingsModal } from '../components/ServerSettingsModal';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '79012036030-97ef859oi3hdate2lg8v2ojjehpt1uee.apps.googleusercontent.com';

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
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

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const loginWithDev = useDaemonStore((s) => s.loginWithDev);
  const loginWithGoogle = useDaemonStore((s) => s.loginWithGoogle);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);
  const apiUrl = useDaemonStore((s) => s.apiUrl);

  const [isLoadingDev, setIsLoadingDev] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
  });

  const exchangeToken = async (idToken: string) => {
    setIsLoadingGoogle(true);
    try {
      const ok = await loginWithGoogle(idToken);
      if (ok) {
        if (onSuccess) onSuccess();
      } else {
        Alert.alert(
          'Sign-In Failed',
          `Google verification failed on backend at ${apiUrl}. Ensure backend services are running.`
        );
      }
    } catch (err: any) {
      console.error('[AuthScreen] Exchange error:', err);
      Alert.alert('Sign-In Error', err?.message || 'Failed to complete sign-in.');
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        exchangeToken(idToken);
      }
    } else if (response?.type === 'error') {
      setIsLoadingGoogle(false);
      Alert.alert('Google Sign-In Error', response.error?.message || 'Authentication failed');
    }
  }, [response]);

  const handleDevLogin = async () => {
    setIsLoadingDev(true);
    const ok = await loginWithDev();
    setIsLoadingDev(false);
    if (ok) {
      if (onSuccess) onSuccess();
    } else {
      Alert.alert(
        'Connection Error',
        `Unable to reach API at ${apiUrl}. Ensure backend services are running.`
      );
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoadingGoogle(true);
      const res = await promptAsync();
      if (res.type === 'success') {
        const idToken = res.params?.id_token;
        if (idToken) {
          await exchangeToken(idToken);
          return;
        }
      } else if (res.type === 'cancel' || res.type === 'dismiss') {
        // User cancelled popup
      } else if (res.type === 'error') {
        Alert.alert('Google Sign-In Error', res.error?.message || 'Failed to authenticate with Google.');
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
    <View style={styles.container}>
      {/* Background Ambience */}
      <View style={styles.ambientGlow} />

      <View style={styles.content}>
        {/* Logo & Headline */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Bot size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>Cloud Agent</Text>
          <Text style={styles.tagline}>
            Autonomous Antigravity CLI controller for your pocket.
          </Text>
        </View>

        {/* Auth Action Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Sign in to access your machines</Text>
          </View>

          {/* Primary Action: Real Google OAuth */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            activeOpacity={0.85}
            disabled={isLoadingGoogle || isLoadingDev}
          >
            {isLoadingGoogle ? (
              <ActivityIndicator size="small" color="#1f1f1f" />
            ) : (
              <>
                <View style={styles.googleIconBox}>
                  <GoogleIcon size={18} />
                </View>
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR LOCAL TESTING</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Secondary Action: Developer Quick Connect */}
          <TouchableOpacity
            style={styles.devBtn}
            onPress={handleDevLogin}
            activeOpacity={0.75}
            disabled={isLoadingGoogle || isLoadingDev}
          >
            {isLoadingDev ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Zap size={16} color={colors.primary} />
                <Text style={styles.devBtnText}>Developer Quick Connect</Text>
                <ArrowRight size={14} color="#8b949e" style={{ marginLeft: 'auto' }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Telemetry / Status Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.serverPill}
            onPress={() => setShowServerSettings(true)}
            activeOpacity={0.7}
          >
            <Globe size={12} color="#0077b6" />
            <Text style={styles.serverText}>
              Gateway: {gatewayUrl.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Server & Network Endpoints Modal */}
        <ServerSettingsModal
          visible={showServerSettings}
          onClose={() => setShowServerSettings(false)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ambientGlow: {
    position: 'absolute',
    top: '15%',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    filter: Platform.OS === 'web' ? 'blur(80px)' : undefined,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 32,
  },
  brandContainer: {
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f0f6fc',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: '#8b949e',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  card: {
    width: '100%',
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 20,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c9d1d9',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radii.md,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f1f1f',
    letterSpacing: -0.1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#21262d',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6e7681',
    letterSpacing: 0.8,
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: radii.md,
    height: 46,
    paddingHorizontal: 14,
    gap: 10,
  },
  devBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  footer: {
    alignItems: 'center',
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  serverText: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
  },
});

import React, { useState } from 'react';
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
import { makeRedirectUri } from 'expo-auth-session';
import {
  Bot,
  Zap,
  Lock,
  ArrowRight,
  Globe,
} from '../components/Icons';
import { colors } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';
import { ServerSettingsModal } from '../components/ServerSettingsModal';

WebBrowser.maybeCompleteAuthSession();

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
      avatarUrl: url.searchParams.get('avatarUrl') || undefined,
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
      avatarUrl: params.get('avatarUrl') || undefined,
      error: params.get('error') || undefined,
    };
  }
}

interface AuthScreenProps {
  onSuccess?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const loginWithDev = useDaemonStore((s) => s.loginWithDev);
  const loginWithToken = useDaemonStore((s) => s.loginWithToken);
  const gatewayUrl = useDaemonStore((s) => s.gatewayUrl);

  const [isLoadingDev, setIsLoadingDev] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const handleDevLogin = async () => {
    setIsLoadingDev(true);
    const ok = await loginWithDev();
    setIsLoadingDev(false);
    if (ok) {
      if (onSuccess) onSuccess();
    } else {
      Alert.alert(
        'Connection Error',
        `Unable to reach Gateway at ${gatewayUrl}. Ensure services are running.`
      );
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoadingGoogle(true);

      // Create return deep-link URL: cloud-agent://auth
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
            <Lock size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Authenticate Session</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Sign in with your Google account or connect using developer mode.
          </Text>

          {/* Primary Action: Google Sign-In via Gateway */}
          <TouchableOpacity
            style={[styles.googleBtn, isLoadingGoogle && styles.btnDisabled]}
            onPress={handleGoogleLogin}
            disabled={isLoadingGoogle || isLoadingDev}
            activeOpacity={0.8}
          >
            {isLoadingGoogle ? (
              <ActivityIndicator size="small" color="#1f2328" />
            ) : (
              <>
                <GoogleIcon size={18} />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Secondary Action: Developer Login */}
          <TouchableOpacity
            style={[styles.devBtn, isLoadingDev && styles.btnDisabled]}
            onPress={handleDevLogin}
            disabled={isLoadingDev || isLoadingGoogle}
            activeOpacity={0.7}
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
    shadowColor: '#0077b6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f0f6fc',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  card: {
    width: '100%',
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 20,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 17,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  googleBtnText: {
    color: '#1f2328',
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#21262d',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6e7681',
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0d1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  devBtnText: {
    color: '#c9d1d9',
    fontSize: 13,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  footer: {
    alignItems: 'center',
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  serverText: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

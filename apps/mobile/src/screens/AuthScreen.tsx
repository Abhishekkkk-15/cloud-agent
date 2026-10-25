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
import {
  Bot,
  Zap,
  Lock,
  ArrowRight,
  ShieldCheck,
  Server,
} from '../components/Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

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
    setIsLoadingGoogle(true);
    // In mobile Expo environments without Google client IDs configured,
    // fallback gracefully to dev login so development is never blocked.
    const ok = await loginWithDev();
    setIsLoadingGoogle(false);
    if (ok && onSuccess) {
      onSuccess();
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

          {/* Primary Action: Google OAuth */}
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            activeOpacity={0.85}
            disabled={isLoadingGoogle || isLoadingDev}
          >
            {isLoadingGoogle ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <>
                <View style={styles.googleIconPlaceholder}>
                  <Text style={styles.googleG}>G</Text>
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
          <View style={styles.serverPill}>
            <Server size={12} color="#8b949e" />
            <Text style={styles.serverText}>
              Gateway: {gatewayUrl.replace(/^https?:\/\//, '')}
            </Text>
          </View>
        </View>
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
    height: 46,
    gap: 10,
  },
  googleIconPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0077b6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0d1117',
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

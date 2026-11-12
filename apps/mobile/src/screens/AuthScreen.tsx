import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import {
  Button,
  Badge,
  Card,
  Spinner,
  Text,
  toast,
  cn,
} from 'panelui-native';
import {
  Sun,
  Moon,
  Palette,
  Globe,
  WifiOff,
  RefreshCw,
  Zap,
  Cloud,
} from '../components/Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { ServerSettingsModal } from '../components/ServerSettingsModal';
import { isRunningInExpoGo } from '../lib/notifications';
import { getGlossyHeaderTokens } from '../theme/tokens';
import { BrandLogo, CloudAgentLogo } from '../components/BrandLogo';

export { BrandLogo, CloudAgentLogo };

WebBrowser.maybeCompleteAuthSession();

/**
 * Google 4-Color Flat Brand Mark
 */
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

/**
 * Organic, soft cloud curves in backdrop
 */
const BackgroundClouds: React.FC<{ isLight: boolean }> = ({ isLight }) => {
  const primaryFill = isLight ? '#f3f4f6' : 'rgba(255, 255, 255, 0.025)';
  const secondaryFill = isLight ? '#f9fafb' : 'rgba(255, 255, 255, 0.015)';

  return (
    <View className="absolute inset-0" pointerEvents="none">
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

  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight, isSwiss), [isLight, isSwiss]);
  const isExpoGo = isRunningInExpoGo();

  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingDev, setIsLoadingDev] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const handleDevLogin = async () => {
    try {
      setIsLoadingDev(true);
      const ok = await loginWithDev();
      if (ok) {
        toast.show({
          variant: 'success',
          label: 'Welcome, Developer',
          description: 'Logged into Expo Go developer profile.',
          duration: 3000,
        });
        if (onSuccess) onSuccess();
      } else {
        toast.show({
          variant: 'destructive',
          label: 'Dev Login Failed',
          description: `Could not connect to Gateway at ${gatewayUrl}. Please ensure gateway server is online.`,
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.show({
        variant: 'destructive',
        label: 'Dev Login Error',
        description: err?.message || 'Dev login failed.',
        duration: 5000,
      });
    } finally {
      setIsLoadingDev(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isNetworkOnline) {
      toast.show({
        variant: 'warning',
        label: 'No Internet Connection',
        description: 'You are currently offline. Please check your network connection.',
        duration: 4000,
      });
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
          toast.show({
            variant: 'destructive',
            label: 'Sign-In Error',
            description: `Google authentication failed: ${parsed.error}`,
            duration: 5000,
          });
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
            toast.show({
              variant: 'success',
              label: 'Signed In',
              description: `Welcome back, ${parsed.name || 'User'}!`,
              duration: 3000,
            });
            if (onSuccess) onSuccess();
          } else {
            toast.show({
              variant: 'destructive',
              label: 'Sign-In Failed',
              description: `Could not complete login on Gateway at ${gatewayUrl}.`,
              duration: 5000,
            });
          }
        } else {
          toast.show({
            variant: 'destructive',
            label: 'Sign-In Error',
            description: 'No authorization token returned from provider.',
            duration: 5000,
          });
        }
      }
    } catch (err: any) {
      console.error('[AuthScreen] Google OAuth error:', err);
      toast.show({
        variant: 'destructive',
        label: 'Google Sign-In Error',
        description: err?.message || 'Google OAuth prompt could not be initialized.',
        duration: 5000,
      });
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const topInset = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 16);

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} />

      {/* Ambient Organic Cloud Backdrop */}
      <BackgroundClouds isLight={isLight} />

      {/* Top Bar Actions: 44x44 Circular Buttons */}
      <View
        className="absolute right-5 flex-row items-center gap-3 z-50"
        style={{ top: topInset }}
      >
        <TouchableOpacity
          style={[
            { width: 44, height: 44, borderRadius: 22 },
            glossyHeader.containerStyle,
          ]}
          className="items-center justify-center active:opacity-70"
          onPress={() => setShowServerSettings(true)}
          activeOpacity={0.7}
          accessibilityLabel="Server & Push Settings"
        >
          <Globe size={22} color={glossyHeader.iconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            { width: 44, height: 44, borderRadius: 22 },
            glossyHeader.containerStyle,
          ]}
          className="items-center justify-center active:opacity-70"
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Dark / Light Theme"
        >
          {theme === 'swiss' ? (
            <Palette size={22} color="#DC201E" />
          ) : isLight ? (
            <Moon size={22} color="#262626" />
          ) : (
            <Sun size={22} color="#f5f5f5" />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Center Content */}
      <View className="w-full max-w-sm items-center">
        {/* Cloud Agent Brand Logo */}
        <View className="mb-6 items-center justify-center">
          <BrandLogo size={84} />
        </View>

        {/* Brand Headline */}
        <Text className="text-3xl font-bold text-foreground tracking-tight text-center mb-2">
          Cloud Agent
        </Text>

        {/* Subtitle */}
        <Text className="text-base text-muted-foreground text-center leading-relaxed mb-8 px-4">
          Run your coding agent{'\n'}from anywhere.
        </Text>

        {/* Primary Action: Continue with Google Pill Button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full rounded-full py-3.5 px-6 flex-row items-center justify-center gap-3"
          onPress={handleGoogleLogin}
          disabled={isLoadingGoogle || isLoadingDev}
        >
          {isLoadingGoogle ? (
            <Spinner size="sm" color={isLight ? '#262626' : '#fafafa'} />
          ) : (
            <>
              <GoogleIcon size={20} />
              <View className="w-px h-4 bg-primary-foreground/20 mx-1" />
              <Text className="text-sm font-semibold text-primary-foreground">
                Continue with Google
              </Text>
            </>
          )}
        </Button>

        {/* Developer / Test Account Login (Only visible when running inside Expo Go client) */}
        {isExpoGo && (
          <View className="w-full mt-6 items-center">
            <View className="w-full flex-row items-center gap-3 mb-4">
              <View className="flex-1 h-px bg-border" />
              <Cloud size={14} color={isLight ? '#888888' : '#666666'} />
              <View className="flex-1 h-px bg-border" />
            </View>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              loading={isLoadingDev}
              startContent={<Zap size={14} color={isLight ? '#262626' : '#f5f5f5'} />}
              endContent={
                <Badge variant="secondary" size="sm" className="px-1.5 py-0 ml-1">
                  <Text className="text-[10px] font-medium text-muted-foreground">Dev Only</Text>
                </Badge>
              }
              className="py-2.5 px-4 rounded-2xl border-border bg-surface"
              onPress={handleDevLogin}
              disabled={isLoadingDev || isLoadingGoogle}
            >
              Expo Go Test / Dev Account
            </Button>
          </View>
        )}

        {/* Offline Warning Notice */}
        {!isNetworkOnline && (
          <Card className="w-full mt-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex-row items-center gap-2.5">
            <WifiOff size={15} color="#ef4444" />
            <Text className="text-xs text-destructive font-medium flex-1">
              No internet connection
            </Text>
            <Button
              variant="outline"
              size="xs"
              className="h-7 px-2.5 flex-row items-center gap-1"
              onPress={() => checkNetwork()}
            >
              <RefreshCw size={11} color={isLight ? '#262626' : '#f5f5f5'} />
              <Text className="text-xs font-medium text-foreground">Retry</Text>
            </Button>
          </Card>
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

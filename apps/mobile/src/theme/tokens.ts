export type ThemeMode = 'dark' | 'light' | 'swiss';

/**
 * Official Default PanelUI Dark Theme Palette
 * (Matches panelui-native/theme.css @variant dark)
 */
export const darkColors = {
  // Surfaces & Backgrounds
  bgPrimary: '#141414',
  bgCanvasInset: '#101010',
  bgCard: '#191919',
  bgSurface: '#1e1e1e',
  bgSurfaceSecondary: '#242424',
  bgSurfaceTertiary: '#2a2a2a',
  bgOverlay: '#232323',
  bgHover: '#262626',
  bgInput: 'rgba(255, 255, 255, 0.12)',
  bgModal: '#1d1d1d',
  bgUserBubble: '#242424',

  // Surface Tiers
  surfaceContainerLowest: '#101010',
  surfaceContainerLow: '#141414',
  surfaceContainer: '#191919',
  surfaceContainerHigh: '#1e1e1e',
  surfaceContainerHighest: '#242424',

  // Borders & Dividers
  borderDefault: 'rgba(255, 255, 255, 0.10)',
  borderMuted: 'rgba(255, 255, 255, 0.06)',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',

  // Typography
  textPrimary: '#f5f5f5',
  textSecondary: '#d4d4d4',
  textMuted: '#a3a3a3',
  textCode: '#e5e5e5',
  textMutedOutline: '#a3a3a3',
  textSecondaryOutline: '#d4d4d4',
  textDisabled: '#525252',

  // High-Contrast Primary Accent
  primary: '#f5f5f5',
  primaryForeground: '#262626',
  primaryLight: '#ffffff',
  primarySubtle: 'rgba(255, 255, 255, 0.08)',
  primaryBorder: 'rgba(255, 255, 255, 0.16)',
  primaryHover: 'rgba(255, 255, 255, 0.12)',

  // Live Status / Telemetry
  statusLive: '#10b981',
  statusLivePulse: '#34d399',
  statusLiveSubtle: 'rgba(16, 185, 129, 0.10)',
  statusLiveBorder: 'rgba(16, 185, 129, 0.25)',

  // Status Tokens
  info: '#3b82f6',
  infoSubtle: 'rgba(59, 130, 246, 0.10)',
  infoBorder: 'rgba(59, 130, 246, 0.25)',

  success: '#10b981',
  successSubtle: 'rgba(16, 185, 129, 0.10)',
  successBorder: 'rgba(16, 185, 129, 0.25)',

  warning: '#f59e0b',
  warningSubtle: 'rgba(245, 158, 11, 0.10)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',

  destructive: '#ef4444',
  destructiveSubtle: 'rgba(239, 68, 68, 0.10)',
  destructiveBorder: 'rgba(239, 68, 68, 0.25)',

  // Color aliases for backwards compatibility
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  blueBg: '#1e293b',
  blueSubtle: 'rgba(59, 130, 246, 0.10)',
  blueBorder: 'rgba(59, 130, 246, 0.25)',

  green: '#10b981',
  greenLight: '#34d399',
  greenWhitish: '#a7f3d0',
  greenBg: '#064e3b',
  greenHover: '#047857',
  greenSubtle: 'rgba(16, 185, 129, 0.10)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',

  purple: '#8b5cf6',
  purpleBg: '#2e1065',
  purpleSubtle: 'rgba(139, 92, 246, 0.10)',
  purpleBorder: 'rgba(139, 92, 246, 0.25)',

  red: '#ef4444',
  redBg: '#7f1d1d',
  redSubtle: 'rgba(239, 68, 68, 0.10)',
  redBorder: 'rgba(239, 68, 68, 0.25)',
};

/**
 * Official Default PanelUI White/Light Theme Palette
 * (Matches panelui-native/theme.css @variant light)
 */
export const lightColors: typeof darkColors = {
  // Surfaces & Backgrounds
  bgPrimary: '#ffffff',
  bgCanvasInset: '#fafafa',
  bgCard: '#ffffff',
  bgSurface: '#f7f7f7',
  bgSurfaceSecondary: '#f1f1f1',
  bgSurfaceTertiary: '#eaeaea',
  bgOverlay: '#ffffff',
  bgHover: '#f1f1f1',
  bgInput: 'rgba(0, 0, 0, 0.10)',
  bgModal: 'rgba(255, 255, 255, 0.98)',
  bgUserBubble: '#f7f7f7',

  // Surface Tiers
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fafafa',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#f7f7f7',
  surfaceContainerHighest: '#f1f1f1',

  // Borders & Dividers
  borderDefault: 'rgba(0, 0, 0, 0.08)',
  borderMuted: 'rgba(0, 0, 0, 0.04)',
  borderSubtle: 'rgba(0, 0, 0, 0.06)',

  // Typography
  textPrimary: '#262626',
  textSecondary: '#525252',
  textMuted: '#686868',
  textCode: '#171717',
  textMutedOutline: '#686868',
  textSecondaryOutline: '#525252',
  textDisabled: '#a3a3a3',

  // High-Contrast Primary Accent
  primary: '#262626',
  primaryForeground: '#fafafa',
  primaryLight: '#404040',
  primarySubtle: 'rgba(0, 0, 0, 0.06)',
  primaryBorder: 'rgba(0, 0, 0, 0.12)',
  primaryHover: 'rgba(0, 0, 0, 0.08)',

  // Live Status / Telemetry
  statusLive: '#10b981',
  statusLivePulse: '#059669',
  statusLiveSubtle: 'rgba(16, 185, 129, 0.10)',
  statusLiveBorder: 'rgba(16, 185, 129, 0.25)',

  // Status Tokens
  info: '#3b82f6',
  infoSubtle: 'rgba(59, 130, 246, 0.10)',
  infoBorder: 'rgba(59, 130, 246, 0.25)',

  success: '#10b981',
  successSubtle: 'rgba(16, 185, 129, 0.10)',
  successBorder: 'rgba(16, 185, 129, 0.25)',

  warning: '#f59e0b',
  warningSubtle: 'rgba(245, 158, 11, 0.10)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',

  destructive: '#ef4444',
  destructiveSubtle: 'rgba(239, 68, 68, 0.10)',
  destructiveBorder: 'rgba(239, 68, 68, 0.25)',

  // Color aliases for backwards compatibility
  blue: '#3b82f6',
  blueLight: '#2563eb',
  blueBg: '#eff6ff',
  blueSubtle: 'rgba(59, 130, 246, 0.10)',
  blueBorder: 'rgba(59, 130, 246, 0.25)',

  green: '#10b981',
  greenLight: '#059669',
  greenWhitish: '#047857',
  greenBg: '#ecfdf5',
  greenHover: '#d1fae5',
  greenSubtle: 'rgba(16, 185, 129, 0.10)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',

  purple: '#8b5cf6',
  purpleBg: '#f5f3ff',
  purpleSubtle: 'rgba(139, 92, 246, 0.10)',
  purpleBorder: 'rgba(139, 92, 246, 0.25)',

  red: '#ef4444',
  redBg: '#fef2f2',
  redSubtle: 'rgba(239, 68, 68, 0.10)',
  redBorder: 'rgba(239, 68, 68, 0.25)',
};

/**
 * Official Swiss Minimalist Theme Palette
 * (Matches apps/web swiss newsprint & signal red style)
 */
export const swissColors: typeof darkColors = {
  // Surfaces & Backgrounds
  bgPrimary: '#F8F3EC',
  bgCanvasInset: '#F1EBE1',
  bgCard: '#F1EBE1',
  bgSurface: '#F1EBE1',
  bgSurfaceSecondary: '#EBE4D8',
  bgSurfaceTertiary: '#E5DDD0',
  bgOverlay: '#F8F3EC',
  bgHover: '#EBE4D8',
  bgInput: 'rgba(17, 16, 16, 0.10)',
  bgModal: '#F8F3EC',
  bgUserBubble: '#F1EBE1',

  // Surface Tiers
  surfaceContainerLowest: '#F8F3EC',
  surfaceContainerLow: '#F1EBE1',
  surfaceContainer: '#F1EBE1',
  surfaceContainerHigh: '#EBE4D8',
  surfaceContainerHighest: '#E5DDD0',

  // Borders & Dividers
  borderDefault: 'rgba(17, 16, 16, 0.16)',
  borderMuted: 'rgba(17, 16, 16, 0.08)',
  borderSubtle: 'rgba(17, 16, 16, 0.12)',

  // Typography
  textPrimary: '#111010',
  textSecondary: '#4A4640',
  textMuted: '#6B665E',
  textCode: '#111010',
  textMutedOutline: '#6B665E',
  textSecondaryOutline: '#4A4640',
  textDisabled: '#8C8880',

  // High-Contrast Primary Accent: Swiss Signal Red
  primary: '#DC201E',
  primaryForeground: '#FFFFFF',
  primaryLight: '#EF4444',
  primarySubtle: 'rgba(220, 32, 30, 0.10)',
  primaryBorder: 'rgba(220, 32, 30, 0.25)',
  primaryHover: 'rgba(220, 32, 30, 0.15)',

  // Live Status / Telemetry
  statusLive: '#10b981',
  statusLivePulse: '#34d399',
  statusLiveSubtle: 'rgba(16, 185, 129, 0.10)',
  statusLiveBorder: 'rgba(16, 185, 129, 0.25)',

  // Status Tokens
  info: '#3b82f6',
  infoSubtle: 'rgba(59, 130, 246, 0.10)',
  infoBorder: 'rgba(59, 130, 246, 0.25)',

  success: '#10b981',
  successSubtle: 'rgba(16, 185, 129, 0.10)',
  successBorder: 'rgba(16, 185, 129, 0.25)',

  warning: '#f59e0b',
  warningSubtle: 'rgba(245, 158, 11, 0.10)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',

  destructive: '#DC201E',
  destructiveSubtle: 'rgba(220, 32, 30, 0.10)',
  destructiveBorder: 'rgba(220, 32, 30, 0.25)',

  // Color aliases
  blue: '#3b82f6',
  blueLight: '#2563eb',
  blueBg: '#eff6ff',
  blueSubtle: 'rgba(59, 130, 246, 0.10)',
  blueBorder: 'rgba(59, 130, 246, 0.25)',

  green: '#10b981',
  greenLight: '#059669',
  greenWhitish: '#047857',
  greenBg: '#ecfdf5',
  greenHover: '#d1fae5',
  greenSubtle: 'rgba(16, 185, 129, 0.10)',
  greenBorder: 'rgba(16, 185, 129, 0.25)',

  purple: '#8b5cf6',
  purpleBg: '#f5f3ff',
  purpleSubtle: 'rgba(139, 92, 246, 0.10)',
  purpleBorder: 'rgba(139, 92, 246, 0.25)',

  red: '#DC201E',
  redBg: '#fef2f2',
  redSubtle: 'rgba(220, 32, 30, 0.10)',
  redBorder: 'rgba(220, 32, 30, 0.25)',
};

export type ThemeColors = typeof darkColors;

// Default exported colors (PanelUI Dark by default)
export const colors = darkColors;

export function getThemeColors(mode?: ThemeMode | null): ThemeColors {
  if (mode === 'swiss') return swissColors;
  return mode === 'light' ? lightColors : darkColors;
}

/**
 * PanelUI Default Shape Scale
 * (Matches panelui-native/theme.css radius scale)
 */
export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 16,
  '3xl': 24,
  bubble: 16,
  card: 14,
  code: 8,
  btn: 8,
  full: 9999,
};

export const typography = {
  mono: 'monospace',
};

/**
 * Glossy Header Action Button & Icon Design Tokens
 */
export function getGlossyHeaderTokens(isLight: boolean, isSwiss?: boolean) {
  if (isSwiss) {
    return {
      iconColor: '#111010',
      containerStyle: {
        backgroundColor: '#F1EBE1',
        borderWidth: 1,
        borderColor: 'rgba(17, 16, 16, 0.16)',
        shadowColor: '#111010',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    };
  }
  return {
    iconColor: isLight ? '#262626' : '#f5f5f5',
    containerStyle: {
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: isLight ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.16)',
      shadowColor: isLight ? 'rgba(0, 0, 0, 0.12)' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isLight ? 0.06 : 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
  };
}

/**
 * Glossy Bento Grid Item & Card Design Tokens
 * Provides subtle glass elevation with a lit top-border refraction
 */
export function getGlossyGridItemTokens(isLight: boolean, isSwiss?: boolean) {
  if (isSwiss) {
    return {
      containerStyle: {
        backgroundColor: 'rgba(241, 235, 225, 0.95)',
        borderWidth: 1,
        borderColor: 'rgba(17, 16, 16, 0.12)',
        borderTopColor: '#FFFFFF',
        shadowColor: '#111010',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    };
  }
  return {
    containerStyle: {
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderColor: isLight ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.12)',
      borderTopColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.22)',
      shadowColor: isLight ? 'rgba(0, 0, 0, 0.12)' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isLight ? 0.06 : 0.22,
      shadowRadius: 6,
      elevation: 3,
    },
  };
}

export const getGlossyCardTokens = getGlossyGridItemTokens;

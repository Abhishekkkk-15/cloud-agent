export type ThemeMode = 'dark' | 'light';

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

export type ThemeColors = typeof darkColors;

// Default exported colors (PanelUI Dark by default)
export const colors = darkColors;

export function getThemeColors(mode?: ThemeMode | null): ThemeColors {
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
export function getGlossyHeaderTokens(isLight: boolean) {
  return {
    iconColor: isLight ? '#0077b6' : '#38bdf8',
    containerStyle: {
      backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: isLight ? 'rgba(0, 119, 182, 0.22)' : 'rgba(255, 255, 255, 0.14)',
      borderTopColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.35)',
      shadowColor: isLight ? 'rgba(0, 119, 182, 0.35)' : '#0077b6',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isLight ? 0.12 : 0.32,
      shadowRadius: 6,
      elevation: 3,
    },
  };
}

export type ThemeMode = 'dark' | 'light';

export const darkColors = {
  // Paradev & Cloud Agent Unified Dark Theme (Pure Monochrome Black, White, Gray)
  bgPrimary: '#0a0a0a',
  bgCanvasInset: '#050505',
  bgCard: '#161616',
  bgSurface: '#1c1c1c',
  bgUserBubble: '#2F2F2F',
  bgHover: '#262626',
  bgInput: '#161616',
  bgModal: 'rgba(10, 10, 10, 0.95)',

  // Surface Tiers
  surfaceContainerLowest: '#0a0a0a',
  surfaceContainerLow: '#141414',
  surfaceContainer: '#161616',
  surfaceContainerHigh: '#1c1c1c',
  surfaceContainerHighest: '#262626',

  borderDefault: '#262626',
  borderMuted: '#1f1f1f',
  borderSubtle: 'rgba(255, 255, 255, 0.10)',

  textPrimary: '#fafafa',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  textCode: '#b4b4b4',
  textMutedOutline: '#737373',
  textSecondaryOutline: '#a3a3a3',
  textDisabled: '#525252',

  // Primary Accent: Pure Monochrome White & Grayscale (Zero Blue)
  primary: '#fafafa',
  primaryLight: '#ffffff',
  primarySubtle: 'rgba(255, 255, 255, 0.08)',
  primaryBorder: 'rgba(255, 255, 255, 0.20)',
  primaryHover: 'rgba(255, 255, 255, 0.15)',

  // Live Status Indicator (Monochrome / No Green)
  statusLive: '#fafafa',
  statusLivePulse: '#ffffff',
  statusLiveSubtle: 'rgba(255, 255, 255, 0.08)',
  statusLiveBorder: 'rgba(255, 255, 255, 0.18)',

  // Mappings for legacy colors
  blue: '#fafafa',
  blueLight: '#ffffff',
  blueBg: '#fafafa',
  blueSubtle: 'rgba(255, 255, 255, 0.08)',
  blueBorder: 'rgba(255, 255, 255, 0.20)',

  green: '#fafafa',
  greenLight: '#ffffff',
  greenWhitish: '#fafafa',
  greenBg: '#262626',
  greenHover: '#333333',
  greenSubtle: 'rgba(255, 255, 255, 0.08)',
  greenBorder: 'rgba(255, 255, 255, 0.20)',

  purple: '#fafafa',
  purpleBg: '#262626',
  purpleSubtle: 'rgba(255, 255, 255, 0.08)',
  purpleBorder: 'rgba(255, 255, 255, 0.20)',

  // Danger Red (Alerts and security exceptions only)
  red: '#ef4444',
  redBg: '#dc2626',
  redSubtle: 'rgba(239, 68, 68, 0.15)',
  redBorder: 'rgba(239, 68, 68, 0.3)',
};

export const lightColors: typeof darkColors = {
  // Pure Clean White Theme (Crisp, High Contrast, Modern)
  bgPrimary: '#ffffff',
  bgCanvasInset: '#f6f8fa',
  bgCard: '#ffffff',
  bgSurface: '#f6f8fa',
  bgUserBubble: '#f0f3f6',
  bgHover: '#eaeef2',
  bgInput: '#f6f8fa',
  bgModal: 'rgba(255, 255, 255, 0.98)',

  // Surface Tiers
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f8fa',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#f0f2f5',
  surfaceContainerHighest: '#e4e7eb',

  borderDefault: '#d0d7de',
  borderMuted: '#e1e4e8',
  borderSubtle: 'rgba(0, 0, 0, 0.08)',

  textPrimary: '#1f2328',
  textSecondary: '#57606a',
  textMuted: '#6e7781',
  textCode: '#24292f',
  textMutedOutline: '#6e7781',
  textSecondaryOutline: '#57606a',
  textDisabled: '#8c959f',

  // Primary Accent: Pacific Azure Blue & Crisp Dark
  primary: '#0077b6',
  primaryLight: '#0096c7',
  primarySubtle: 'rgba(0, 119, 182, 0.08)',
  primaryBorder: 'rgba(0, 119, 182, 0.25)',
  primaryHover: 'rgba(0, 119, 182, 0.15)',

  // Live Status Indicator
  statusLive: '#1a7f37',
  statusLivePulse: '#2da44e',
  statusLiveSubtle: 'rgba(45, 164, 78, 0.10)',
  statusLiveBorder: 'rgba(45, 164, 78, 0.25)',

  blue: '#0077b6',
  blueLight: '#0096c7',
  blueBg: '#e7f5ff',
  blueSubtle: 'rgba(0, 119, 182, 0.08)',
  blueBorder: 'rgba(0, 119, 182, 0.25)',

  green: '#1a7f37',
  greenLight: '#2da44e',
  greenWhitish: '#1a7f37',
  greenBg: '#dafbe1',
  greenHover: '#c8f7d3',
  greenSubtle: 'rgba(45, 164, 78, 0.10)',
  greenBorder: 'rgba(45, 164, 78, 0.25)',

  purple: '#8250df',
  purpleBg: '#fbefff',
  purpleSubtle: 'rgba(130, 80, 223, 0.10)',
  purpleBorder: 'rgba(130, 80, 223, 0.25)',

  red: '#cf222e',
  redBg: '#ffebe9',
  redSubtle: 'rgba(207, 34, 46, 0.10)',
  redBorder: 'rgba(207, 34, 46, 0.25)',
};

export type ThemeColors = typeof darkColors;

// Default exported colors (for static backwards compatibility)
export const colors = darkColors;

export function getThemeColors(mode?: ThemeMode | null): ThemeColors {
  return mode === 'light' ? lightColors : darkColors;
}

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 22,
  bubble: 22,
  card: 14,
  code: 10,
  btn: 8,
  full: 9999,
};

export const typography = {
  mono: 'monospace',
};

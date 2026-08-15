// SafeYou-Campus design system — colors
// A calm, trustworthy "safety" palette: deep ink neutrals + a confident red
// reserved for danger/SOS, a teal accent for "safe" actions, and amber for caution.

export const colors = {
  // Brand
  ink: '#0B1120',        // near-black navy — primary text & dark surfaces
  ink800: '#111827',
  ink700: '#1E293B',
  ink600: '#334155',
  ink500: '#475569',
  ink400: '#64748B',
  ink300: '#94A3B8',
  ink200: '#CBD5E1',
  ink100: '#E2E8F0',
  ink50: '#F1F5F9',

  bg: '#F7F8FB',          // app background
  surface: '#FFFFFF',      // cards
  surfaceMuted: '#F8FAFC',

  // Brand accent — teal (trust, "safe", primary CTAs that aren't danger)
  primary: '#0EA5A4',
  primaryDark: '#0B7E7D',
  primaryLight: '#CCFBF1',
  primarySoft: '#E6FFFB',

  // Danger — SOS / emergency
  danger: '#DC2626',
  dangerDark: '#B91C1C',
  dangerLight: '#FEE2E2',
  dangerSoft: '#FEF2F2',

  // Warning — caution / offline-suspected / moderate risk
  warning: '#D97706',
  warningLight: '#FEF3C7',

  // Success — safe status
  success: '#16A34A',
  successLight: '#DCFCE7',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  border: '#E7EAF0',
  overlay: 'rgba(11,17,32,0.55)',
  shadow: '#0B1120',
};

export type StatusKind = 'safe' | 'sos' | 'offline-suspected';

export const statusColors: Record<StatusKind, { fg: string; bg: string; label: string }> = {
  safe: { fg: colors.success, bg: colors.successLight, label: 'Safe' },
  sos: { fg: colors.danger, bg: colors.dangerLight, label: 'SOS Active' },
  'offline-suspected': { fg: colors.warning, bg: colors.warningLight, label: 'Checking in…' },
};

export default colors;

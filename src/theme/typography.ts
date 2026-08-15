import { TextStyle } from 'react-native';
import { colors } from './colors';

type TypeStyle = TextStyle & { color: string };

export const typography: Record<string, TypeStyle> = {
  display: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.ink },
  h3: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, fontWeight: '400', color: colors.ink700, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', color: colors.ink },
  caption: { fontSize: 13, fontWeight: '500', color: colors.ink400 },
  overline: { fontSize: 12, fontWeight: '700', color: colors.ink400, letterSpacing: 0.8, textTransform: 'uppercase' },
  button: { fontSize: 15, fontWeight: '700', color: colors.white },
  link: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
};

export default typography;

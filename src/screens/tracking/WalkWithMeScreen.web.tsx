import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../../theme';

// Web fallback: react-native-maps is native-only, so Walk With Me's live map
// cannot render in a browser. The full journey experience (map + live tracking)
// is available in the Expo Go mobile app.
export default function WalkWithMeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.titleBar}>
        <Text style={typography.h3}>Walk With Me</Text>
        <Text style={typography.caption}>Live journey tracking is available in the mobile app</Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Live tracking unavailable on web</Text>
        <Text style={styles.placeholderText}>
          Walk With Me uses native maps and background location, which browsers don't support. Open this
          screen in the Expo Go app on Android or iOS to start a journey and share your live location with
          a trusted contact.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  titleBar: {
    position: 'absolute', top: 56, left: 20, right: 20, zIndex: 1,
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  placeholderTitle: { ...typography.h3, marginBottom: spacing.sm, textAlign: 'center' },
  placeholderText: { ...typography.body, color: colors.ink600, textAlign: 'center' },
});

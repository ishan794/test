import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import Button from '../../components/ui/Button';
import { colors, radius, spacing, typography } from '../../theme';

const STEPS: { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    title: 'Live location, only for safety',
    body: 'We check in every 60 seconds so trusted contacts can find you if something goes wrong.',
    icon: 'location-outline',
  },
  {
    title: 'Add your first trusted contact',
    body: 'You can add up to 5 people who get notified during an SOS or if you go unexpectedly offline.',
    icon: 'people-outline',
  },
  {
    title: "You're protected",
    body: 'Hold the SOS button for 3 seconds any time you need immediate help.',
    icon: 'shield-checkmark-outline',
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const setHasOnboarded = useAuthStore((s) => s.setHasOnboarded);

  const finish = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user.id) return;
    await supabase.from('users').update({ has_onboarded: true }).eq('id', sessionData.session.user.id);
    setHasOnboarded(true); // instantly routes RootNavigator to MainTabNavigator
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.iconWrap}>
        <Ionicons name={current.icon} size={40} color={colors.white} />
      </View>

      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body}>{current.body}</Text>

      <View style={{ marginTop: spacing.huge }}>
        <Button label={isLast ? "Let's go" : 'Next'} onPress={() => (isLast ? finish() : setStep(step + 1))} variant="dark" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xxxl, justifyContent: 'center', backgroundColor: colors.white },
  dots: { flexDirection: 'row', marginBottom: spacing.xxxl, gap: spacing.xs },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: colors.ink100 },
  dotActive: { backgroundColor: colors.ink },
  iconWrap: {
    width: 84, height: 84, borderRadius: radius.xxl,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: { ...typography.display, marginBottom: spacing.md },
  body: { ...typography.body, fontSize: 16, color: colors.ink500 },
});

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, Animated, Easing, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSOS } from '../services/sosService';
import { colors, radius } from '../theme';

const HOLD_MS = 3000; // hold to arm
const COUNTDOWN_SECONDS = 5; // cancellation window before the alert is sent
const SIZE = 208;

type Phase = 'idle' | 'holding' | 'countdown' | 'sending';

export interface SOSButtonProps {
  incidentType?: string;
  contactIds?: string[];
  contactPhone?: string;
  contactName?: string;
  onSent?: (smsSent: boolean) => void;
}

export default function SOSButton({
  incidentType = 'emergency',
  contactIds = [],
  contactPhone,
  contactName,
  onSent,
}: SOSButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const cleanup = () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
    timer.current = null;
    interval.current = null;
  };

  useEffect(() => cleanup, []);

  const send = async () => {
    setPhase('sending');
    try {
      const { smsSent } = await triggerSOS(incidentType, contactIds, contactPhone);
      onSent?.(smsSent);
      if (smsSent) {
        Alert.alert('SOS sent by SMS', 'The network was unavailable, so the alert was sent as a text message instead.');
      }
    } catch (err: any) {
      Alert.alert('SOS failed to send', err.message ?? 'Please try again or call campus security directly.');
    } finally {
      setPhase('idle');
    }
  };

  const startHold = () => {
    setPhase('holding');
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(() => {
      // Hold complete → start the cancellation countdown.
      setPhase('countdown');
      setCountdown(COUNTDOWN_SECONDS);
      interval.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (interval.current) clearInterval(interval.current);
            interval.current = null;
            send();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, HOLD_MS);
  };

  const cancel = () => {
    cleanup();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    setPhase('idle');
    setCountdown(COUNTDOWN_SECONDS);
  };

  const ringScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  const label =
    phase === 'sending'
      ? 'Sending SOS…'
      : phase === 'countdown'
        ? `Sending in ${countdown}s`
        : phase === 'holding'
          ? 'Keep Holding…'
          : 'HOLD FOR SOS';

  const sublabel =
    phase === 'sending'
      ? contactName
        ? `Alerting ${contactName}`
        : 'Alerting your contacts'
      : phase === 'countdown'
        ? 'Release early to cancel'
        : phase === 'holding'
          ? '3 second hold to arm'
          : 'Hold, then 5s to cancel';

  return (
    <Animated.View style={{ transform: [{ scale: phase === 'idle' ? pulse : 1 }] }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ambientRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
      />
      <Pressable
        onPressIn={phase === 'idle' ? startHold : undefined}
        onPressOut={phase === 'holding' || phase === 'countdown' ? cancel : undefined}
        disabled={phase === 'sending'}
        style={({ pressed }) => [styles.button, pressed && phase === 'idle' && { transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons
          name={phase === 'sending' ? 'hourglass' : 'alert'}
          size={38}
          color={colors.white}
          style={{ marginBottom: 6 }}
        />
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.subtext}>{sublabel}</Text>
      </Pressable>

      {phase === 'countdown' && (
        <Pressable style={styles.cancelBtn} onPress={cancel}>
          <Ionicons name="close-circle" size={16} color={colors.danger} />
          <Text style={styles.cancelText}>Cancel SOS</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ambientRing: {
    position: 'absolute',
    top: -14,
    left: -14,
    right: -14,
    bottom: -14,
    borderRadius: radius.full,
    backgroundColor: colors.danger,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  text: { color: colors.white, fontWeight: '800', fontSize: 17, letterSpacing: 0.3 },
  subtext: { color: '#FFD9D3', fontSize: 11, marginTop: 6, fontWeight: '600' },
  cancelBtn: {
    position: 'absolute',
    bottom: -46,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  cancelText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});

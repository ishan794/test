import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, Animated, Easing, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerSOS } from '../services/sosService';
import { colors, radius } from '../theme';

const HOLD_MS = 3000;
const SIZE = 208;

export default function SOSButton() {
  const [holding, setHolding] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const startHold = () => {
    setHolding(true);
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start();
    timer.current = setTimeout(async () => {
      setHolding(false);
      setSending(true);
      try {
        await triggerSOS();
      } catch (err: any) {
        Alert.alert('SOS failed to send', err.message ?? 'Please try again or call campus security directly.');
      } finally {
        setSending(false);
      }
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    setHolding(false);
  };

  const ringScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Animated.View style={{ transform: [{ scale: holding ? 1 : pulse }] }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.ambientRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
      />
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        disabled={sending}
        style={({ pressed }) => [styles.button, pressed && !holding && { transform: [{ scale: 0.98 }] }]}
      >
        <Ionicons name={sending ? 'hourglass' : 'alert'} size={38} color={colors.white} style={{ marginBottom: 6 }} />
        <Text style={styles.text}>
          {sending ? 'Sending SOS…' : holding ? 'Keep Holding…' : 'HOLD FOR SOS'}
        </Text>
        <Text style={styles.subtext}>{sending ? 'Alerting your contacts' : '3 second hold to prevent misfires'}</Text>
      </Pressable>
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
});

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { login } from '../../services/authService';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { colors, spacing, typography } from '../../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      // Same as Register — onAuthStateChanged handles the redirect,
      // and this session now persists on the device (Section 7),
      // so the user won't see this screen again until they log out.
    } catch (err: any) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandWrap}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={28} color={colors.white} />
          </View>
          <Text style={styles.brand}>SafeYou-Campus</Text>
        </View>

        <Text style={typography.h1}>Welcome back</Text>
        <Text style={[typography.body, { marginBottom: spacing.xxl }]}>Log in to keep your safety network active.</Text>

        <Input
          label="Email"
          icon="mail-outline"
          placeholder="you@university.edu"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          icon="lock-closed-outline"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button label={loading ? 'Logging in…' : 'Log In'} onPress={handleLogin} loading={loading} style={{ marginTop: spacing.sm }} />

        <Pressable onPress={() => navigation.navigate('Register')} style={{ marginTop: spacing.xxl }}>
          <Text style={styles.link}>New here? <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>Create an account</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xxl, justifyContent: 'center', backgroundColor: colors.white },
  brandWrap: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoBadge: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  brand: { fontSize: 15, fontWeight: '700', color: colors.ink400, letterSpacing: 0.3 },
  link: { textAlign: 'center', color: colors.ink500, fontSize: 14 },
});

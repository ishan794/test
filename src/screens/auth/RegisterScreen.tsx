import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { signUp } from '../../services/authService';
import { isValidEmail, isStrongPassword } from '../../utils/validators';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, spacing } from '../../theme';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !studentId || !university || !email || !password) {
      Alert.alert('Missing info', 'Please fill every field.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (!isStrongPassword(password)) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      // This one call creates the real auth account AND the
      // users row, and marks hasOnboarded: false
      // so RootNavigator routes straight to OnboardingScreen next.
      await signUp(email, password, fullName, studentId, university);
      // No navigation call needed — onAuthStateChanged in RootNavigator
      // picks up the new session automatically and switches screens.
    } catch (err: any) {
      Alert.alert('Registration failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Create your account" subtitle="Takes under a minute." onBack={() => navigation.goBack()} />

        <Input label="Full Name" icon="person-outline" placeholder="Jane Perera" value={fullName} onChangeText={setFullName} />
        <Input label="Student ID" icon="card-outline" placeholder="EG/2022/1234" value={studentId} onChangeText={setStudentId} />
        <Input label="University" icon="school-outline" placeholder="University of Colombo" value={university} onChangeText={setUniversity} />
        <Input label="Student Email" icon="mail-outline" placeholder="you@university.edu" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Password" icon="lock-closed-outline" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} />

        <Button label={loading ? 'Creating account…' : 'Register'} onPress={handleRegister} loading={loading} variant="dark" />

        <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.xxl }}>
          <Text style={styles.link}>Already have an account? <Text style={{ color: colors.primaryDark, fontWeight: '700' }}>Log in</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: spacing.xxl },
  link: { textAlign: 'center', color: colors.ink500, fontSize: 14 },
});

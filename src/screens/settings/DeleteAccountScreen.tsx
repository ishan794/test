import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';
import { stopLocationHeartbeat } from '../../services/locationService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '../../theme';

export default function DeleteAccountScreen({ navigation }: any) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Invokes the account-deletion Edge Function, which cascade-deletes
      // the user's trusted_contacts, journeys, sos_events, incidents, and
      // auth.users row server-side (with the service role key).
      const { error } = await supabase.functions.invoke('account-deletion');
      if (error) throw error;
      await stopLocationHeartbeat();
      await supabase.auth.signOut();
      // RootNavigator's onAuthStateChanged listener routes back to Login automatically.
    } catch (err: any) {
      Alert.alert('Could not delete account', err.message ?? 'Please try again or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, trusted contacts, reports, and journey history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Delete Account" onBack={() => navigation.goBack()} />
      <Card style={styles.warningCard} elevated={false}>
        <Ionicons name="warning-outline" size={22} color={colors.danger} style={{ marginBottom: spacing.sm }} />
        <Text style={typography.bodyStrong}>This action is permanent</Text>
        <Text style={[typography.body, { marginTop: spacing.xs }]}>
          Deleting your account removes your profile, trusted contacts, incident reports, and journey history from
          SafeYou-Campus. This cannot be undone.
        </Text>
      </Card>
      <Button label={deleting ? 'Deleting…' : 'Delete My Account'} onPress={confirmDelete} loading={deleting} variant="danger" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.xl },
  warningCard: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerLight },
});
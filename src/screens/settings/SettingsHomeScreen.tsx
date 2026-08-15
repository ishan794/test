import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../../services/authService';
import { stopLocationHeartbeat } from '../../services/locationService';
import { isCampusSecurity } from '../../services/adminService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { colors, radius, spacing, typography } from '../../theme';

type Row = { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; body: string; onPress: () => void };

export default function SettingsHomeScreen({ navigation }: any) {
  const [isSecurity, setIsSecurity] = useState(false);

  useEffect(() => {
    isCampusSecurity().then(setIsSecurity).catch(() => setIsSecurity(false));
  }, []);

  const rows: Row[] = [
    { icon: 'person-outline', tint: colors.ink, title: 'My Account', body: 'Profile, student ID & university', onPress: () => navigation.navigate('MyAccount') },
    { icon: 'people-outline', tint: colors.primaryDark, title: 'Trusted Contacts', body: 'People notified during an SOS', onPress: () => navigation.navigate('TrustedContacts') },
    { icon: 'notifications-outline', tint: colors.primaryDark, title: 'Notification Settings', body: 'Choose what you get notified about', onPress: () => navigation.navigate('NotificationSettings') },
    { icon: 'navigate-outline', tint: colors.success, title: 'Location Settings', body: 'Control background location sharing', onPress: () => navigation.navigate('LocationSettings') },
    { icon: 'shield-checkmark-outline', tint: colors.warning, title: 'Privacy & Security', body: 'Auto-SOS, silent alerts & more', onPress: () => navigation.navigate('PrivacySecurity') },
    { icon: 'document-text-outline', tint: colors.success, title: 'My Reports', body: 'Track incidents you\u2019ve submitted', onPress: () => navigation.navigate('MyReports') },
    ...(isSecurity
      ? [{ icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap, tint: colors.danger, title: 'Campus Security', body: 'Live alerts & incident review', onPress: () => navigation.navigate('CampusSecurity') }]
      : []),
  ];

  const handleLogout = async () => {
    await stopLocationHeartbeat();
    await logout();
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need to log in again to use SafeYou-Campus.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: handleLogout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <Text style={typography.h1}>Settings</Text>
      <Text style={[typography.body, { marginBottom: spacing.xl }]}>Manage your safety network and preferences</Text>

      <Card style={{ padding: 0, marginBottom: spacing.xl }}>
        {rows.map((r, i) => (
          <Pressable key={r.title} onPress={r.onPress} style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.rowBorder, pressed && { opacity: 0.6 }]}>
            <View style={[styles.iconWrap, { backgroundColor: r.tint + '1A' }]}>
              <Ionicons name={r.icon} size={19} color={r.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{r.title}</Text>
              <Text style={typography.caption}>{r.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
          </Pressable>
        ))}
      </Card>

      <Button label="Log Out" variant="outline" onPress={confirmLogout} icon={<Ionicons name="log-out-outline" size={18} color={colors.ink} />} style={{ marginBottom: spacing.md }} />

      <Pressable onPress={() => navigation.navigate('DeleteAccount')} style={styles.deleteLink}>
        <Text style={styles.deleteLinkText}>Delete Account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  deleteLink: { alignItems: 'center', paddingVertical: spacing.md },
  deleteLinkText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
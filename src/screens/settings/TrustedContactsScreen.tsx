import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import supabase from '../../config/supabase';
import { addTrustedContact, toggleAutoShare, removeTrustedContact } from '../../services/contactService';
import ContactCard from '../../components/ContactCard';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EmptyState from '../../components/ui/EmptyState';
import { TrustedContact } from '../../types/contact';
import { isValidPhone } from '../../utils/validators';
import { colors, spacing, typography } from '../../theme';

function toTrustedContact(row: Record<string, unknown>): TrustedContact {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    relationship: String(row.relationship ?? ''),
    autoShare: Boolean(row.auto_share),
    status: (row.status as TrustedContact['status']) ?? 'pending',
    isSystemContact: Boolean(row.is_system_contact),
  };
}

const MAX_CONTACTS = 5;

export default function TrustedContactsScreen({ navigation }: any) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let active = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid || !active) return;
      channel = supabase
        .channel(`trusted-contacts-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_contacts', filter: `user_id=eq.${uid}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const removedId = String((payload.old as Record<string, unknown>).id);
            setContacts((prev) => prev.filter((c) => c.id !== removedId));
          } else {
            const row = toTrustedContact(payload.new as Record<string, unknown>);
            setContacts((prev) => {
              const rest = prev.filter((c) => c.id !== row.id);
              return [row, ...rest];
            });
          }
        })
        .subscribe();

      const { data } = await supabase
        .from('trusted_contacts')
        .select('*')
        .eq('user_id', uid)
        .order('added_at', { ascending: false });
      if (active && data) setContacts(data.map(toTrustedContact));
    };
    load();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleAdd = async () => {
    if (!name || !phone) {
      Alert.alert('Missing info', 'Enter a name and phone number.');
      return;
    }
    if (!isValidPhone(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid phone number, e.g. +94771234567.');
      return;
    }
    if (contacts.length >= MAX_CONTACTS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_CONTACTS} trusted contacts.`);
      return;
    }
    setAdding(true);
    try {
      const inserted = await addTrustedContact(name, phone, relationship || 'Contact');
      // Update the list immediately — don't rely solely on the Realtime
      // channel firing, in case the table isn't in the realtime publication.
      setContacts((prev) => {
        const rest = prev.filter((c) => c.id !== String(inserted.id));
        return [toTrustedContact(inserted), ...rest];
      });
      setName('');
      setPhone('');
      setRelationship('');
    } catch (err: any) {
      Alert.alert('Could not add contact', err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (id: string, contactName: string) => {
    Alert.alert('Remove contact?', `${contactName} will stop receiving your SOS and journey alerts.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setContacts((prev) => prev.filter((c) => c.id !== id)); // optimistic
          try {
            await removeTrustedContact(id);
          } catch (err: any) {
            Alert.alert('Could not remove contact', err.message);
          }
        },
      },
    ]);
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}
      data={contacts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.xl }}>
          <ScreenHeader title="Trusted Contacts" subtitle={`${contacts.length} of ${MAX_CONTACTS} added`} onBack={() => navigation.goBack()} />
          <Card>
            <Text style={styles.formTitle}>Add a contact</Text>
            <Input placeholder="Name" value={name} onChangeText={setName} />
            <Input placeholder="Phone (+94...)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input placeholder="Relationship (e.g. Mom, Roommate)" value={relationship} onChangeText={setRelationship} style={{ marginBottom: 0 }} />
            <View style={{ marginTop: spacing.lg }}>
              <Button label={adding ? 'Adding…' : 'Add Contact'} onPress={handleAdd} loading={adding} variant="dark" />
            </View>
          </Card>
        </View>
      }
      renderItem={({ item }) => (
        <ContactCard
          contact={item}
          onToggleAutoShare={(v) => toggleAutoShare(item.id, v)}
          onRemove={() => handleRemove(item.id, item.name)}
        />
      )}
      ListEmptyComponent={<EmptyState icon="people-outline" title="No trusted contacts yet" body="Add the people you want notified during an SOS or a missed check-in." />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  formTitle: { ...typography.bodyStrong, marginBottom: spacing.lg },
});
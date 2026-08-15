import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getJourneysSharedWithMe } from '../../services/journeyService';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EmptyState from '../../components/ui/EmptyState';
import { colors, radius, spacing, typography } from '../../theme';

type SharedJourney = {
  id: string;
  ownerName: string;
  destination_name: string | null;
  started_at: string;
  last_ping_at: string | null;
};

export default function SharedWithMeScreen({ navigation }: any) {
  const [journeys, setJourneys] = useState<SharedJourney[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getJourneysSharedWithMe()
        .then((data) => active && setJourneys(data as SharedJourney[]))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}
      data={journeys}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <ScreenHeader title="Shared with me" subtitle="Live journeys people are sharing with you" onBack={() => navigation.goBack()} />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => navigation.navigate('JourneyViewer', { journeyId: item.id, ownerName: item.ownerName })}>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Ionicons name="walk" size={18} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{item.ownerName}</Text>
              <Text style={typography.caption}>Heading to {item.destination_name || 'their destination'}</Text>
            </View>
            <View style={styles.liveDot} />
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState icon="walk-outline" title="No one is sharing with you right now" body="When someone adds you as a trusted contact and starts a Walk With Me, it'll show up here." />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success },
});
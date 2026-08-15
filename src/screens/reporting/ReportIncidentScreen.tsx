import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, Alert, ScrollView, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { submitIncident } from '../../services/incidentService';
import { IncidentType } from '../../types/incident';
import { ensureLocationPermission } from '../../utils/permissions';
import Chip from '../../components/ui/Chip';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '../../theme';

const TYPES: IncidentType[] = ['harassment', 'stalking', 'ragging', 'unsafe-area', 'hazard', 'other'];

export default function ReportIncidentScreen() {
  const [type, setType] = useState<IncidentType>('harassment');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) setMediaUris((prev) => [...prev, result.assets[0].uri]);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Add details', 'Please describe what happened.');
      return;
    }
    setSubmitting(true);
    try {
      const granted = await ensureLocationPermission();
      if (!granted) return;
      const loc = await Location.getCurrentPositionAsync({});
      await submitIncident(
        type,
        description,
        { lat: loc.coords.latitude, lng: loc.coords.longitude },
        anonymous,
        mediaUris,
      );
      Alert.alert('Report submitted', 'Campus security has been notified.');
      setDescription('');
      setMediaUris([]);
    } catch (err: any) {
      Alert.alert('Submission failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <ScreenHeader title="Report Incident" subtitle="Help keep campus safer for everyone" />

      <Card style={styles.anonRow} elevated={false}>
        <Ionicons name={anonymous ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.ink600} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={typography.bodyStrong}>Keep me anonymous</Text>
          <Text style={typography.caption}>Your name won't be attached to this report</Text>
        </View>
        <Switch
          value={anonymous}
          onValueChange={setAnonymous}
          trackColor={{ false: colors.ink100, true: colors.primaryLight }}
          thumbColor={anonymous ? colors.primary : '#FFFFFF'}
        />
      </Card>

      <Text style={styles.sectionLabel}>Incident Type</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((t) => (
          <Chip key={t} label={t.replace('-', ' ')} active={type === t} onPress={() => setType(t)} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>Details</Text>
      <View style={styles.textAreaCard}>
        <TextInput
          multiline
          placeholder="Describe what happened, who was involved, and any immediate danger."
          placeholderTextColor={colors.ink300}
          value={description}
          onChangeText={setDescription}
          style={styles.textArea}
        />
      </View>

      <Text style={styles.sectionLabel}>Evidence</Text>
      <Pressable style={styles.mediaButton} onPress={pickImage}>
        <Ionicons name="camera-outline" size={20} color={colors.ink500} />
        <Text style={styles.mediaButtonText}>Add Photo ({mediaUris.length})</Text>
      </Pressable>
      {mediaUris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xl }}>
          {mediaUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
        </ScrollView>
      )}

      <Button label={submitting ? 'Submitting…' : 'Submit Report'} onPress={handleSubmit} loading={submitting} variant="dark" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  anonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  sectionLabel: { ...typography.overline, marginBottom: spacing.md },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  textAreaCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  textArea: { minHeight: 110, fontSize: 15, color: colors.ink, textAlignVertical: 'top' },
  mediaButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink200,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
  },
  mediaButtonText: { color: colors.ink500, fontWeight: '600', marginLeft: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.md, marginRight: spacing.sm },
});
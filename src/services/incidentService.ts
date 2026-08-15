import supabase from '../config/supabase';

export async function submitIncident(
  type: string,
  description: string,
  location: { lat: number; lng: number },
  isAnonymous: boolean,
  mediaUris: string[],
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id ?? null;
  if (!uid) throw new Error('Not authenticated');

  const mediaUrls: string[] = [];
  for (const uri of mediaUris) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { error: uploadError } = await supabase.storage
      .from('incident-evidence')
      .upload(path, blob, { contentType: response.headers.get('Content-Type') ?? 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData, error: signError } = await supabase.storage
      .from('incident-evidence')
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signError) throw signError;
    mediaUrls.push(urlData.signedUrl);
  }

  const { error } = await supabase.from('incidents').insert({
    // Always store the real reporter_id so the user can track their own
    // report in My Reports. is_anonymous controls whether OTHER people
    // (campus security dashboards, etc.) see identity — not whether the
    // reporter themselves can see it.
    reporter_id: uid,
    is_anonymous: isAnonymous,
    type,
    description,
    lat: location.lat,
    lng: location.lng,
    media_urls: mediaUrls,
    status: 'submitted',
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}
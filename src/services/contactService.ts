import supabase from '../config/supabase';

export async function addTrustedContact(name: string, phone: string, relationship: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('trusted_contacts')
    .insert({
      user_id: uid,
      name,
      phone,
      relationship,
      auto_share: true,
      status: 'pending',
      is_system_contact: false,
      added_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrustedContact(
  contactId: string,
  updates: { name?: string; phone?: string; relationship?: string },
) {
  const { error } = await supabase
    .from('trusted_contacts')
    .update(updates)
    .eq('id', contactId);
  if (error) throw error;
}

export async function toggleAutoShare(contactId: string, value: boolean) {
  const { error } = await supabase.from('trusted_contacts').update({ auto_share: value }).eq('id', contactId);
  if (error) throw error;
}

export async function setContactPriority(contactId: string, priority: 'primary' | 'secondary') {
  const { error } = await supabase.from('trusted_contacts').update({ priority }).eq('id', contactId);
  if (error) throw error;
}

export async function setPrimaryContact(contactId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error('Not authenticated');

  // Clear any existing primary, then mark this one primary (single primary).
  const { error: clearError } = await supabase
    .from('trusted_contacts')
    .update({ priority: 'secondary' })
    .eq('user_id', uid)
    .eq('priority', 'primary');
  if (clearError) throw clearError;

  const { error } = await supabase
    .from('trusted_contacts')
    .update({ priority: 'primary' })
    .eq('id', contactId);
  if (error) throw error;
}

export async function removeTrustedContact(contactId: string) {
  const { error } = await supabase.from('trusted_contacts').delete().eq('id', contactId);
  if (error) throw error;
}
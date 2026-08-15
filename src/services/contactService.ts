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

export async function toggleAutoShare(contactId: string, value: boolean) {
  const { error } = await supabase.from('trusted_contacts').update({ auto_share: value }).eq('id', contactId);
  if (error) throw error;
}

export async function removeTrustedContact(contactId: string) {
  const { error } = await supabase.from('trusted_contacts').delete().eq('id', contactId);
  if (error) throw error;
}
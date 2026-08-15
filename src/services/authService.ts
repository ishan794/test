import supabase from '../config/supabase';

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  studentId: string,
  university: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        student_id: studentId,
        university,
      },
    },
  });

  if (error) {
    throw error;
  }

  const uid = data.user?.id;
  if (uid) {
    // The on_auth_user_created DB trigger should already have created a
    // base row. This upsert fills in the fields it collects and is safe to
    // run even if the trigger already inserted the row — never conflicts.
    const { error: upsertError } = await supabase.from('users').upsert({
      id: uid,
      full_name: fullName,
      student_id: studentId,
      university,
      email,
    }, { onConflict: 'id' });
    if (upsertError) throw upsertError;
  }

  return data.user;
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
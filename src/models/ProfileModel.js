import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * ProfileModel
 * Handles all data operations for the `profiles` table.
 */
export const ProfileModel = {
  /**
   * Fetch a user's profile by their auth user ID.
   */
  async getById(userId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, avatar_url, created_at')
      .eq('id', userId)
      .single();

    return { data, error };
  },

  /**
   * Fetch only the role for a given user ID.
   */
  async getRoleById(userId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    return { role: data?.role || 'user', error };
  },

  /**
   * Fetch the active session token for a user.
   */
  async getSessionToken(userId) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('session_token')
      .eq('id', userId)
      .single();

    return { sessionToken: data?.session_token || null, data, error };
  },

  /**
   * Update the active session token for a user.
   */
  async updateSessionToken(userId, token) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('profiles')
      .update({ session_token: token })
      .eq('id', userId);

    return { error };
  },
};


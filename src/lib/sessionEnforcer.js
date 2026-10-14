import { v4 as uuidv4 } from 'uuid';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const SESSION_KEY = 'e_ambulance_session_token';

// 2.3 FIX: Safe storage accessor to prevent crashes during SSR
function getStorage() {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

/**
 * Generate a new session token and store it both locally and in the DB.
 */
export async function createSession(userId) {
  const supabase = getSupabaseBrowserClient();
  const token = uuidv4();

  // Update the session token in the profiles table
  const { error } = await supabase
    .from('profiles')
    .update({ session_token: token })
    .eq('id', userId);

  if (error) {
    console.error('Failed to create session:', error);
    return null;
  }

  // Store locally
  const storage = getStorage();
  if (storage) {
    storage.setItem(SESSION_KEY, token);
  }
  return token;
}

/**
 * Validate that the current device's session token matches the DB.
 * Returns true if valid, false if another device has taken over.
 */
export async function validateSession(userId) {
  const storage = getStorage();
  const localToken = storage ? storage.getItem(SESSION_KEY) : null;

  if (!localToken) return false;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('session_token')
    .eq('id', userId)
    .single();

  if (error || !data) return false;

  return data.session_token === localToken;
}

/**
 * Clear local session
 */
export function clearSession() {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(SESSION_KEY);
  }
}

/**
 * Subscribe to session changes — if token changes, kick user out
 */
export function subscribeToSessionChanges(userId, onKicked) {
  const supabase = getSupabaseBrowserClient();
  const channelName = `session:${userId}:${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const newToken = payload.new.session_token;
        const storage = getStorage();
        const localToken = storage ? storage.getItem(SESSION_KEY) : null;

        if (newToken && localToken && newToken !== localToken) {
          onKicked();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

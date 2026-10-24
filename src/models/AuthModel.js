import { v4 as uuidv4 } from 'uuid';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProfileModel } from './ProfileModel';

const SESSION_KEY = 'e_ambulance_session_token';

function getStorage() {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

/**
 * AuthModel
 * Handles authentication (Supabase Auth) and single-device session enforcement.
 */
export const AuthModel = {
  /**
   * Sign in with email and password.
   */
  async signInWithPassword({ email, password }) {
    const supabase = getSupabaseBrowserClient();
    return await supabase.auth.signInWithPassword({ email, password });
  },

  /**
   * Register a new user account with metadata.
   */
  async signUp({ email, password, fullName, phone, role, vehicleNumber, vehicleType }) {
    const supabase = getSupabaseBrowserClient();
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
          vehicle_number: vehicleNumber || '',
          vehicle_type: vehicleType || 'basic',
        },
      },
    });
  },

  /**
   * Send a password reset email.
   */
  async resetPasswordForEmail(email, redirectTo) {
    const supabase = getSupabaseBrowserClient();
    return await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  },

  /**
   * Sign out the current user and clear local session token.
   */
  async signOut() {
    const supabase = getSupabaseBrowserClient();
    AuthModel.clearLocalSession();
    return await supabase.auth.signOut();
  },

  /**
   * Get the currently authenticated user.
   */
  async getCurrentUser() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    return { user: data?.user || null, error };
  },

  /**
   * Subscribe to Supabase auth state changes.
   */
  onAuthStateChange(callback) {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  },

  /**
   * Create and persist a new single-device session token.
   */
  async createSession(userId) {
    const token = uuidv4();

    // Write to localStorage FIRST so Realtime echo never sees a mismatch
    const storage = getStorage();
    if (storage) {
      storage.setItem(SESSION_KEY, token);
    }

    const { error } = await ProfileModel.updateSessionToken(userId, token);
    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }

    return token;
  },

  /**
   * Validate that the local session token matches the database token.
   */
  async validateSession(userId) {
    const storage = getStorage();
    const localToken = storage ? storage.getItem(SESSION_KEY) : null;

    const { data, error } = await ProfileModel.getSessionToken(userId);
    if (error || !data) return true;

    // If no token exists in localStorage yet (e.g. right after registration), adopt or initialize
    if (!localToken) {
      if (!data.session_token) {
        await AuthModel.createSession(userId);
      } else if (storage) {
        storage.setItem(SESSION_KEY, data.session_token);
      }
      return true;
    }

    return !data.session_token || data.session_token === localToken;
  },

  /**
   * Clear the session token from localStorage.
   */
  clearLocalSession() {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(SESSION_KEY);
    }
  },

  /**
   * Subscribe to real-time session token updates to kick out duplicate device logins.
   */
  subscribeToSessionChanges(userId, onKicked) {
    const supabase = getSupabaseBrowserClient();
    const channelName = `session:${userId}`;

    const existing = supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }

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
  },
};


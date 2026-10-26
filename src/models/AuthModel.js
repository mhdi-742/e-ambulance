import { v4 as uuidv4 } from 'uuid';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProfileModel } from './ProfileModel';

const LEGACY_SESSION_KEY = 'e_ambulance_session_token';

function getSessionKey(userId) {
  return userId ? `${LEGACY_SESSION_KEY}:${userId}` : LEGACY_SESSION_KEY;
}

function getStorage() {
  if (typeof window !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

// In-flight guard so validateSession never races with an active createSession call
let inFlightSessionCreation = null;

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
   * Get the currently authenticated user (prefers fast local session, falls back to getUser).
   */
  async getCurrentUser() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      return { user: session.user, error: null };
    }
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
    if (!userId) return null;
    const token = uuidv4();
    const storage = getStorage();
    const key = getSessionKey(userId);

    // Write to localStorage first so any immediate Realtime echo matches
    if (storage) {
      storage.setItem(key, token);
      storage.setItem(LEGACY_SESSION_KEY, token);
    }

    const updatePromise = ProfileModel.updateSessionToken(userId, token);
    inFlightSessionCreation = updatePromise;

    try {
      const { error } = await updatePromise;
      if (error) {
        console.warn('Could not persist session token to database:', error.message);
        // Roll back local token if DB update failed so validateSession won't see a false mismatch
        if (storage) {
          storage.removeItem(key);
          storage.removeItem(LEGACY_SESSION_KEY);
        }
        return null;
      }
      return token;
    } finally {
      if (inFlightSessionCreation === updatePromise) {
        inFlightSessionCreation = null;
      }
    }
  },

  /**
   * Validate that the local session token matches the database token.
   */
  async validateSession(userId) {
    if (!userId) return true;

    // Wait if createSession is currently writing a new token
    if (inFlightSessionCreation) {
      try {
        await inFlightSessionCreation;
      } catch {
        // Ignore
      }
    }

    const storage = getStorage();
    const key = getSessionKey(userId);
    const localToken = storage ? storage.getItem(key) : null;

    const { data, error } = await ProfileModel.getSessionToken(userId);
    if (error || !data) return true;

    // If no user-scoped token exists in localStorage yet, adopt the DB token
    if (!localToken) {
      if (!data.session_token) {
        await AuthModel.createSession(userId);
      } else if (storage) {
        storage.setItem(key, data.session_token);
        storage.setItem(LEGACY_SESSION_KEY, data.session_token);
      }
      return true;
    }

    return !data.session_token || data.session_token === localToken;
  },

  /**
   * Clear session tokens from localStorage.
   */
  clearLocalSession(userId = null) {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(LEGACY_SESSION_KEY);
    if (userId) {
      storage.removeItem(getSessionKey(userId));
    } else {
      Object.keys(storage).forEach((k) => {
        if (k.startsWith(`${LEGACY_SESSION_KEY}:`)) {
          storage.removeItem(k);
        }
      });
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
          const localToken = storage ? storage.getItem(getSessionKey(userId)) : null;
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

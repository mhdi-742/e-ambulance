'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSession, validateSession, clearSession, subscribeToSessionChanges } from '@/lib/sessionEnforcer';

/**
 * Hook for auth state and session management
 */
export function useSession() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionKicked, setSessionKicked] = useState(false);

  const supabase = getSupabaseBrowserClient();

  // Fetch profile from DB
  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);

      // If driver, fetch driver data
      if (data.role === 'driver') {
        const { data: driver } = await supabase
          .from('drivers')
          .select('*')
          .eq('profile_id', userId)
          .single();

        setDriverData(driver);
      }
    }
  }, [supabase]);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);
        await fetchProfile(authUser.id);
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          // Create new session token for single-device enforcement
          await createSession(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setDriverData(null);
          clearSession();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  // Subscribe to session changes for single-device enforcement
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToSessionChanges(user.id, () => {
      setSessionKicked(true);
      supabase.auth.signOut();
    });

    return unsubscribe;
  }, [user, supabase]);

  // Sign out
  const signOut = useCallback(async () => {
    clearSession();
    await supabase.auth.signOut();
  }, [supabase]);

  return {
    user,
    profile,
    driverData,
    loading,
    sessionKicked,
    signOut,
    refetchProfile: () => user && fetchProfile(user.id),
  };
}

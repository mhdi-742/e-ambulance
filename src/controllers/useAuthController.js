'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthModel } from '@/models/AuthModel';
import { ProfileModel } from '@/models/ProfileModel';
import { DriverModel } from '@/models/DriverModel';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const AUTH_CACHE_KEY = 'e_ambulance_auth_cache';

function readAuthCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeAuthCache(payload) {
  if (typeof window === 'undefined') return;
  try {
    if (!payload) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
    } else {
      window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore storage quota errors
  }
}

const SessionContext = createContext(null);

/**
 * Global SessionProvider
 * Mounted once in RootLayout (`src/app/layout.js`).
 * Keeps `user`, `profile`, and `driverData` alive in memory across all route transitions
 * so navigating to `/` or between pages never flickers or re-fetches.
 */
export function SessionProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionKicked, setSessionKicked] = useState(false);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setDriverData(null);
    writeAuthCache(null);
  }, []);

  const kickUserOut = useCallback(() => {
    setSessionKicked(true);
    clearAuthState();
    AuthModel.signOut().then(() => {
      router.push('/auth/login?kicked=1');
    });
  }, [clearAuthState, router]);

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser?.id) return null;
    const { data: prof, error } = await ProfileModel.getById(authUser.id);
    if (!error && prof) {
      setProfile(prof);
      let driver = null;
      if (prof.role === 'driver') {
        const { data: drv } = await DriverModel.ensureByProfile(authUser);
        driver = drv || null;
        setDriverData(driver);
      } else {
        setDriverData(null);
      }
      writeAuthCache({ user: authUser, profile: prof, driverData: driver });
      return { profile: prof, driverData: driver };
    }
    return null;
  }, []);

  const hydrateSession = useCallback((snapshot) => {
    if (!snapshot?.user) return;
    setUser(snapshot.user);
    if (snapshot.profile) setProfile(snapshot.profile);
    if (snapshot.driverData !== undefined) setDriverData(snapshot.driverData);
    setLoading(false);
    writeAuthCache({
      user: snapshot.user,
      profile: snapshot.profile || null,
      driverData: snapshot.driverData || null,
    });
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();

    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        setUser(session.user);

        // Immediately apply cached profile/driver snapshot if it belongs to this user
        const cached = readAuthCache();
        if (cached?.user?.id === session.user.id && cached?.profile) {
          setProfile(cached.profile);
          setDriverData(cached.driverData || null);
          if (cached.profile.role !== 'driver' || cached.driverData) {
            setLoading(false);
          }
        }

        const isValid = await AuthModel.validateSession(session.user.id);
        if (!active) return;
        if (!isValid) {
          kickUserOut();
          return;
        }
        await fetchProfile(session.user);
      } else {
        clearAuthState();
      }
      if (active) {
        setLoading(false);
      }
    };

    initAuth();

    const unsubscribeAuth = AuthModel.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        if (event === 'TOKEN_REFRESHED') {
          const isValid = await AuthModel.validateSession(session.user.id);
          if (!active) return;
          if (!isValid) {
            kickUserOut();
            return;
          }
        }
        setUser(session.user);
        await fetchProfile(session.user);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        clearAuthState();
        AuthModel.clearLocalSession();
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [fetchProfile, kickUserOut, clearAuthState]);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeRealtime = AuthModel.subscribeToSessionChanges(user.id, kickUserOut);

    // Re-validate session immediately when phone screen unlocks or tab regains focus
    const verifyOnWakeUp = async () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const isValid = await AuthModel.validateSession(user.id);
      if (!isValid) {
        kickUserOut();
      }
    };

    document.addEventListener('visibilitychange', verifyOnWakeUp);
    window.addEventListener('focus', verifyOnWakeUp);

    return () => {
      unsubscribeRealtime();
      document.removeEventListener('visibilitychange', verifyOnWakeUp);
      window.removeEventListener('focus', verifyOnWakeUp);
    };
  }, [user?.id, kickUserOut]);

  const signOut = useCallback(async () => {
    clearAuthState();
    await AuthModel.signOut();
  }, [clearAuthState]);

  const refetchProfile = useCallback(async () => {
    if (user) {
      return await fetchProfile(user);
    }
    return null;
  }, [user, fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      driverData,
      loading,
      sessionKicked,
      signOut,
      refetchProfile,
      hydrateSession,
    }),
    [user, profile, driverData, loading, sessionKicked, signOut, refetchProfile, hydrateSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Controller Hook: Consumes the persistent SessionProvider context.
 * Does NOT re-fetch on page navigation because SessionProvider lives in RootLayout.
 */
export function useSessionController() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionController must be used within a SessionProvider');
  }
  return context;
}

/**
 * Controller Hook: Manages the Login page state and form submission.
 */
export function useLoginController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrateSession } = useSessionController();
  const roleHint = searchParams.get('role');
  const wasKicked = searchParams.get('kicked') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await AuthModel.signInWithPassword({ email, password });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    await AuthModel.createSession(data.user.id);
    const { data: prof } = await ProfileModel.getById(data.user.id);
    const role = prof?.role || 'user';

    let driver = null;
    if (role === 'driver') {
      const { data: drv } = await DriverModel.ensureByProfile(data.user);
      driver = drv || null;
    }

    // Hydrate global SessionProvider immediately before navigating
    hydrateSession({ user: data.user, profile: prof, driverData: driver });

    setLoading(false);

    switch (role) {
      case 'driver':
        router.push('/driver');
        break;
      case 'admin':
        router.push('/admin');
        break;
      default:
        router.push('/user');
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    toast,
    setToast,
    roleHint,
    wasKicked,
    handleLogin,
  };
}

/**
 * Controller Hook: Manages the Registration page state, validation, and submission.
 */
export function useRegisterController() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    vehicleNumber: '',
    vehicleType: 'basic',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setRole = (role) => {
    setFormData((prev) => ({ ...prev, role }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }

    if (formData.password.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    setLoading(true);

    const { data, error } = await AuthModel.signUp({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      role: formData.role,
      vehicleNumber: formData.vehicleNumber,
      vehicleType: formData.vehicleType,
    });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    await AuthModel.createSession(data.user.id);

    if (formData.role === 'driver' && data.user) {
      const { error: driverError } = await DriverModel.upsertByProfileId({
        profileId: data.user.id,
        vehicleNumber: formData.vehicleNumber,
        vehicleType: formData.vehicleType,
      });

      if (driverError) {
        console.error('Driver record upsert failed:', driverError);
      }
    }

    setLoading(false);
    setToast({ message: 'Account created successfully!', type: 'success' });

    setTimeout(() => {
      if (formData.role === 'driver') {
        router.push('/driver');
      } else {
        router.push('/user');
      }
    }, 1000);
  };

  return {
    formData,
    handleChange,
    setRole,
    loading,
    toast,
    setToast,
    handleRegister,
  };
}

/**
 * Controller Hook: Manages the Password Reset page state and submission.
 */
export function useResetPasswordController() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState(null);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/login`
        : undefined;

    const { error } = await AuthModel.resetPasswordForEmail(email, redirectUrl);

    setLoading(false);

    if (error) {
      setToast({ message: error.message, type: 'error' });
    } else {
      setSubmitted(true);
      setToast({
        message: 'Password reset link sent! Please check your email.',
        type: 'success',
      });
    }
  };

  return {
    email,
    setEmail,
    loading,
    submitted,
    toast,
    setToast,
    handleReset,
  };
}

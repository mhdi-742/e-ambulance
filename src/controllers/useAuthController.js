'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthModel } from '@/models/AuthModel';
import { ProfileModel } from '@/models/ProfileModel';
import { DriverModel } from '@/models/DriverModel';

/**
 * Controller Hook: Manages authenticated user session, profile, driver data,
 * and single-device session enforcement.
 */
export function useSessionController() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionKicked, setSessionKicked] = useState(false);

  const kickUserOut = useCallback(() => {
    setSessionKicked(true);
    AuthModel.signOut().then(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login?kicked=1';
      }
    });
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await ProfileModel.getById(userId);
    if (!error && data) {
      setProfile(data);
      if (data.role === 'driver') {
        const { data: driver } = await DriverModel.getByProfileId(userId);
        setDriverData(driver);
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const { user: authUser } = await AuthModel.getCurrentUser();
      if (authUser) {
        const isValid = await AuthModel.validateSession(authUser.id);
        if (!isValid) {
          kickUserOut();
          return;
        }
        setUser(authUser);
        await fetchProfile(authUser.id);
      }
      setLoading(false);
    };

    initAuth();

    const unsubscribeAuth = AuthModel.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setDriverData(null);
        AuthModel.clearLocalSession();
      }
    });

    return () => unsubscribeAuth();
  }, [fetchProfile, kickUserOut]);

  useEffect(() => {
    if (!user) return;
    return AuthModel.subscribeToSessionChanges(user.id, kickUserOut);
  }, [user, kickUserOut]);

  const signOut = useCallback(async () => {
    await AuthModel.signOut();
  }, []);

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

/**
 * Controller Hook: Manages the Login page state and form submission.
 */
export function useLoginController() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    const { role } = await ProfileModel.getRoleById(data.user.id);

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

    // Ensure driver record exists via idempotent upsert if registering as a driver
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


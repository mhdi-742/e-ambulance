'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleHint = searchParams.get('role');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const supabase = getSupabaseBrowserClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    setLoading(false);

    if (profile) {
      switch (profile.role) {
        case 'driver': router.push('/driver'); break;
        case 'admin':  router.push('/admin');  break;
        default:       router.push('/user');
      }
    } else {
      router.push('/user');
    }
  };

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="inline-block px-3 py-1 mb-3 rounded-full text-xs font-semibold border border-zinc-700 bg-zinc-800 text-zinc-300">
          {roleHint === 'driver' ? 'Driver Portal' : 'Patient Portal'}
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Sign In</h1>
        <p className="text-xs text-zinc-400">
          {roleHint === 'driver'
            ? 'Sign in to access driver dispatches'
            : 'Sign in to book and track your emergency ambulance'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
          />
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? <LoadingSpinner size="sm" text="" /> : 'Sign In'}
        </button>
      </form>

      {/* Footer link */}
      <div className="mt-6 text-center text-xs text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-red-400 hover:underline font-semibold">
          Register here
        </Link>
      </div>

      {/* Alternative role toggle link */}
      <div className="mt-4 pt-4 border-t border-zinc-800 text-center text-xs">
        {roleHint === 'driver' ? (
          <Link href="/auth/login" className="text-zinc-400 hover:text-white">
            Switch to Patient Sign In
          </Link>
        ) : (
          <Link href="/auth/login?role=driver" className="text-zinc-400 hover:text-white">
            Are you an ambulance driver? Click here
          </Link>
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md p-8 border border-zinc-800 bg-zinc-900 rounded-2xl">
        {/* Brand */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
              EA
            </div>
            <span className="font-bold text-lg text-white">E-Ambulance</span>
          </Link>
        </div>

        <Suspense fallback={<LoadingSpinner text="Loading..." />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

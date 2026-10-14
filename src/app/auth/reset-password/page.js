'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState(null);

  const supabase = getSupabaseBrowserClient();

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/login`
      : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950">
      <div className="w-full max-w-md p-8 border border-zinc-800 bg-zinc-900 rounded-2xl">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}

        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
              EA
            </div>
            <span className="font-bold text-lg text-white">E-Ambulance</span>
          </Link>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Reset Password</h1>
          <p className="text-xs text-zinc-400">
            Enter your account email to receive a password recovery link
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-300 text-xs">
              If an account with {email} exists, a password reset link has been dispatched to your inbox.
            </div>
            <Link
              href="/auth/login"
              className="inline-block px-6 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <button
              id="reset-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? <LoadingSpinner size="sm" text="" /> : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-zinc-400">
          Remembered your password?{' '}
          <Link href="/auth/login" className="text-red-400 hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

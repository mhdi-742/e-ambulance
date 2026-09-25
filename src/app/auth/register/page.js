'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';

export default function RegisterPage() {
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

  const supabase = getSupabaseBrowserClient();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone,
          role: formData.role,
        },
      },
    });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLoading(false);
      return;
    }

    if (formData.role === 'driver' && data.user) {
      const { error: driverError } = await supabase.from('drivers').insert({
        profile_id: data.user.id,
        vehicle_number: formData.vehicleNumber,
        vehicle_type: formData.vehicleType,
      });

      if (driverError) {
        console.error('Driver record creation failed:', driverError);
      }
    }

    setLoading(false);
    setToast({ message: 'Account created successfully!', type: 'success' });

    setTimeout(() => {
      switch (formData.role) {
        case 'driver':
          router.push('/driver');
          break;
        case 'admin':
          router.push('/admin');
          break;
        default:
          router.push('/user');
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 py-12 bg-zinc-950">
      <div className="w-full max-w-md p-8 border border-zinc-800 bg-zinc-900 rounded-2xl">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}

        {/* Brand */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
              EA
            </div>
            <span className="font-bold text-lg text-white">E-Ambulance</span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3 mb-1">Create Account</h1>
          <p className="text-xs text-zinc-400">Join Raiganj emergency medical dispatch</p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Role Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'user' }))}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                  formData.role === 'user'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                Patient / User
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, role: 'driver' }))}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${
                  formData.role === 'driver'
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                Ambulance Driver
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="Your full name"
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="+91 XXXXX XXXXX"
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Driver-specific fields */}
          {formData.role === 'driver' && (
            <div className="space-y-3 p-4 rounded-xl border border-zinc-700 bg-zinc-950">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Driver Vehicle Details
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  name="vehicleNumber"
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  required
                  placeholder="WB XX AB 1234"
                  className="w-full px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Vehicle Type
                </label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="basic">Basic Ambulance (Oxygen)</option>
                  <option value="icu">ICU Ambulance (Ventilator)</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Min. 6 characters"
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter password"
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? <LoadingSpinner size="sm" text="" /> : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-red-400 hover:underline font-semibold">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

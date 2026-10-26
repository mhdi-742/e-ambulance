'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

export default function LandingHeader() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useSession();

  const role = profile?.role || 'user';
  const dashboardHref =
    role === 'admin' ? '/admin' : role === 'driver' ? '/driver' : '/user';
  const dashboardLabel =
    role === 'admin'
      ? 'Admin Dashboard'
      : role === 'driver'
      ? 'Driver Console'
      : 'My Trips';

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
  };

  return (
    <header className="w-full h-16 md:h-20 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-base">
            EA
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">E-Ambulance</span>
            <span className="hidden sm:block text-[10px] text-zinc-400 -mt-1">
              Raiganj Emergency Dispatch
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
          <Link href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="#fleet" className="hover:text-white transition-colors">
            Fleet
          </Link>
          <Link href="#hospitals" className="hover:text-white transition-colors">
            Hospitals
          </Link>
          <Link href="#emergency" className="text-red-400 hover:text-red-300 transition-colors">
            Emergency
          </Link>
        </nav>

        {/* Right Action Links — Dynamic based on Auth & Role */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block w-24 h-8 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
              <div className="w-28 h-8 rounded-lg bg-zinc-900 border border-zinc-800 animate-pulse" />
            </div>
          ) : user ? (
            <>
              {role === 'driver' && (
                <>
                  <Link
                    href="/driver/history"
                    className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                  >
                    Trip History
                  </Link>
                  <Link
                    href="/driver"
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                    Driver Console →
                  </Link>
                </>
              )}

              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                >
                  Admin Dashboard →
                </Link>
              )}

              {role === 'user' && (
                <>
                  <Link
                    href="/user"
                    className="px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700 rounded-lg hover:bg-zinc-900 transition-colors"
                  >
                    {dashboardLabel}
                  </Link>
                  <Link
                    href="/user/book"
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                  >
                    Book Ambulance
                  </Link>
                </>
              )}

              <button
                onClick={handleSignOut}
                className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-white border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login?role=driver"
                className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700 rounded-lg hover:bg-zinc-900 transition-colors"
              >
                Driver Portal
              </Link>
              <Link
                href="/auth/login"
                className="px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href={user ? dashboardHref : '/user/book'}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Book Ambulance
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

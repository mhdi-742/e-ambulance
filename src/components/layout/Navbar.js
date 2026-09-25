'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function Navbar() {
  const router = useRouter();
  const { user, profile } = useSession();
  const supabase = getSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="w-full h-16 border-b border-zinc-800 bg-zinc-950 fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
            EA
          </div>
          <span className="font-bold text-lg text-white tracking-tight">E-Ambulance</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          {user ? (
            <>
              {profile?.role === 'admin' && (
                <>
                  <Link href="/admin" className="text-zinc-300 hover:text-white">
                    Dashboard
                  </Link>
                  <Link href="/admin/bookings" className="text-zinc-300 hover:text-white">
                    Bookings
                  </Link>
                  <Link href="/admin/drivers" className="text-zinc-300 hover:text-white">
                    Drivers
                  </Link>
                  <Link href="/admin/hospitals" className="text-zinc-300 hover:text-white">
                    Hospitals
                  </Link>
                </>
              )}

              {profile?.role === 'driver' && (
                <>
                  <Link href="/driver" className="text-zinc-300 hover:text-white">
                    Console
                  </Link>
                  <Link href="/driver/history" className="text-zinc-300 hover:text-white">
                    Trip History
                  </Link>
                </>
              )}

              {(!profile || profile?.role === 'user') && (
                <>
                  <Link href="/user" className="text-zinc-300 hover:text-white">
                    My Trips
                  </Link>
                  <Link
                    href="/user/book"
                    className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
                  >
                    Book Ambulance
                  </Link>
                </>
              )}

              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-zinc-300 hover:text-white">
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

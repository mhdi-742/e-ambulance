'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';

export default function Navbar() {
  const router = useRouter();
  const { user, profile, signOut } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="w-full h-16 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand & Emergency SOS button */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-red-950">
              EA
            </div>
            <span className="font-bold text-lg text-white tracking-tight hidden xs:inline">
              E-Ambulance
            </span>
          </Link>

          {/* 3.16 FIX: SOS / Emergency Hotline Button */}
          <a
            href="tel:108"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-600 hover:text-white transition-all text-xs font-bold"
            title="Call National Emergency Ambulance Service (108)"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span>SOS 108</span>
          </a>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
          {user ? (
            <>
              {profile?.role === 'admin' && (
                <>
                  <Link href="/admin" className="text-zinc-300 hover:text-white transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/admin/bookings" className="text-zinc-300 hover:text-white transition-colors">
                    Bookings
                  </Link>
                  <Link href="/admin/drivers" className="text-zinc-300 hover:text-white transition-colors">
                    Drivers
                  </Link>
                  <Link href="/admin/hospitals" className="text-zinc-300 hover:text-white transition-colors">
                    Hospitals
                  </Link>
                </>
              )}

              {profile?.role === 'driver' && (
                <>
                  <Link href="/driver" className="text-zinc-300 hover:text-white transition-colors">
                    Console
                  </Link>
                  <Link href="/driver/history" className="text-zinc-300 hover:text-white transition-colors">
                    Trip History
                  </Link>
                </>
              )}

              {(!profile || profile?.role === 'user') && (
                <>
                  <Link href="/user" className="text-zinc-300 hover:text-white transition-colors">
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
              <Link href="/auth/login" className="text-zinc-300 hover:text-white transition-colors">
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

        {/* 6.1 FIX: Mobile Menu Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          {(!profile || profile?.role === 'user') && user && (
            <Link
              href="/user/book"
              className="px-2.5 py-1 text-xs rounded-lg bg-red-600 text-white font-bold"
            >
              Book
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* 6.1 FIX: Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 pt-3 pb-5 flex flex-col gap-3 text-sm font-medium">
          {user ? (
            <>
              {profile?.role === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    Admin Dashboard
                  </Link>
                  <Link
                    href="/admin/bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    All Bookings
                  </Link>
                  <Link
                    href="/admin/drivers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    Driver Fleet
                  </Link>
                  <Link
                    href="/admin/hospitals"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    Hospital Network
                  </Link>
                </>
              )}

              {profile?.role === 'driver' && (
                <>
                  <Link
                    href="/driver"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    Driver Console
                  </Link>
                  <Link
                    href="/driver/history"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    Trip History
                  </Link>
                </>
              )}

              {(!profile || profile?.role === 'user') && (
                <>
                  <Link
                    href="/user"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-300 hover:text-white py-1"
                  >
                    My Trips
                  </Link>
                  <Link
                    href="/user/book"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-red-400 font-bold py-1"
                  >
                    + Book Ambulance
                  </Link>
                </>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="text-left text-zinc-400 hover:text-white py-1.5 border-t border-zinc-800/80 mt-1"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-300 hover:text-white py-1"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setMobileMenuOpen(false)}
                className="text-red-400 font-bold py-1"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

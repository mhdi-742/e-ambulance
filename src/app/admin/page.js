'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import { useSession } from '@/hooks/useSession';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AdminDashboard() {
  const { loading: authLoading } = useSession();
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    onlineDrivers: 0,
    totalDrivers: 0,
    totalHospitals: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const fetchDashboard = async () => {
      const [bookingsRes, driversRes, hospitalsRes, onlineRes, activeRes, recentRes] =
        await Promise.all([
          supabase.from('bookings').select('id', { count: 'exact', head: true }),
          supabase.from('drivers').select('id', { count: 'exact', head: true }),
          supabase.from('hospitals').select('id', { count: 'exact', head: true }),
          supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('is_online', true),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending', 'accepted', 'en_route_pickup', 'arrived_pickup', 'en_route_hospital']),
          supabase
            .from('bookings')
            .select(`*, hospital:hospitals(name), driver:drivers(vehicle_number, profile:profiles(full_name)), user:profiles!bookings_user_id_fkey(full_name)`)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

      const completedRes = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');

      setStats({
        totalBookings: bookingsRes.count || 0,
        activeBookings: activeRes.count || 0,
        completedBookings: completedRes.count || 0,
        onlineDrivers: onlineRes.count || 0,
        totalDrivers: driversRes.count || 0,
        totalHospitals: hospitalsRes.count || 0,
      });

      setRecentBookings(recentRes.data || []);
      setLoading(false);
    };

    fetchDashboard();

    const interval = setInterval(() => {
      // 7.3 FIX: Pause polling when tab is in background to save resources
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboard();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []); // 12.3 FIX: Empty deps array prevents infinite effect re-trigger

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading admin console..." />
      </div>
    );
  }

  const statCards = [
    { label: 'Active Dispatches', value: stats.activeBookings },
    { label: 'Completed Trips', value: stats.completedBookings },
    { label: 'Total Bookings', value: stats.totalBookings },
    { label: 'Online Drivers', value: `${stats.onlineDrivers}/${stats.totalDrivers}` },
    { label: 'Network Hospitals', value: stats.totalHospitals },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-xs text-zinc-400">
              System overview &amp; live telemetry — auto-refreshes every 30s
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link
              href="/admin/bookings"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              All Bookings
            </Link>
            <Link
              href="/admin/drivers"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              Manage Drivers
            </Link>
            <Link
              href="/admin/hospitals"
              className="px-3.5 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:text-white"
            >
              Manage Hospitals
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900"
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Bookings Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Recent Ambulance Calls</h2>
            <Link href="/admin/bookings" className="text-xs text-red-400 hover:underline">
              View All →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-4">Patient</th>
                  <th className="p-4">Hospital Destination</th>
                  <th className="p-4">Assigned Driver</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-zinc-800/40">
                    <td className="p-4 font-medium text-white">{booking.user?.full_name || 'N/A'}</td>
                    <td className="p-4 text-zinc-300">{booking.hospital?.name || 'N/A'}</td>
                    <td className="p-4 text-zinc-300">{booking.driver?.profile?.full_name || '—'}</td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="p-4 text-zinc-500 font-mono">
                      {new Date(booking.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                      No ambulance dispatches logged yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

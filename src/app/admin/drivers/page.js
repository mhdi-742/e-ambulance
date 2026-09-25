'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const supabase = getSupabaseBrowserClient();

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('drivers')
      .select(`
        *,
        profile:profiles(full_name, email:id, phone, role)
      `)
      .order('created_at', { ascending: false });

    setDrivers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const toggleOnline = async (driverId, currentStatus) => {
    await supabase
      .from('drivers')
      .update({ is_online: !currentStatus })
      .eq('id', driverId);

    setToast({ message: `Driver status updated`, type: 'success' });
    fetchDrivers();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading drivers..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Ambulance Drivers</h1>
          <p className="text-xs text-zinc-400">
            {drivers.length} registered ambulance drivers and dispatch vehicles
          </p>
        </div>

        {drivers.length === 0 ? (
          <div className="text-center py-16 px-6 rounded-xl border border-zinc-800 bg-zinc-900">
            <p className="font-semibold text-white text-sm mb-1">No drivers registered</p>
            <p className="text-xs text-zinc-500">Drivers will appear here once registered.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-between flex-wrap gap-4"
              >
                <div>
                  <p className="font-bold text-white text-sm">
                    {driver.profile?.full_name || 'Driver'}
                  </p>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    {driver.vehicle_number} • <span className="uppercase text-red-400">{driver.vehicle_type}</span>
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Phone: {driver.profile?.phone || 'No phone'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      driver.is_online
                        ? 'border-emerald-600 bg-emerald-950 text-emerald-400'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {driver.is_online ? '● Online' : '○ Offline'}
                  </span>

                  {driver.is_busy && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 border border-amber-600 text-amber-400">
                      On Dispatch
                    </span>
                  )}

                  <button
                    onClick={() => toggleOnline(driver.id, driver.is_online)}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {driver.is_online ? 'Set Offline' : 'Set Online'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

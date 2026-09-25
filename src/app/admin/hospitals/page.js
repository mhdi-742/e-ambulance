'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Toast from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHospital, setNewHospital] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const fetchHospitals = async () => {
    const { data } = await supabase
      .from('hospitals')
      .select('*')
      .order('name');

    setHospitals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const addHospital = async () => {
    if (!newHospital.name || !newHospital.latitude || !newHospital.longitude) {
      setToast({ message: 'Name and coordinates are required', type: 'error' });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('hospitals').insert({
      name: newHospital.name,
      address: newHospital.address,
      latitude: parseFloat(newHospital.latitude),
      longitude: parseFloat(newHospital.longitude),
      is_active: true,
    });

    if (error) {
      setToast({ message: error.message, type: 'error' });
    } else {
      setToast({ message: 'Hospital added successfully', type: 'success' });
      setNewHospital({ name: '', address: '', latitude: '', longitude: '' });
      setShowAddModal(false);
      fetchHospitals();
    }
    setSaving(false);
  };

  const toggleActive = async (id, current) => {
    await supabase
      .from('hospitals')
      .update({ is_active: !current })
      .eq('id', id);

    setToast({ message: `Hospital ${!current ? 'activated' : 'deactivated'}`, type: 'success' });
    fetchHospitals();
  };

  const deleteHospital = async (id) => {
    await supabase.from('hospitals').delete().eq('id', id);
    setToast({ message: 'Hospital deleted', type: 'success' });
    fetchHospitals();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <LoadingSpinner size="lg" text="Loading hospitals..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Header & Add Button */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Manage Hospitals</h1>
            <p className="text-xs text-zinc-400">{hospitals.length} registered medical facilities</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            + Add Hospital
          </button>
        </div>

        {/* Hospital List Skeleton */}
        <div className="space-y-4">
          {hospitals.map((hospital) => (
            <div
              key={hospital.id}
              className={`p-5 rounded-xl border ${
                hospital.is_active
                  ? 'border-zinc-800 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-900/60 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg border border-zinc-800 bg-zinc-950 flex items-center justify-center font-bold text-xs text-red-400">
                    HOSP
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{hospital.name}</p>
                    <p className="text-xs text-zinc-400">{hospital.address || 'Address not specified'}</p>
                    <p className="text-xs text-zinc-500 font-mono mt-1">
                      Coordinates: {hospital.latitude?.toFixed(4)}, {hospital.longitude?.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(hospital.id, hospital.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      hospital.is_active
                        ? 'border-emerald-600 text-emerald-400 bg-emerald-950/40'
                        : 'border-zinc-700 text-zinc-400 bg-zinc-900'
                    }`}
                  >
                    {hospital.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => deleteHospital(hospital.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-800 text-red-400 hover:bg-red-950/40 cursor-pointer transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {hospitals.length === 0 && (
            <div className="p-12 text-center border border-zinc-800 bg-zinc-900 rounded-xl text-zinc-400 text-xs">
              No hospitals found. Click &quot;+ Add Hospital&quot; above to add one.
            </div>
          )}
        </div>

        {/* Add Hospital Modal */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add Hospital"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Hospital Name *
              </label>
              <input
                type="text"
                value={newHospital.name}
                onChange={(e) => setNewHospital((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Raiganj District Hospital"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={newHospital.address}
                onChange={(e) => setNewHospital((p) => ({ ...p, address: e.target.value }))}
                placeholder="Street address or landmark"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={newHospital.latitude}
                  onChange={(e) => setNewHospital((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder="25.6234"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  value={newHospital.longitude}
                  onChange={(e) => setNewHospital((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder="88.1289"
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-950 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <button
              onClick={addHospital}
              disabled={saving}
              className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50 cursor-pointer mt-2"
            >
              {saving ? <LoadingSpinner size="sm" text="" /> : 'Add Hospital'}
            </button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

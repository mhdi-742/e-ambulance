import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * HospitalModel
 * Handles all data operations and domain calculations for the `hospitals` table.
 */
export const HospitalModel = {
  /**
   * Fetch all active hospitals ordered by name (for patient booking).
   */
  async getActive() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .eq('is_active', true)
      .order('name');

    return { data: data || [], error };
  },

  /**
   * Fetch all hospitals ordered by name (for admin management).
   */
  async getAll() {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name');

    return { data: data || [], error };
  },

  /**
   * Count total hospitals in the database.
   */
  async getCount() {
    const supabase = getSupabaseBrowserClient();
    const { count, error } = await supabase
      .from('hospitals')
      .select('id', { count: 'exact', head: true });

    return { count: count || 0, error };
  },

  /**
   * Create a new hospital record.
   */
  async create({ name, address, latitude, longitude }) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('hospitals')
      .insert({
        name,
        address: address || '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        is_active: true,
      })
      .select()
      .single();

    return { data, error };
  },

  /**
   * Toggle a hospital's `is_active` status.
   */
  async toggleActive(hospitalId, currentActiveState) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('hospitals')
      .update({ is_active: !currentActiveState })
      .eq('id', hospitalId);

    return { error };
  },

  /**
   * Delete a hospital by ID.
   */
  async remove(hospitalId) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from('hospitals')
      .delete()
      .eq('id', hospitalId);

    return { error };
  },

  /**
   * Calculate Haversine distance (in km) between user coordinates and a hospital.
   */
  calculateDistanceKm(userLocation, hospital) {
    if (!userLocation || !hospital) return null;
    const hospLat = hospital.latitude ?? hospital.lat;
    const hospLng = hospital.longitude ?? hospital.lng;
    if (hospLat == null || hospLng == null) return null;

    const R = 6371; // Earth radius in km
    const dLat = (hospLat - userLocation.lat) * (Math.PI / 180);
    const dLng = (hospLng - userLocation.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.lat * (Math.PI / 180)) *
        Math.cos(hospLat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  },
};


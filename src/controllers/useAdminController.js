'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookingModel } from '@/models/BookingModel';
import { DriverModel } from '@/models/DriverModel';
import { HospitalModel } from '@/models/HospitalModel';
import { useSessionController } from './useAuthController';

/**
 * Controller Hook: Orchestrates the Admin Overview Dashboard (`/admin`).
 */
export function useAdminDashboardController() {
  const { loading: authLoading } = useSessionController();
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

  useEffect(() => {
    const fetchDashboard = async () => {
      const summary = await BookingModel.getAdminDashboardSummary();
      setStats(summary.stats);
      setRecentBookings(summary.recentBookings);
      setLoading(false);
    };

    fetchDashboard();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboard();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: 'Active Dispatches', value: stats.activeBookings },
    { label: 'Completed Trips', value: stats.completedBookings },
    { label: 'Total Bookings', value: stats.totalBookings },
    { label: 'Online Drivers', value: `${stats.onlineDrivers}/${stats.totalDrivers}` },
    { label: 'Network Hospitals', value: stats.totalHospitals },
  ];

  return {
    loading: authLoading || loading,
    statCards,
    recentBookings,
  };
}

/**
 * Controller Hook: Orchestrates the Admin Live Bookings page (`/admin/bookings`).
 */
export function useAdminBookingsController() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchBookings = useCallback(async () => {
    const { data } = await BookingModel.getAdminList({ filter, limit: 50 });
    setBookings(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    const unsubscribe = BookingModel.subscribeToAllBookings('admin-bookings-live', () => {
      fetchBookings();
    });

    return () => {
      unsubscribe();
    };
  }, [fetchBookings]);

  const filters = [
    { value: 'all', label: 'All Bookings' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Active Dispatch' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return {
    bookings,
    loading,
    filter,
    setFilter,
    filters,
  };
}

/**
 * Controller Hook: Orchestrates the Admin Driver Fleet Management page (`/admin/drivers`).
 */
export function useAdminDriversController() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchDrivers = useCallback(async () => {
    const { data } = await DriverModel.getAllWithProfiles();
    setDrivers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const toggleOnline = async (driverId, currentStatus) => {
    await DriverModel.setOnlineStatus(driverId, !currentStatus);
    setToast({ message: 'Driver status updated', type: 'success' });
    fetchDrivers();
  };

  return {
    drivers,
    loading,
    toast,
    setToast,
    toggleOnline,
  };
}

/**
 * Controller Hook: Orchestrates the Admin Hospital Network Management page (`/admin/hospitals`).
 */
export function useAdminHospitalsController() {
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

  const fetchHospitals = useCallback(async () => {
    const { data } = await HospitalModel.getAll();
    setHospitals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const addHospital = async () => {
    if (!newHospital.name || !newHospital.latitude || !newHospital.longitude) {
      setToast({ message: 'Name and coordinates are required', type: 'error' });
      return;
    }

    setSaving(true);
    const { error } = await HospitalModel.create(newHospital);

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
    await HospitalModel.toggleActive(id, current);
    setToast({
      message: `Hospital ${!current ? 'activated' : 'deactivated'}`,
      type: 'success',
    });
    fetchHospitals();
  };

  const deleteHospital = async (id) => {
    await HospitalModel.remove(id);
    setToast({ message: 'Hospital deleted', type: 'success' });
    fetchHospitals();
  };

  return {
    hospitals,
    loading,
    toast,
    setToast,
    showAddModal,
    setShowAddModal,
    newHospital,
    setNewHospital,
    saving,
    addHospital,
    toggleActive,
    deleteHospital,
  };
}


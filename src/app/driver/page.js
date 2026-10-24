'use client';

import { useDriverDashboardController } from '@/controllers/useDriverController';
import DriverDashboardView from '@/views/driver/DriverDashboardView';

export default function DriverDashboard() {
  const controller = useDriverDashboardController();
  return <DriverDashboardView {...controller} />;
}

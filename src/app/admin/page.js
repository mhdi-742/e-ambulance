'use client';

import { useAdminDashboardController } from '@/controllers/useAdminController';
import AdminDashboardView from '@/views/admin/AdminDashboardView';

export default function AdminDashboard() {
  const controller = useAdminDashboardController();
  return <AdminDashboardView {...controller} />;
}

'use client';

import { useAdminBookingsController } from '@/controllers/useAdminController';
import AdminBookingsView from '@/views/admin/AdminBookingsView';

export default function AdminBookingsPage() {
  const controller = useAdminBookingsController();
  return <AdminBookingsView {...controller} />;
}

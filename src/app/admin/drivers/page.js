'use client';

import { useAdminDriversController } from '@/controllers/useAdminController';
import AdminDriversView from '@/views/admin/AdminDriversView';

export default function AdminDriversPage() {
  const controller = useAdminDriversController();
  return <AdminDriversView {...controller} />;
}

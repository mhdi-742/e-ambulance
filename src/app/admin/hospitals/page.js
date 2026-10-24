'use client';

import { useAdminHospitalsController } from '@/controllers/useAdminController';
import AdminHospitalsView from '@/views/admin/AdminHospitalsView';

export default function AdminHospitalsPage() {
  const controller = useAdminHospitalsController();
  return <AdminHospitalsView {...controller} />;
}

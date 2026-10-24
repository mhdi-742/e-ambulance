'use client';

import { useDriverHistoryController } from '@/controllers/useDriverController';
import DriverHistoryView from '@/views/driver/DriverHistoryView';

export default function DriverHistoryPage() {
  const controller = useDriverHistoryController();
  return <DriverHistoryView {...controller} />;
}

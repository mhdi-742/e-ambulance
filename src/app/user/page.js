'use client';

import { useUserDashboardController } from '@/controllers/useUserController';
import UserDashboardView from '@/views/user/UserDashboardView';

export default function UserDashboard() {
  const controller = useUserDashboardController();
  return <UserDashboardView {...controller} />;
}

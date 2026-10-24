'use client';

import { useResetPasswordController } from '@/controllers/useAuthController';
import ResetPasswordView from '@/views/auth/ResetPasswordView';

export default function ResetPasswordPage() {
  const controller = useResetPasswordController();
  return <ResetPasswordView {...controller} />;
}

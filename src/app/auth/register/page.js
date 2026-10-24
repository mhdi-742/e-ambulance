'use client';

import { useRegisterController } from '@/controllers/useAuthController';
import RegisterView from '@/views/auth/RegisterView';

export default function RegisterPage() {
  const controller = useRegisterController();
  return <RegisterView {...controller} />;
}

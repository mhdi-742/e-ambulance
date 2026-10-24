'use client';

import { Suspense } from 'react';
import { useLoginController } from '@/controllers/useAuthController';
import LoginView, { LoginFormView } from '@/views/auth/LoginView';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function LoginContainer() {
  const controller = useLoginController();
  return <LoginFormView {...controller} />;
}

export default function LoginPage() {
  return (
    <LoginView>
      <Suspense fallback={<LoadingSpinner text="Loading..." />}>
        <LoginContainer />
      </Suspense>
    </LoginView>
  );
}

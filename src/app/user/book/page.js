'use client';

import { useBookAmbulanceController } from '@/controllers/useUserController';
import BookAmbulanceView from '@/views/user/BookAmbulanceView';

export default function BookAmbulancePage() {
  const controller = useBookAmbulanceController();
  return <BookAmbulanceView {...controller} />;
}

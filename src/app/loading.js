import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
      <LoadingSpinner size="lg" text="Loading E-Ambulance Dispatch..." />
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl border border-red-500/30 bg-red-950/20 text-red-500 flex items-center justify-center text-2xl font-bold mb-6">
        404
      </div>
      <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
      <p className="text-sm text-zinc-400 max-w-md mb-8">
        The route you are looking for does not exist or has been relocated.
        If this is an emergency, do not wait — call emergency services immediately.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link
          href="/"
          className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors"
        >
          Return to Home
        </Link>
        <a
          href="tel:108"
          className="px-6 py-2.5 rounded-lg border border-red-500/40 bg-red-950/40 hover:bg-red-950/70 text-red-200 font-semibold text-sm transition-colors"
        >
          Call Emergency 108
        </a>
      </div>
    </div>
  );
}

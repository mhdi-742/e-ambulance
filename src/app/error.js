'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl border border-red-500/30 bg-red-950/20 text-red-500 flex items-center justify-center text-xl font-bold mb-6">
        !
      </div>
      <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
      <p className="text-sm text-zinc-400 max-w-md mb-4">
        An unexpected error occurred while processing this dispatch screen.
      </p>
      {error?.message && (
        <pre className="text-xs font-mono text-zinc-500 max-w-md bg-zinc-900 border border-zinc-800 p-3 rounded-lg mb-8 overflow-x-auto text-left">
          {error.message}
        </pre>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors cursor-pointer"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-sm transition-colors"
        >
          Back to Home
        </Link>
        <a
          href="tel:108"
          className="px-6 py-2.5 rounded-lg border border-red-500/40 bg-red-950/40 hover:bg-red-950/70 text-red-200 font-semibold text-sm transition-colors"
        >
          Call 108
        </a>
      </div>
    </div>
  );
}

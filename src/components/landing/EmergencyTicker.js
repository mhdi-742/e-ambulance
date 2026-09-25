import Link from 'next/link';

export default function EmergencyTicker() {
  return (
    <div className="w-full h-10 border-b border-zinc-800 bg-zinc-950 text-xs text-zinc-400">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Dispatch Status */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-medium text-zinc-300">24/7 Raiganj Emergency Dispatch Active</span>
        </div>

        {/* Center: Average response time */}
        <div className="hidden md:flex items-center gap-2">
          <span>Average Pickup Time:</span>
          <span className="font-semibold text-zinc-200">&lt; 10 Minutes</span>
        </div>

        {/* Right: Direct emergency hotline link */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Toll Free:</span>
          <a
            href="tel:108"
            className="font-bold text-red-500 hover:text-red-400 underline underline-offset-2"
          >
            Call 108
          </a>
          <span className="text-zinc-600">|</span>
          <a
            href="tel:102"
            className="font-bold text-red-500 hover:text-red-400 underline underline-offset-2"
          >
            Call 102
          </a>
        </div>
      </div>
    </div>
  );
}

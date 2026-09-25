import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="w-full py-16 md:py-24 border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Headline, Description, and CTAs */}
          <div className="flex flex-col items-start gap-6">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Immediate Medical Assistance Available</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
              Fast Emergency Ambulance Dispatch in <span className="text-red-500">Raiganj</span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
              Connect directly with on-call ambulances and nearest hospitals in minutes. Real-time GPS tracking and 24/7 availability across Uttar Dinajpur.
            </p>

            {/* Action Buttons & Links */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <Link
                href="/user/book"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-center transition-colors"
              >
                Book Ambulance Now →
              </Link>

              <a
                href="tel:108"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-red-600/40 hover:bg-red-600/10 text-red-400 font-semibold text-center transition-colors"
              >
                Call Hotline: 108
              </a>

              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-900 text-zinc-300 font-medium text-center transition-colors text-sm"
              >
                Join as Ambulance Driver
              </Link>
            </div>

            {/* Trust Badges Skeleton */}
            <div className="pt-4 flex items-center gap-6 text-xs text-zinc-500">
              <div>✓ Verified Drivers</div>
              <div>✓ Zero Booking Surcharge</div>
              <div>✓ Direct Hospital Routing</div>
            </div>
          </div>

          {/* Right Column: Visual Skeleton Box (Width, Height, Alignment) */}
          <div className="w-full flex justify-center lg:justify-end">
            <div className="w-full max-w-md h-[420px] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col justify-between">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-white">Live Raiganj Fleet</span>
                </div>
                <span className="text-xs text-zinc-400 font-mono">GPS Active</span>
              </div>

              {/* Card Center: Radar Skeleton Box */}
              <div className="flex-1 my-4 rounded-xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="w-16 h-16 rounded-full border border-red-500 flex items-center justify-center text-xs text-red-400">
                  RADAR
                </div>
                <p className="text-sm font-medium text-zinc-300">Searching Nearest Vehicle</p>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Sudarshanpur, NH-34, Station Road &amp; College Para coverage
                </p>
              </div>

              {/* Card Footer: Quick Action Link */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-400">Nearest Unit: ~4 mins away</span>
                <Link
                  href="/user/book"
                  className="font-bold text-red-400 hover:text-red-300 underline"
                >
                  Request Dispatch →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

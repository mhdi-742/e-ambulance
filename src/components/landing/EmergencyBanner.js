import Link from 'next/link';

export default function EmergencyBanner() {
  return (
    <section id="emergency" className="w-full py-16 border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl border border-zinc-800 bg-zinc-900 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Left Text */}
          <div className="flex flex-col items-start gap-3 max-w-2xl text-center lg:text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">
              Immediate Critical Response
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Facing a Critical Medical Emergency?
            </h2>
            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
              Every second counts in cardiac arrest, stroke, trauma, and accidents. Call the direct emergency hotline or initiate instant digital dispatch.
            </p>
          </div>

          {/* Right Action Links */}
          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full sm:w-auto">
            <a
              href="tel:108"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-base text-center transition-colors"
            >
              📞 Call 108 Emergency
            </a>

            <Link
              href="/user/book"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-white font-bold text-base text-center transition-colors"
            >
              Online Dispatch →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

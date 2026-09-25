import Link from 'next/link';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Detect & Set Location',
      description: 'Open the app and your GPS location is auto-detected, or specify a pickup address in Raiganj.',
    },
    {
      num: '02',
      title: 'Instant Driver Match',
      description: 'The nearest available driver receives the dispatch request and accepts within seconds.',
    },
    {
      num: '03',
      title: 'Real-Time Track & Hospital Trip',
      description: 'Track the ambulance live on the map and proceed safely to your chosen destination hospital.',
    },
  ];

  return (
    <section id="how-it-works" className="w-full py-16 md:py-24 border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16 flex flex-col items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-red-500 uppercase">
            Simple 3-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How E-Ambulance Works
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Designed for high-stress emergencies with zero complicated setup.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {steps.map((step) => (
            <div
              key={step.num}
              className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex flex-col items-start gap-4 hover:border-zinc-700 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 text-red-500 font-extrabold text-lg flex items-center justify-center">
                {step.num}
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {step.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Link */}
        <div className="flex justify-center">
          <Link
            href="/user/book"
            className="px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm text-center transition-colors"
          >
            Request an Ambulance Now →
          </Link>
        </div>
      </div>
    </section>
  );
}

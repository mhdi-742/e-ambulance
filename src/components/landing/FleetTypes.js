import Link from 'next/link';

export default function FleetTypes() {
  const fleet = [
    {
      type: 'Basic Life Support (BLS)',
      badge: 'Most Common',
      description: 'Standard emergency ambulance equipped with oxygen cylinder, stretcher, and basic life saving kit.',
      features: ['Oxygen Cylinder & Mask', 'Foldable Patient Stretcher', 'Trained Emergency Driver', 'Basic First Aid Supplies'],
      ideal: 'Fractures, minor trauma, stable patient transport',
    },
    {
      type: 'Advanced Cardiac / ICU',
      badge: 'Critical Care',
      description: 'Intensive care unit on wheels with critical care life support and cardiac monitoring equipment.',
      features: ['Transport Ventilator', 'Multi-Para Cardiac Monitor', 'Suction Machine & Infusion Pump', 'Paramedic / EMT Support'],
      ideal: 'Cardiac arrest, respiratory distress, ICU transfers',
    },
    {
      type: 'Patient Transport Vehicle',
      badge: 'Scheduled',
      description: 'Comfortable transfer for patients requiring regular visits, dialysis, or discharge to home.',
      features: ['Wheelchair Accessibility', 'Comfortable Suspension', 'Companion Seating', 'Pre-Scheduled Booking'],
      ideal: 'Dialysis, routine clinic visits, hospital discharge',
    },
  ];

  return (
    <section id="fleet" className="w-full py-16 md:py-24 border-b border-zinc-800 bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16 flex flex-col items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-red-500 uppercase">
            Specialized Vehicles
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Our Ambulance Fleet
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Equipped to handle every level of medical urgency across Raiganj.
          </p>
        </div>

        {/* Fleet Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {fleet.map((item) => (
            <div
              key={item.type}
              className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                    {item.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                  {item.type}
                </h3>

                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                  {item.description}
                </p>

                <div className="space-y-2 mb-6 text-xs text-zinc-300">
                  <p className="font-semibold text-zinc-200">Key Equipment:</p>
                  {item.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">•</span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 mb-6">
                  <span className="font-semibold text-zinc-300">Best for: </span>
                  {item.ideal}
                </div>
              </div>

              <Link
                href="/user/book"
                className="w-full py-3 rounded-xl border border-red-600/40 hover:bg-red-600 hover:text-white text-red-400 font-semibold text-sm text-center transition-colors block"
              >
                Book This Type →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

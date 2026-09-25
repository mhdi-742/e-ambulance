import Link from 'next/link';

export default function HospitalNetwork() {
  const hospitals = [
    {
      name: 'Raiganj Govt. Medical College & Hospital',
      location: 'Sudarshanpur, Raiganj',
      type: 'Tertiary Care & Trauma',
      beds: '500+ Beds',
    },
    {
      name: 'Raiganj Sub-Divisional Hospital',
      location: 'Station Road, Raiganj',
      type: 'Emergency & General Care',
      beds: '150+ Beds',
    },
    {
      name: 'Uttar Dinajpur District Hospital',
      location: 'NH 34, Raiganj',
      type: 'District Referral Center',
      beds: '250+ Beds',
    },
    {
      name: 'Islampur Sub-District Hospital',
      location: 'Islampur, Uttar Dinajpur',
      type: 'Sub-District Emergency Care',
      beds: '100+ Beds',
    },
    {
      name: 'Lifeline Nursing Home',
      location: 'College Para, Raiganj',
      type: 'Private Multi-Specialty',
      beds: '60+ Beds',
    },
  ];

  return (
    <section id="hospitals" className="w-full py-16 md:py-24 border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-16 flex flex-col items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-red-500 uppercase">
            Connected Facilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Hospital Emergency Network
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base">
            Pre-configured direct routing to major trauma and emergency facilities in Raiganj.
          </p>
        </div>

        {/* Hospitals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {hospitals.map((hospital) => (
            <div
              key={hospital.name}
              className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {hospital.beds}
                  </span>
                  <span className="text-xs text-red-400 font-medium">24/7 Casualty</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 tracking-tight">
                  {hospital.name}
                </h3>
                <p className="text-xs text-zinc-400 mb-2">
                  📍 {hospital.location}
                </p>
                <p className="text-xs text-zinc-500">
                  {hospital.type}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">● Receiving Ambulances</span>
                <Link
                  href="/user/book"
                  className="font-bold text-red-400 hover:text-red-300 underline"
                >
                  Direct Trip →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="text-center text-xs text-zinc-500">
          Need a specific clinic or private doctor not listed? You can enter custom addresses during booking.
        </div>
      </div>
    </section>
  );
}

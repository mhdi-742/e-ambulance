export default function MetricsStrip() {
  const metrics = [
    { value: '< 10 Mins', label: 'Average Response Time', sublabel: 'Fastest in Raiganj' },
    { value: '25+', label: 'Registered Ambulances', sublabel: 'Basic, Oxygen & ICU' },
    { value: '5+', label: 'Network Hospitals', sublabel: 'Govt. & Private Care' },
    { value: '24/7/365', label: 'Emergency Support', sublabel: 'Zero Downtime' },
  ];

  return (
    <section className="w-full py-10 border-b border-zinc-800 bg-zinc-950/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex flex-col items-center justify-center text-center gap-1.5"
            >
              <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {metric.value}
              </span>
              <span className="text-sm font-semibold text-zinc-300">
                {metric.label}
              </span>
              <span className="text-xs text-zinc-500">
                {metric.sublabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DispatchRadar() {
  return (
    <div className="w-full h-72 sm:h-80 rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full border border-red-500/40 flex items-center justify-center mb-4">
        <div className="w-3 h-3 rounded-full bg-red-500" />
      </div>
      <p className="text-sm font-bold text-white mb-1">Raiganj GPS Dispatch Radar</p>
      <p className="text-xs text-zinc-400 max-w-xs">
        Real-time telemetry showing nearest ambulances and hospital emergency gates.
      </p>
    </div>
  );
}

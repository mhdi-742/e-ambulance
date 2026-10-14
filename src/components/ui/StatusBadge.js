export default function StatusBadge({ status }) {
  const getBadgeConfig = (s) => {
    switch (s) {
      case 'completed':
        return {
          dot: 'bg-emerald-500',
          badge: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
        };
      case 'cancelled':
        return {
          dot: 'bg-zinc-500',
          badge: 'border-zinc-800 bg-zinc-900/70 text-zinc-400',
        };
      case 'pending':
        return {
          dot: 'bg-amber-500 animate-pulse',
          badge: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
        };
      case 'accepted':
      case 'en_route_pickup':
      case 'arrived_pickup':
      case 'en_route_hospital':
        return {
          dot: 'bg-blue-500 animate-pulse',
          badge: 'border-blue-800/60 bg-blue-950/40 text-blue-300',
        };
      default:
        return {
          dot: 'bg-zinc-400',
          badge: 'border-zinc-700 bg-zinc-900 text-zinc-200',
        };
    }
  };

  const { dot, badge } = getBadgeConfig(status);

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="capitalize">{status ? status.replace(/_/g, ' ') : 'Pending'}</span>
    </span>
  );
}

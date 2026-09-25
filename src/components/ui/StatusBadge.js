export default function StatusBadge({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-zinc-700 bg-zinc-900 text-zinc-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      <span className="capitalize">{status ? status.replace(/_/g, ' ') : 'Pending'}</span>
    </span>
  );
}

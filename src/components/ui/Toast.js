export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-white flex items-center gap-3">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
          ✕
        </button>
      )}
    </div>
  );
}

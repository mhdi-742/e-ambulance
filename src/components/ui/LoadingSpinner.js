export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const dim = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4">
      <div className={`${dim} rounded-full border-2 border-zinc-600 border-t-red-500 animate-spin`} />
      {text && <span className="text-xs text-zinc-400">{text}</span>}
    </div>
  );
}

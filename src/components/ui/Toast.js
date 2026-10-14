'use client';

import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const colorStyles = {
    error: 'border-red-500/50 bg-red-950/90 text-red-100 shadow-red-950/50',
    success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-100 shadow-emerald-950/50',
    info: 'border-zinc-700 bg-zinc-900 text-white shadow-black/50',
    warning: 'border-amber-500/50 bg-amber-950/90 text-amber-100 shadow-amber-950/50',
  };

  const badgeColors = {
    error: 'bg-red-500',
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
  };

  const style = colorStyles[type] || colorStyles.info;
  const dotColor = badgeColors[type] || badgeColors.info;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 p-4 max-w-sm rounded-xl border backdrop-blur-md shadow-xl text-sm flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${style}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <span className="flex-1 font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer text-base px-1"
          aria-label="Close notification"
        >
          ✕
        </button>
      )}
    </div>
  );
}

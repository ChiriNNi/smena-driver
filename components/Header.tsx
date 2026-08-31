'use client';

type Props = {
  isAdmin: boolean;
  progress: number; // 0..100
  onLockClick: () => void;
};

export default function Header({ isAdmin, progress, onLockClick }: Props) {
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-[0.2em] text-amber-400">OVI</span>
        <span className="hidden text-xs text-neutral-500 sm:inline">Смена водителя</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
        <button
          onClick={onLockClick}
          className={
            'rounded-md border px-3 py-1.5 text-xs font-medium transition ' +
            (isAdmin
              ? 'border-amber-500 bg-amber-500/10 text-amber-400'
              : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200')
          }
        >
          🔒 {isAdmin ? 'Админ' : 'Просмотр'}
        </button>
      </div>
    </header>
  );
}

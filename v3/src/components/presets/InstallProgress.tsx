import type { ProgressEvent } from "../../ipc/install";

interface Props {
  progress: ProgressEvent | null;
}

export default function InstallProgress({ progress }: Props) {
  if (!progress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-app-panel border border-app-border rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        <p className="text-sm font-semibold text-center select-none">{progress.label}</p>
        <div className="w-full bg-app-border rounded-full h-2 overflow-hidden">
          <div
            className="h-2 rounded-full bg-brand-accent transition-all duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-xs text-center opacity-60 select-none tabular-nums">
          {progress.step} / {progress.total}
        </p>
      </div>
    </div>
  );
}

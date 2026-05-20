import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import {
  detectGpu,
  estimateFps,
  getBenchmarks,
  addBenchmark,
  type GpuInfo,
  type FpsEstimate,
  type BenchmarkEntry,
} from "../../ipc/benchmarks";
import { useAppStore } from "../../store/appStore";

const TIER_COLOR: Record<string, string> = {
  High: "text-green-400",
  Medium: "text-yellow-400",
  Low: "text-red-400",
  Unknown: "text-app-muted",
};

export default function BenchmarkPanel() {
  const { t } = useTranslation();
  const { presets } = useAppStore();
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [estimate, setEstimate] = useState<FpsEstimate | null>(null);
  const [entries, setEntries] = useState<BenchmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedPreset, setSelectedPreset] = useState("");
  const [fpsInput, setFpsInput] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([detectGpu(), getBenchmarks()])
      .then(([g, b]) => {
        setGpu(g);
        setEntries(b);
        return estimateFps(g.name);
      })
      .then(setEstimate)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRecord = async () => {
    if (!selectedPreset || !fpsInput) return;
    const preset = presets.find((p) => p.uuid === selectedPreset);
    if (!preset) return;
    setSaving(true);
    try {
      await addBenchmark(selectedPreset, preset.name, parseFloat(fpsInput), mcVersion || "unknown");
      const updated = await getBenchmarks();
      setEntries(updated);
      setFpsInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm opacity-60 py-2">{t("bench_detecting_gpu")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* GPU info + estimate */}
      {gpu && (
        <div className="flex items-center justify-between text-sm bg-app-bg border border-app-border rounded-md px-3 py-2">
          <div>
            <p className="font-medium">{gpu.name || t("bench_unknown_gpu")}</p>
            <p className="text-xs opacity-60">{gpu.tierLabel}{gpu.vramMb ? ` · ${gpu.vramMb} MB VRAM` : ""}</p>
          </div>
          {estimate && estimate.minFps > 0 && (
            <div className="text-right">
              <p className={`font-semibold ${TIER_COLOR[estimate.tier]}`}>
                {estimate.minFps}–{estimate.maxFps} FPS
              </p>
              <p className="text-xs opacity-60">{t("bench_rtx_estimate")}</p>
            </div>
          )}
        </div>
      )}
      {estimate && (
        <p className="text-xs opacity-60">{estimate.note}</p>
      )}

      {/* Record FPS form */}
      <div className="border border-app-border rounded-md p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("bench_record_fps")}</p>
        <div className="flex gap-2">
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm bg-app-panel border border-app-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-accent"
          >
            <option value="">{t("bench_preset_placeholder")}</option>
            {presets.map((p) => (
              <option key={p.uuid} value={p.uuid}>{p.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={999}
            placeholder="FPS"
            value={fpsInput}
            onChange={(e) => setFpsInput(e.target.value)}
            className="w-20 px-2 py-1.5 text-sm bg-app-panel border border-app-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
          <input
            type="text"
            placeholder={t("bench_mc_version")}
            value={mcVersion}
            onChange={(e) => setMcVersion(e.target.value)}
            className="w-28 px-2 py-1.5 text-sm bg-app-panel border border-app-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-accent"
          />
          <Button
            theme="primary"
            size="md"
            disabled={!selectedPreset || !fpsInput || saving}
            onClick={handleRecord}
          >
            {saving ? t("bench_saving") : t("bench_save")}
          </Button>
        </div>
      </div>

      {/* Saved entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{t("bench_recorded")}</p>
          {entries.map((e) => (
            <div
              key={`${e.presetUuid}-${e.recordedAt}`}
              className="flex items-center justify-between text-xs bg-app-bg border border-app-border rounded px-2 py-1"
            >
              <span className="truncate flex-1 mr-2">{e.presetName}</span>
              <span className="opacity-60 mr-2 truncate max-w-[12ch]">{e.gpuName.split(" ").slice(-2).join(" ")}</span>
              <span className="font-semibold tabular-nums">{Math.round(e.fpsAvg)} FPS</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

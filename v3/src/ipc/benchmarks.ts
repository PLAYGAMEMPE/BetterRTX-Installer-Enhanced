import { invoke } from '@tauri-apps/api/core';

export type GpuTier = 'High' | 'Medium' | 'Low' | 'Unknown';

export interface GpuInfo {
  name: string;
  tier: GpuTier;
  vramMb: number | null;
  tierLabel: string;
}

export interface FpsEstimate {
  tier: GpuTier;
  minFps: number;
  maxFps: number;
  confidence: string;
  note: string;
}

export interface BenchmarkEntry {
  presetUuid: string;
  presetName: string;
  gpuName: string;
  fpsAvg: number;
  mcVersion: string;
  recordedAt: string;
}

export function detectGpu(): Promise<GpuInfo> {
  return invoke<GpuInfo>('detect_gpu');
}

export function estimateFps(gpuName: string): Promise<FpsEstimate> {
  return invoke<FpsEstimate>('estimate_fps', { gpuName });
}

export function getBenchmarks(): Promise<BenchmarkEntry[]> {
  return invoke<BenchmarkEntry[]>('get_benchmarks');
}

export function addBenchmark(
  presetUuid: string,
  presetName: string,
  fpsAvg: number,
  mcVersion: string,
): Promise<void> {
  return invoke<void>('add_benchmark', { presetUuid, presetName, fpsAvg, mcVersion });
}

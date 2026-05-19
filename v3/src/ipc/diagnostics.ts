import { invoke } from '@tauri-apps/api/core';

export type CompatStatus = 'Ok' | 'Warning' | 'Blocked';

export interface CompatReport {
  status: CompatStatus;
  warnings: string[];
  blockers: string[];
  canProceed: boolean;
}

export interface DiagnosticsReport {
  installLocation: string;
  installKind: string;
  materialsDir: string;
  materialsDirExists: boolean;
  directlyWritable: boolean;
  indexJsonPresent: boolean;
  indexJsonValid: boolean;
  recommendedProvider: string;
  providerConfidence: string;
  externalUnlockers: string[];
  backupCount: number;
  rtxFilesPresent: string[];
  betterrtxRedirectActive: boolean;
  notes: string[];
}

export function checkCompatibility(installLocation: string): Promise<CompatReport> {
  return invoke<CompatReport>('check_compatibility', { installLocation });
}

export function runDiagnostics(installLocation: string): Promise<DiagnosticsReport> {
  return invoke<DiagnosticsReport>('run_diagnostics', { installLocation });
}

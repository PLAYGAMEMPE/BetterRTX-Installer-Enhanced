import { invoke } from '@tauri-apps/api/core';

export interface MigrationStatus {
  migrationNeeded: boolean;
  installedMcVersion: string | null;
  currentMcVersion: string | null;
  installedPresetUuid: string | null;
  installLocation: string;
  notes: string[];
}

export function checkMigrationNeeded(installLocation: string): Promise<MigrationStatus> {
  return invoke<MigrationStatus>('check_migration_needed', { installLocation });
}

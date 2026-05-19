/**
 * Wrappers tipados para los comandos del motor de instalacion modular (Fase 1).
 * Todos los tipos reflejan exactamente las estructuras Rust serializadas con serde.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// ── Tipos de datos ─────────────────────────────────────────────────────────

export type InstallMechanism = "indexRedirect" | "directOverwrite";

export type Confidence = "None" | "Low" | "High";

export interface InstallPlan {
  installLocation: string;
  materialsDir: string;
  mechanism: InstallMechanism;
  provider: string;
  providerConfidence: Confidence;
  backupRequired: boolean;
  notes: string[];
}

export interface BackupFile {
  name: string;
  sha256: string;
  size: number;
}

export interface BackupManifest {
  sessionId: string;
  createdAt: string;
  installLocation: string;
  mechanism: string;
  files: BackupFile[];
}

export interface BackupEntry {
  sessionId: string;
  createdAt: string;
  backupDir: string;
  mechanism: string;
  fileCount: number;
}

// ── Tipos de eventos ───────────────────────────────────────────────────────

export interface ProgressEvent {
  step: number;
  total: number;
  label: string;
  percent: number;
}

export interface LogEvent {
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export interface RollbackEvent {
  reason: string;
}

// ── Comandos Tauri ─────────────────────────────────────────────────────────

/** Calcula el plan de instalacion sin modificar ningun archivo. */
export async function planInstall(installLocation: string): Promise<InstallPlan> {
  return invoke("plan_install", { installLocation });
}

/**
 * Instala un preset usando el motor hibrido modular.
 * Emite eventos de progreso en tiempo real durante la operacion.
 */
export async function installPreset(
  installLocation: string,
  presetUuid: string
): Promise<void> {
  return invoke("install_preset", { installLocation, presetUuid });
}

/** Lista los backups disponibles para una instalacion. */
export async function listBackups(installLocation: string): Promise<BackupEntry[]> {
  return invoke("list_backups", { installLocation });
}

/** Restaura la instalacion a vanilla desde el backup mas reciente. */
export async function restoreVanilla(installLocation: string): Promise<BackupManifest> {
  return invoke("restore_vanilla", { installLocation });
}

// ── Suscripciones a eventos ────────────────────────────────────────────────

/** Escucha el evento de progreso de instalacion. Devuelve la funcion para desuscribirse. */
export function onInstallProgress(handler: (ev: ProgressEvent) => void): Promise<UnlistenFn> {
  return listen<ProgressEvent>("install://progress", (event) => handler(event.payload));
}

/** Escucha el evento de log estructurado de instalacion. */
export function onInstallLog(handler: (ev: LogEvent) => void): Promise<UnlistenFn> {
  return listen<LogEvent>("install://log", (event) => handler(event.payload));
}

/** Escucha el evento de rollback (instalacion revertida por error). */
export function onInstallRollback(handler: (ev: RollbackEvent) => void): Promise<UnlistenFn> {
  return listen<RollbackEvent>("install://rollback", (event) => handler(event.payload));
}

/**
 * Suscribe los tres eventos de instalacion a la vez.
 * Devuelve una funcion que cancela todas las suscripciones.
 */
export async function subscribeToInstallEvents(handlers: {
  onProgress?: (ev: ProgressEvent) => void;
  onLog?: (ev: LogEvent) => void;
  onRollback?: (ev: RollbackEvent) => void;
}): Promise<() => void> {
  const unlisteners: UnlistenFn[] = await Promise.all([
    handlers.onProgress ? onInstallProgress(handlers.onProgress) : Promise.resolve(() => {}),
    handlers.onLog ? onInstallLog(handlers.onLog) : Promise.resolve(() => {}),
    handlers.onRollback ? onInstallRollback(handlers.onRollback) : Promise.resolve(() => {}),
  ]);
  return () => unlisteners.forEach((fn) => fn());
}

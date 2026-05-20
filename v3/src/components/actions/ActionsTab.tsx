import { useAppStore } from "../../store/appStore";
import { useStatusStore } from "../../store/statusStore";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import Button from "../ui/Button";
import SelectInstallationsDialog from "../SelectInstallationsDialog";
import { CheckCircle } from "lucide-react";
import { OptionsDialog } from "../OptionsDialog";
import { runDiagnostics, analyzeCrashes, type DiagnosticsReport, type CrashEvent } from "../../ipc/diagnostics";
import BenchmarkPanel from "../benchmarks/BenchmarkPanel";

type ModalType = "dlss" | "update" | "backup" | "uninstall" | "restore";

export default function ActionsTab() {
  const { t } = useTranslation();
  const { addMessage } = useStatusStore();
  const {
    installRTX,
    updateOptions,
    backupSupportFiles,
    uninstallRTX,
    installations,
  } = useAppStore();
  const [isProtocolRegistered, setIsProtocolRegistered] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ModalType | null>(null);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [diagInstall, setDiagInstall] = useState("");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagReport, setDiagReport] = useState<DiagnosticsReport | null>(null);
  const [crashInstall, setCrashInstall] = useState("");
  const [crashLoading, setCrashLoading] = useState(false);
  const [crashEvents, setCrashEvents] = useState<CrashEvent[]>([]);


  const openSelectDialog = (type: ModalType): void => {
    setActionType(type);
    setActionDialogOpen(true);
  };

  const closeSelectDialog = (): void => {
    setActionDialogOpen(false);
    setActionType(null);
  };

  const handleActionConfirm = async (paths: string[]): Promise<boolean> => {
    if (!actionType) return false;

    try {
      switch (actionType) {
        case "dlss":
          await Promise.all(paths.map(path => installRTX(path)));
          addMessage({ message: t("actions.dlss.success"), type: "success" });
          break;
        case "update":
          await Promise.all(paths.map(path => updateOptions(path)));
          addMessage({ message: t("actions.update.success"), type: "success" });
          break;
        case "backup":
          await Promise.all(paths.map(path => backupSupportFiles(path)));
          addMessage({ message: t("actions.backup.success"), type: "success" });
          break;
        case "uninstall":
          await uninstallRTX(paths);
          addMessage({ message: t("actions.uninstall.success"), type: "success" });
          break;
        case "restore":
          await Promise.all(paths.map(path =>
            invoke("restore_vanilla", { installLocation: path })
          ));
          addMessage({ message: t("actions.restore.success", "Vanilla materials restored successfully"), type: "success" });
          break;
      }
      return true;
    } catch (error) {
      addMessage({
        message: t(`actions.${actionType}.error`, {
          error: error instanceof Error ? error.message : String(error),
        }),
        type: "error"
      });
      return false;
    }
  };

  const handleRunDiagnostics = async () => {
    if (!diagInstall) return;
    setDiagLoading(true);
    setDiagReport(null);
    try {
      const report = await runDiagnostics(diagInstall);
      setDiagReport(report);
    } catch (error) {
      addMessage({ message: String(error), type: "error" });
    } finally {
      setDiagLoading(false);
    }
  };

  const handleRunCrashAnalyzer = async () => {
    if (!crashInstall) return;
    setCrashLoading(true);
    setCrashEvents([]);
    try {
      const events = await analyzeCrashes(crashInstall);
      setCrashEvents(events);
    } catch (error) {
      addMessage({ message: String(error), type: "error" });
    } finally {
      setCrashLoading(false);
    }
  };

  const checkProtocolStatus = async () => {
    try {
      const registered = await invoke<boolean>("is_brtx_protocol_registered");
      setIsProtocolRegistered(registered);
    } catch (error) {
      console.error("Failed to check protocol status:", error);
    }
  };

  const handleProtocolToggle = async (checked: boolean) => {
    if (checked) {
      try {
        await invoke("register_brtx_protocol");
        setIsProtocolRegistered(true);
        addMessage({
          message: t("status_register_protocol_success"),
          type: "success",
        });
      } catch (error) {
        addMessage({
          message: t("status_register_protocol_error", { error: String(error) }),
          type: "error",
        });
      }
    }
    // Note: We don't handle unregistration as it's typically not needed
  };

  useEffect(() => {
    checkProtocolStatus();
  }, []);

  return (
    <section className="actions-container">
      <div className="section-toolbar mb-4">
        <h2 className="text-lg font-semibold select-none cursor-default">{t("actions_title")}</h2>
      </div>
      <div className="actions-grid flex flex-col">
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">
                {t("action_install_dlss_title")}
              </h3>
              <p className="text-sm opacity-75 select-none cursor-default">{t("action_install_dlss_desc")}</p>
            </div>
            <div className="ml-4">
              <Button
                theme="primary"
                size="md"
                onClick={() => openSelectDialog("dlss")}
              >
                {t("install")}
              </Button>
            </div>
          </div>
        </div>
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">
                {t("action_graphics_options_title", "Graphics Options Editor")}
              </h3>
              <p className="text-sm opacity-75 select-none cursor-default">
                {t("action_graphics_options_desc", "Edit Minecraft graphics settings directly from options.txt")}
              </p>
            </div>
            <div className="ml-4">
              <Button
                theme="primary"
                size="md"
                onClick={() => setOptionsDialogOpen(true)}
              >
                {t("edit_options", "Edit Options")}
              </Button>
            </div>
          </div>
        </div>

        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">{t("action_backup_title")}</h3>
              <p className="text-sm opacity-75 select-none cursor-default">{t("action_backup_desc")}</p>
            </div>
            <div className="ml-4">
              <Button
                theme="primary"
                size="md"
                onClick={() => openSelectDialog("backup")}
              >
                {t("backup")}
              </Button>
            </div>
          </div>
        </div>
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">{t("action_uninstall_title")}</h3>
              <p className="text-sm opacity-75 select-none cursor-default">{t("action_uninstall_desc")}</p>
            </div>
            <div className="ml-4">
              <Button
                theme="secondary"
                size="md"
                onClick={() => openSelectDialog("uninstall")}
              >
                {t("uninstall")}
              </Button>
            </div>
          </div>
        </div>
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">{t("action_register_protocol_title")}</h3>
              <p className="text-sm opacity-75 select-none cursor-default">
                {t("action_register_protocol_desc")}
              </p>
            </div>
            <div className="ml-4">
              <Button
                theme="secondary"
                size="md"
                disabled={isProtocolRegistered}
                onClick={() => handleProtocolToggle(true)}
              >
                {isProtocolRegistered ? <CheckCircle /> : t("register")}
              </Button>
            </div>
          </div>
        </div>

        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col flex-grow-1 w-full">
              <h3 className="font-semibold mb-2 select-none cursor-default">{t("action_restore_vanilla_title", "Restore Vanilla Materials")}</h3>
              <p className="text-sm opacity-75 select-none cursor-default">{t("action_restore_vanilla_desc", "Roll back RTX files to their original Minecraft state using the last verified backup.")}</p>
            </div>
            <div className="ml-4">
              <Button theme="secondary" size="md" onClick={() => openSelectDialog("restore")}>
                {t("restore", "Restore")}
              </Button>
            </div>
          </div>
        </div>

        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <h3 className="font-semibold mb-3 select-none cursor-default">{t("action_diagnostics_title", "Diagnostics")}</h3>
          <div className="flex gap-2 mb-3">
            <select
              value={diagInstall}
              onChange={(e) => setDiagInstall(e.target.value)}
              className="flex-1 px-3 py-2 bg-app-panel border border-app-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="">{t("diag_select_install", "Select installation…")}</option>
              {installations.map((ins) => (
                <option key={ins.InstallLocation} value={ins.InstallLocation}>{ins.FriendlyName}</option>
              ))}
            </select>
            <Button theme="primary" size="md" disabled={!diagInstall || diagLoading} onClick={handleRunDiagnostics}>
              {diagLoading ? t("diag_running", "Running…") : t("diag_run", "Run")}
            </Button>
          </div>
          {diagReport && (
            <div className="text-xs bg-app-bg border border-app-border rounded-md p-3 space-y-1 max-h-52 overflow-y-auto">
              <div className="flex justify-between"><span className="opacity-60">{t("diag_kind")}</span><span>{diagReport.installKind}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_provider")}</span><span>{diagReport.recommendedProvider}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_writable")}</span><span>{diagReport.directlyWritable ? t("diag_yes") : t("diag_no")}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_index_json")}</span><span>{diagReport.indexJsonPresent ? (diagReport.indexJsonValid ? t("diag_valid") : t("diag_invalid")) : t("diag_missing")}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_redirect_active")}</span><span>{diagReport.betterrtxRedirectActive ? t("diag_yes") : t("diag_no")}</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_rtx_files")}</span><span>{diagReport.rtxFilesPresent.length}/3</span></div>
              <div className="flex justify-between"><span className="opacity-60">{t("diag_backups")}</span><span>{diagReport.backupCount}</span></div>
              {diagReport.notes.length > 0 && (
                <div className="pt-1 border-t border-app-border">
                  {diagReport.notes.map((n) => <p key={n} className="opacity-75">{n}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crash Analyzer */}
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <h3 className="font-semibold mb-3 select-none cursor-default">{t("action_crash_analyzer_title", "Crash Analyzer")}</h3>
          <p className="text-sm opacity-75 mb-3 select-none">{t("action_crash_analyzer_desc", "Scan Windows Event Log for Minecraft crashes and correlate with BetterRTX installations.")}</p>
          <div className="flex gap-2 mb-3">
            <select
              value={crashInstall}
              onChange={(e) => setCrashInstall(e.target.value)}
              className="flex-1 px-3 py-2 bg-app-panel border border-app-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="">{t("diag_select_install", "Select installation…")}</option>
              {installations.map((ins) => (
                <option key={ins.InstallLocation} value={ins.InstallLocation}>{ins.FriendlyName}</option>
              ))}
            </select>
            <Button theme="primary" size="md" disabled={!crashInstall || crashLoading} onClick={handleRunCrashAnalyzer}>
              {crashLoading ? t("analyzing", "Analyzing…") : t("analyze", "Analyze")}
            </Button>
          </div>
          {crashEvents.length === 0 && !crashLoading && crashInstall && (
            <p className="text-xs opacity-60">{t("crash_none_found", "No Minecraft crashes found in the last 7 days.")}</p>
          )}
          {crashEvents.length > 0 && (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {crashEvents.map((ev) => (
                <div
                  key={`${ev.timestamp}-${ev.eventId}`}
                  className={`text-xs rounded-md p-2 border ${ev.possiblyBrtxRelated ? "border-yellow-500/40 bg-yellow-500/10" : "border-app-border bg-app-bg"}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono opacity-60">{new Date(ev.timestamp).toLocaleString()}</span>
                    {ev.possiblyBrtxRelated && (
                      <span className="text-yellow-400 font-medium">{t("diag_possibly_brtx")}</span>
                    )}
                  </div>
                  <p className="opacity-75 truncate">{ev.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Benchmarks & FPS Estimator */}
        <div className="action-btn p-4 rounded-lg border bg-app-panel border-app-border w-full">
          <h3 className="font-semibold mb-3 select-none cursor-default">{t("action_benchmarks_title", "Benchmarks & FPS Estimator")}</h3>
          <BenchmarkPanel />
        </div>

      </div>
      <SelectInstallationsDialog
        isOpen={actionDialogOpen}
        onClose={closeSelectDialog}
        title={
          actionType === "dlss" ? t("dialog_install_dlss_title", "Install DLSS")
          : actionType === "update" ? t("dialog_update_options_title", "Update Options")
          : actionType === "backup" ? t("dialog_backup_title", "Backup Selected")
          : actionType === "restore" ? t("dialog_restore_title", "Restore Vanilla")
          : actionType === "uninstall" ? t("dialog_uninstall_title", "Uninstall RTX")
          : ""
        }
        description={
          actionType === "dlss" ? t("dialog_install_dlss_desc", "Select which Minecraft instances to install DLSS to")
          : actionType === "update" ? t("dialog_update_options_desc", "Select which Minecraft instances to update options for")
          : actionType === "backup" ? t("dialog_backup_desc", "Select which Minecraft instances to back up")
          : actionType === "restore" ? t("dialog_restore_desc", "Select which Minecraft instances to restore to vanilla materials")
          : actionType === "uninstall" ? t("dialog_uninstall_desc", "Select which Minecraft instances to restore original materials to")
          : undefined
        }
        confirmKey={
          actionType === "dlss" ? "install_to_selected"
          : actionType === "update" ? "update_to_selected"
          : actionType === "backup" ? "backup_to_selected"
          : actionType === "restore" ? "restore_to_selected"
          : "uninstall_to_selected"
        }
        busyKey={
          actionType === "dlss" ? "installing"
          : actionType === "update" ? "updating_options"
          : actionType === "backup" ? "backing_up"
          : actionType === "restore" ? "restoring"
          : "uninstalling"
        }
        onConfirm={handleActionConfirm}
      />
      <OptionsDialog
        isOpen={optionsDialogOpen}
        onClose={() => setOptionsDialogOpen(false)}
      />
    </section>
  );
}

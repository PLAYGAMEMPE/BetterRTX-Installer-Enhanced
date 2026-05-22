import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { cx } from "classix";
import Button from "../ui/Button";
import { CheckCircle, AlertCircle } from "lucide-react";

interface IoBitStatus {
    installed: boolean;
    path: string | null;
    version: string | null;
}

interface IoBitProgress {
    stage: string;
    percent: number | null;
    label: string;
}

type InstallPhase =
    | "idle"
    | "resolving"
    | "downloading"
    | "saving"
    | "installing"
    | "detecting"
    | "uninstalling"
    | "error";

const ACTIVE_PHASES = new Set<InstallPhase>([
    "resolving", "downloading", "saving", "installing", "detecting", "uninstalling",
]);

export default function IoBitPanel() {
    const { t } = useTranslation();
    const { iobitPath, setIobitPath, refreshIobitPath, selectIobitPath } = useAppStore();

    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<InstallPhase>("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [version, setVersion] = useState<string | null>(null);
    const [progressPercent, setProgressPercent] = useState<number | null>(null);
    const [progressLabel, setProgressLabel] = useState<string>("");

    const isFound = iobitPath !== null && iobitPath !== "";
    const isActive = ACTIVE_PHASES.has(phase);
    const canInstall = !isFound && !isActive;
    const canUninstall = isFound && !isActive;

    // Cargar estado completo al montar
    useEffect(() => {
        invoke<IoBitStatus>("get_iobit_status")
            .then((s) => {
                setIobitPath(s.path ?? null);
                setVersion(s.version ?? null);
            })
            .catch(console.error);
    }, [setIobitPath]);

    // Suscribirse a eventos de progreso del backend
    useEffect(() => {
        const unlisten = listen<IoBitProgress>("iobit-progress", (event) => {
            const { stage, percent, label } = event.payload;
            setPhase(stage as InstallPhase);
            setProgressPercent(percent ?? null);
            setProgressLabel(label);
        });
        return () => { unlisten.then((f) => f()); };
    }, []);

    const handleAutoDetect = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            await refreshIobitPath();
            const s = await invoke<IoBitStatus>("get_iobit_status");
            setVersion(s.version ?? null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBrowse = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            await selectIobitPath();
            const s = await invoke<IoBitStatus>("get_iobit_status");
            setVersion(s.version ?? null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstallAuto = async () => {
        setErrorMsg(null);
        setProgressPercent(null);
        setProgressLabel("");
        setPhase("resolving");
        try {
            const status = await invoke<IoBitStatus>("install_iobit_auto");
            setIobitPath(status.path ?? null);
            setVersion(status.version ?? null);
            setPhase("idle");
        } catch (err) {
            setErrorMsg(String(err));
            setPhase("error");
        }
    };

    const handleUninstall = async () => {
        setErrorMsg(null);
        setProgressPercent(null);
        setProgressLabel("");
        setPhase("uninstalling");
        try {
            const status = await invoke<IoBitStatus>("uninstall_iobit");
            setIobitPath(status.path ?? null);
            setVersion(status.version ?? null);
            setPhase("idle");
        } catch (err) {
            setErrorMsg(String(err));
            setPhase("error");
        }
    };

    const phaseLabel = () => {
        if (progressLabel) return progressLabel;
        if (phase === "resolving")    return t("iobit_resolving");
        if (phase === "downloading")  return t("iobit_downloading");
        if (phase === "saving")       return t("iobit_saving");
        if (phase === "installing")   return t("iobit_installing");
        if (phase === "detecting")    return t("iobit_detecting");
        if (phase === "uninstalling") return t("iobit_uninstalling");
        return t("iobit_install_auto");
    };

    return (
        <section className="flex flex-col">
            <div className="section-toolbar mb-4">
                <div className="toolbar-title flex flex-wrap gap-2 justify-between">
                    <h2 className="text-lg font-semibold mr-4 sm:mr-auto flex-1 select-none cursor-default">
                        {t("iobit_installation")}
                    </h2>
                    <span className="text-sm opacity-75 shrink select-none cursor-default">
                        {t("iobit_installation_description")}
                    </span>
                </div>
            </div>

            <div className="installation-card iobit-panel">
                <h3 className="installation-header select-none cursor-default">
                    {t("iobit_path")}
                </h3>

                <div className="installation-details overflow-hidden items-center p-2">
                    <div className="iobit-info flex-1">
                        {/* Status line */}
                        {isFound ? (
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={16} className="text-green-400 shrink-0" />
                                <span className="text-sm font-medium">
                                    {t("iobit_found")}
                                    {version && (
                                        <span className="opacity-60 font-normal ml-1">v{version}</span>
                                    )}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={16} className="text-yellow-400 shrink-0" />
                                <span className="text-sm text-app-muted">{t("iobit_not_found")}</span>
                            </div>
                        )}

                        {/* Error message */}
                        {phase === "error" && errorMsg && (
                            <p className="text-xs text-red-400 mb-2 leading-snug">{errorMsg}</p>
                        )}

                        {/* Progress bar — visible during any active phase */}
                        {isActive && (
                            <div className="iobit-progress mb-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-app-muted truncate pr-2">
                                        {phaseLabel()}
                                    </span>
                                    {progressPercent !== null && (
                                        <span className="text-xs text-app-muted shrink-0">
                                            {progressPercent}%
                                        </span>
                                    )}
                                </div>
                                <div className="iobit-progress-track">
                                    <div
                                        className={cx(
                                            "iobit-progress-fill",
                                            progressPercent === null && "iobit-progress-fill--indeterminate"
                                        )}
                                        style={
                                            progressPercent !== null
                                                ? { width: `${progressPercent}%` }
                                                : undefined
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="iobit-actions flex flex-col gap-2">
                            {/* Auto-install: sólo cuando no está instalado y no hay operación activa */}
                            {canInstall && (
                                <Button
                                    theme="primary"
                                    size="sm"
                                    block
                                    onClick={handleInstallAuto}
                                    disabled={isLoading}
                                >
                                    {t("iobit_install_auto")}
                                </Button>
                            )}

                            <Button
                                theme={isFound ? "primary" : "secondary"}
                                size="sm"
                                block
                                onClick={handleAutoDetect}
                                disabled={isActive || isLoading}
                            >
                                {isLoading ? "..." : t("iobit_auto_detect")}
                            </Button>

                            <Button
                                theme="secondary"
                                size="sm"
                                block
                                onClick={handleBrowse}
                                disabled={isActive || isLoading}
                            >
                                {isLoading ? "..." : t("iobit_browse")}
                            </Button>

                            {/* Uninstall: sólo cuando IObit está instalado y no hay operación activa */}
                            {canUninstall && (
                                <Button
                                    theme="danger"
                                    size="sm"
                                    block
                                    onClick={handleUninstall}
                                    disabled={isLoading}
                                >
                                    {t("iobit_uninstall")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <footer className="installation-footer flex items-center justify-between overflow-auto w-full">
                    <p
                        className="text-xs text-app-muted whitespace-nowrap flex-1 truncate min-w-0 max-w-[calc(100vw-20rem)]"
                        title={iobitPath || t("iobit_help_text")}
                    >
                        {isFound ? iobitPath : t("iobit_help_text")}
                    </p>
                </footer>
            </div>
        </section>
    );
}

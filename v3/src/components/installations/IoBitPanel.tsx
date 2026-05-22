import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import { CheckCircle, AlertCircle, Download } from "lucide-react";

interface IoBitStatus {
    installed: boolean;
    path: string | null;
    version: string | null;
}

type InstallPhase = "idle" | "downloading" | "installing" | "error";

export default function IoBitPanel() {
    const { t } = useTranslation();
    const { iobitPath, setIobitPath, refreshIobitPath, selectIobitPath } = useAppStore();

    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<InstallPhase>("idle");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [version, setVersion] = useState<string | null>(null);

    const isFound = iobitPath !== null && iobitPath !== "";

    // Load full status on mount (includes version)
    useEffect(() => {
        invoke<IoBitStatus>("get_iobit_status")
            .then((s) => {
                setIobitPath(s.path ?? null);
                setVersion(s.version ?? null);
            })
            .catch(console.error);
    }, [setIobitPath]);

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
        setPhase("downloading");
        try {
            // The command downloads (~7 MB) then runs the silent installer.
            // We switch phase label mid-way using a short timer heuristic.
            const timer = setTimeout(() => setPhase("installing"), 8_000);
            const status = await invoke<IoBitStatus>("install_iobit_auto");
            clearTimeout(timer);
            setIobitPath(status.path ?? null);
            setVersion(status.version ?? null);
            setPhase("idle");
        } catch (err) {
            setErrorMsg(String(err));
            setPhase("error");
        }
    };

    const isInstalling = phase === "downloading" || phase === "installing";

    const phaseLabel = () => {
        if (phase === "downloading") return t("iobit_downloading");
        if (phase === "installing") return t("iobit_installing");
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

                        {/* Action buttons */}
                        <div className="iobit-actions flex flex-wrap gap-2">
                            {/* Auto-install: only shown when not found */}
                            {!isFound && (
                                <Button
                                    theme="primary"
                                    size="sm"
                                    onClick={handleInstallAuto}
                                    disabled={isInstalling || isLoading}
                                >
                                    <Download size={14} className="mr-1" />
                                    {phaseLabel()}
                                </Button>
                            )}

                            <Button
                                theme={isFound ? "primary" : "secondary"}
                                size="sm"
                                onClick={handleAutoDetect}
                                disabled={isInstalling || isLoading}
                            >
                                {isLoading ? "..." : t("iobit_auto_detect")}
                            </Button>

                            <Button
                                theme="secondary"
                                size="sm"
                                onClick={handleBrowse}
                                disabled={isInstalling || isLoading}
                            >
                                {isLoading ? "..." : t("iobit_browse")}
                            </Button>
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

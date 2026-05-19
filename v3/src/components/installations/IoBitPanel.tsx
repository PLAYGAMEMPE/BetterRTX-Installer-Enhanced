import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";

export default function IoBitPanel() {
    const { t } = useTranslation();
    const { iobitPath, setIobitPath, refreshIobitPath, selectIobitPath } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    const isFound = iobitPath !== null && iobitPath !== "";

    useEffect(() => {
        // Load IOBit path on component mount
        const loadIobitPath = async () => {
            try {
                const path = await invoke<string | null>('get_iobit_path');
                setIobitPath(path);
            } catch (error) {
                console.error('Failed to get IOBit path:', error);
            }
        };
        loadIobitPath();
    }, [setIobitPath]);

    const handleAutoDetect = async () => {
        setIsLoading(true);
        try {
            await refreshIobitPath();
        } finally {
            setIsLoading(false);
        }
    };

    const handleBrowse = async () => {
        setIsLoading(true);
        try {
            await selectIobitPath();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="flex flex-col">
            <div className="section-toolbar mb-4">
                <div className="toolbar-title flex flex-wrap gap-2 justify-between">
                    <h2 className="text-lg font-semibold mr-4 sm:mr-auto flex-1 select-none cursor-default">{t("iobit_installation")}</h2>
                    <span className="text-sm opacity-75 flex-shrink-1 select-none cursor-default">
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
                        {isFound ? (
                            <p className="text-sm font-medium mb-1">{t("iobit_found")}</p>
                        ) : (
                            <p className="text-sm text-app-muted mb-1">{t("iobit_not_found")}</p>
                        )}
                        <div className="iobit-actions flex gap-2">
                            <Button
                                theme="primary"
                                size="sm"
                                onClick={handleAutoDetect}
                                disabled={isLoading}
                            >
                                {isLoading ? "..." : t("iobit_auto_detect")}
                            </Button>
                            <Button
                                theme="secondary"
                                size="sm"
                                onClick={handleBrowse}
                                disabled={isLoading}
                            >
                                {isLoading ? "..." : t("iobit_browse")}
                            </Button>
                        </div>
                    </div>
                </div>

                <footer className="installation-footer flex items-center justify-between overflow-auto w-full">
                    <p className="text-xs text-app-muted whitespace-nowrap flex-1 truncate min-w-0 max-w-[calc(100vw-20rem)]" title={iobitPath || t("iobit_help_text")}>
                        {isFound ? iobitPath : t("iobit_help_text")}
                    </p>
                </footer>
            </div>
        </section>
    );
}
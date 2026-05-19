import React from "react";
import {
  RefreshCw,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";

export const ToolbarSection: React.FC = () => {
  const { t } = useTranslation();
  const {
    addConsoleOutput,
    refreshInstallations,
    refreshPresets,
    clearCache,
  } = useAppStore();

  const handleRefreshClick = () => {
    addConsoleOutput(t("log_refreshing_installations"));
    refreshInstallations();
  };

  const handleForceRefreshClick = () => {
    addConsoleOutput(t("log_force_refreshing_presets"));
    refreshPresets(true);
  };

  const handleClearCacheClick = () => {
    addConsoleOutput(t("log_clearing_cache"));
    clearCache();
  };
  return (
    <div className="flex items-start gap-2 justify-between px-2 pb-2">
        <Button onClick={handleRefreshClick} size="sm" extra="h-min">
          <div className="flex gap-2 items-center">
            <RefreshCw size={16} />
            <span>{t("refresh_installations")}</span>
          </div>
        </Button>
        <Button onClick={handleForceRefreshClick} size="sm" extra="h-min">
          <div className="flex gap-2 items-center">
            <RefreshCcw size={16} />
            <span>{t("refresh_api")}</span>
          </div>
        </Button>
        <Button onClick={handleClearCacheClick} size="sm" extra="h-min">
          <div className="flex gap-2 items-center">
            <Trash2 size={16} />
            <span>{t("clear_cache")}</span>
          </div>
        </Button>
    </div>
  );
};

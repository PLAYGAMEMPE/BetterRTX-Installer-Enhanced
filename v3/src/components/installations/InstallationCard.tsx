import React, { useEffect, useState } from "react";
import { cx } from "classix";
import { useTranslation } from "react-i18next";
import { Lock, AlertTriangle, Trash2, Archive, FolderOpen } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import PresetIcon from "../presets/PresetIcon";
import { checkMigrationNeeded } from "../../ipc/migration";
import Button from "../ui/Button";
import { useStatusStore } from "../../store/statusStore";

export interface Installation {
  FriendlyName: string;
  InstallLocation: string;
  Preview: boolean;
  IsCustom?: boolean;
  installed_preset?: {
    uuid: string;
    name: string;
    installed_at: string;
    is_creator?: boolean;
    is_api?: boolean;
  };
}

interface InstallationCardProps {
  installation: Installation;
  selected?: boolean;
  onSelectionChange?: (path: string, selected: boolean) => void;
  onRemove?: (path: string) => void;
  onViewBackups?: () => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString().replace(/\//g, "-");
};

const isSideloadedInstallation = (installation: Installation): boolean => {
  // Consider an installation sideloaded if it's in a non-standard location
  // Standard locations include Microsoft Store paths and common installation directories
  const path = installation.InstallLocation.toLowerCase();
  
  // Standard Microsoft Store and official installation paths
  const standardPaths = [
    'microsoft.minecraftuwp',
    'microsoft.minecraftpreview',
    'windowsapps',
    'program files',
    'program files (x86)',
  ];
  
  // If the path contains any standard location indicators, it's not sideloaded
  return !standardPaths.some(standardPath => path.includes(standardPath));
};

export const InstallationCard: React.FC<InstallationCardProps> = ({
  installation,
  selected = false,
  onSelectionChange,
  onRemove,
  onViewBackups,
}) => {
  const { t } = useTranslation();
  const { addMessage } = useStatusStore();
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  useEffect(() => {
    if (!installation.installed_preset) return;
    checkMigrationNeeded(installation.InstallLocation)
      .then((s) => setMigrationNeeded(s.migrationNeeded))
      .catch(() => {});
  }, [installation.InstallLocation, installation.installed_preset]);

  const handleCardClick = () => {
    const newSelected = !selected;
    onSelectionChange?.(installation.InstallLocation, newSelected);
  };

  const handleOpenMaterialsFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const materialsDir = `${installation.InstallLocation}\\data\\renderer\\materials`;
    try {
      await openPath(materialsDir);
    } catch (error) {
      addMessage({
        message: t("open_materials_folder_error", { error: String(error) }),
        type: "error",
      });
    }
  };

  const presetIcon = installation.installed_preset && !installation.installed_preset.is_creator && installation.installed_preset.uuid !== "material-files" ? (
    <div className="w-24 mb-1 mx-2"><PresetIcon uuid={installation.installed_preset.uuid} extra="max-w-24 ml-2" /></div>
  ) : null;

  return (
    <div
      className={cx(
        "installation-card",
        selected && "selected",
        installation.Preview && "preview order-2"
      )}
      data-path={installation.InstallLocation}
      onClick={handleCardClick}
    >
        <h3
          className="installation-header select-none"
          title={installation.InstallLocation}
        >
          {!isSideloadedInstallation(installation) && (
            <Lock className="inline-block w-4 h-4 mr-2 text-app-muted" />
          )}
          <span className="truncate flex-1">{installation.FriendlyName}</span>
          {installation.Preview && (
            <span className="preview-badge ml-2">Preview</span>
          )}
          {installation.IsCustom && (
            <span className="custom-badge ml-2">{t("custom_installation_badge")}</span>
          )}
          {installation.installed_preset?.is_creator && (
            <span className="creator-badge ml-2">{t("creator_preset")}</span>
          )}
          {installation.installed_preset?.is_api && (
            <span className="community-badge ml-2">{t("community_preset")}</span>
          )}
          {migrationNeeded && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              title={t("migration_needed_tooltip", "Minecraft updated — reinstall preset for compatibility")}
            >
              <AlertTriangle className="w-3 h-3" />
              {t("migration_needed", "Update")}
            </span>
          )}
        </h3>

        <div
          className={cx(
            "installation-details",
            "overflow-hidden items-center py-2 shrink"
          )}
        >
          {presetIcon || (
          <div className="installation-placeholder size-32 ml-3 bg-app-border/20 rounded flex items-center justify-center">
            <span className="text-app-muted text-sm">
              {installation.Preview ? "Preview Edition" : "Minecraft Release"}
            </span>
          </div>
        )}
            {installation.installed_preset ? (
              <div className="installed-preset-info">
                <h4 className="text-xs font-medium text-app-muted uppercase tracking-wider mb-0.5 whitespace-nowrap">
                  {t("current_preset")}
                </h4>
                <p className="max-w-[20ch] sm:max-w-[30ch] overflow-hidden text-ellipsis">{installation.installed_preset.name}</p>
                <time className="text-xs text-app-muted whitespace-nowrap">
                  {t("install_date", {
                    date: formatDate(installation.installed_preset.installed_at),
                  })}
                </time>
              </div>
            ) : (
              <p className="no-preset-info text-sm text-app-muted">
                {t("no_preset_installed")}
              </p>
            )}
        </div>

      <footer className="installation-footer flex items-center justify-between overflow-auto w-full gap-2">
        <p className="text-xs text-app-muted whitespace-nowrap flex-1 truncate min-w-0" title={installation.InstallLocation}>
          {installation.InstallLocation}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            theme="secondary"
            size="sm"
            title={t("open_materials_folder")}
            onClick={handleOpenMaterialsFolder}
          >
            <FolderOpen size={16} />
          </Button>
          <Button
            theme="secondary"
            size="sm"
            title={t("view_backups")}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onViewBackups?.(); }}
          >
            <Archive size={16} />
          </Button>
          {onRemove && (
            <Button
              theme="danger"
              size="sm"
              title={t("remove_installation")}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRemove(installation.InstallLocation); }}
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

import React from "react";
import { cx } from "classix";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import PresetIcon from "../presets/PresetIcon";

export interface Installation {
  FriendlyName: string;
  InstallLocation: string;
  Preview: boolean;
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
}) => {
  const { t } = useTranslation();

  const handleCardClick = () => {
    const newSelected = !selected;
    onSelectionChange?.(installation.InstallLocation, newSelected);
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
          {installation.installed_preset?.is_creator && (
            <span className="creator-badge ml-2">{t("creator_preset")}</span>
          )}
          {installation.installed_preset?.is_api && (
            <span className="community-badge ml-2">{t("community_preset")}</span>
          )}
        </h3>

        <div
          className={cx(
            "installation-details",
            "overflow-hidden items-center py-2 flex-shrink-1"
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

      <footer className="installation-footer flex items-center justify-between overflow-auto w-full">
        <p className="text-xs text-app-muted whitespace-nowrap flex-1 truncate min-w-0 max-w-[calc(100vw-20rem)]" title={installation.InstallLocation}>
          {installation.InstallLocation}
        </p>
      </footer>
    </div>
  );
};

import React from "react";
import { useTranslation } from "react-i18next";
import { cx } from "classix";
import Button from "../ui/Button";
import BlockPath from "../ui/BlockPath";
import PresetIcon from "./PresetIcon";
import { ChevronDown } from "lucide-react";
import BedrockGraphicsLink from "../ui/BedrockGraphicsLink";

export interface PackInfo {
  name: string;
  uuid: string;
  slug?: string;
  stub: string;
  tonemapping: string;
  bloom: string;
}

interface PresetCardProps {
  preset: PackInfo;
  selected?: boolean;
  isInstalling?: boolean;
  onSelectionChange?: (uuid: string, selected: boolean) => void;
  onInstall?: (uuid: string) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  selected = false,
  isInstalling = false,
  onSelectionChange,
  onInstall,
}) => {
  const { t } = useTranslation();
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".install-preset-btn")) return;

    const newSelected = !selected;
    onSelectionChange?.(preset.uuid, newSelected);
  };

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInstall?.(preset.uuid);
  };

  return (
    <div
      className={cx(
        "preset-card transition-all",
        selected && "selected"
      )}
      data-uuid={preset.uuid}
      onClick={handleCardClick}
    >
      <div className="flex flex-col w-full">
        <PresetIcon uuid={preset.uuid} />
        <div className="preset-header cursor-pointer">
          <h3 className="preset-title select-none">{preset.name}</h3>
          <button
            type="button"
            className="preset-header__toggle"
            aria-expanded={selected}
            aria-label={t("toggle_details", "Toggle details")}
          >
            <ChevronDown
              size={16}
              className={cx(
                "preset-header__chevron cursor-pointer",
                selected && "preset-header__chevron--rotated"
              )}
            />
          </button>
        </div>
      </div>
      <div
        className={cx(
          "preset-details",
          "overflow-hidden transition-all",
          !selected ? "max-h-0 opacity-0 pointer-events-none translate-y-2" : "max-h-full opacity-100 pointer-events-auto translate-y-0"
        )}
      >
        <div className="flex flex-col gap-1 text-xs">
          <BedrockGraphicsLink preset={preset.slug ?? preset.uuid} />
          <dl>
            <dt>RTX Stub</dt>
            <dd>
              <BlockPath path={preset.stub} href={preset.stub} />
            </dd>
            <dt>Tonemapping</dt>
            <dd>
              <BlockPath path={preset.tonemapping} href={preset.tonemapping} />
            </dd>
            <dt>Bloom</dt>
            <dd>
              <BlockPath path={preset.bloom} href={preset.bloom} />
            </dd>
          </dl>
        </div>
      </div>
      <div className={cx("preset-card__footer border-t", selected ? "border-app-border pt-2" : "border-transparent")}>
        <Button
          theme={!isInstalling ? "primary" : null}
          block
          extra="install-preset-btn"
          onClick={handleInstallClick}
          disabled={isInstalling}
          data-uuid={preset.uuid}
        >
          {isInstalling ? t("installing") : t("install")}
        </Button>
      </div>
    </div>
  );
};

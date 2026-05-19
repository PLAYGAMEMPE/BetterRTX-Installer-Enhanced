import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { cx } from "classix";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { useAppStore } from "../store/appStore";
import { useStatusStore } from "../store/statusStore";

interface RtpackDialogProps {
  isOpen: boolean;
  rtpackPath: string;
  onClose: () => void;
}

export const RtpackDialog: React.FC<RtpackDialogProps> = ({
  isOpen,
  rtpackPath,
  onClose,
}) => {
  const { t } = useTranslation();
  const { installations, refreshInstallations } = useAppStore();
  const { addMessage } = useStatusStore();
  const [selectedInstallations, setSelectedInstallations] = useState<
    Set<string>
  >(new Set());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isOpen && installations.length === 0) {
      refreshInstallations();
    }
  }, [isOpen, installations.length, refreshInstallations]);

  const handleInstallationToggle = useCallback((installLocation: string): void => {
    const newSet = new Set(selectedInstallations);
    if (newSet.has(installLocation)) {
      newSet.delete(installLocation);
    } else {
      newSet.add(installLocation);
    }
    setSelectedInstallations(newSet);
  }, [selectedInstallations]);

  const handleInstall = useCallback(async (): Promise<void> => {
    if (!rtpackPath.toLowerCase().endsWith(".rtpack")) {
      addMessage({ message: t("invalid_rtpack", "Invalid RTpack file"), type: "error" });
      return;
    }
    if (selectedInstallations.size === 0) {
      addMessage({
        message: t("status_select_installation_warning"),
        type: "error",
      });
      return;
    }
    setIsInstalling(true);
    try {
      addMessage({ message: t("status_installing_rtpack"), type: "loading" });
      await invoke<void>("install_from_rtpack", {
        rtpackPath,
        selectedNames: Array.from(selectedInstallations),
      });
      addMessage({ message: t("status_install_success"), type: "success" });
      await refreshInstallations();
      onClose();
    } catch (error) {
      const errorMsg = t("status_install_error", { error });
      addMessage({ message: errorMsg, type: "error" });
    } finally {
      setIsInstalling(false);
    }
  }, [addMessage, onClose, refreshInstallations, rtpackPath, selectedInstallations, t]);

  const handleSelectAll = useCallback((): void => {
    if (selectedInstallations.size === installations.length) {
      setSelectedInstallations(new Set());
    } else {
      setSelectedInstallations(new Set(installations.map((i) => i.InstallLocation)));
    }
  }, [installations, selectedInstallations]);

  const handleClose = useCallback((): void => {
    setSelectedInstallations(new Set());
    onClose();
  }, [onClose]);

  const fileName = rtpackPath.split(/[\\\/]/).pop() || rtpackPath;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("rtpack_dialog_title")}
      className="installation-modal"
    >
      <div className="installation-modal__content">
        <p className="installation-modal__description">
          {t("rtpack_dialog_description")}
        </p>

        <div className="panel mb-4">
          <div className="panel__body">
            <p className="text-sm font-medium break-all font-mono">
              {fileName}
            </p>
          </div>
        </div>

        <div className="installation-modal__controls">
          <Button
            className="btn btn--secondary"
            onClick={handleSelectAll}
            disabled={isInstalling}
          >
            {selectedInstallations.size === installations.length
              ? t("deselect_all")
              : t("select_all")}
          </Button>
          <span className="installation-modal__count">
            {t("selected_count", {
              selected: selectedInstallations.size,
              total: installations.length,
            })}
          </span>
        </div>

        {installations.length === 0 ? (
          <div className="empty-state">
            <p>{t("no_minecraft_installations")}</p>
          </div>
        ) : (
          <div className="installation-modal__list">
            {installations.map((installation) => (
              <div
                key={installation.InstallLocation}
                className={cx(
                  "installation-item",
                  selectedInstallations.has(installation.InstallLocation) &&
                    "installation-item--selected"
                )}
              >
                <label className="installation-item__label">
                  <input
                    type="checkbox"
                    className="installation-item__checkbox"
                    checked={selectedInstallations.has(
                      installation.InstallLocation
                    )}
                    onChange={() =>
                      handleInstallationToggle(installation.InstallLocation)
                    }
                    disabled={isInstalling}
                  />
                  <div className="installation-item__info">
                    <span className="installation-item__name">
                      {installation.FriendlyName}
                    </span>
                    <span className="installation-item__path">
                      {installation.InstallLocation}
                    </span>
                    {installation.Preview && (
                      <span className="installation-item__badge">
                        {t("preview")}
                      </span>
                    )}
                    {installation.installed_preset && (
                      <span className="installation-item__preset">
                        {t("current_preset")}:{" "}
                        {installation.installed_preset.name}
                      </span>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="installation-modal__actions">
          <Button
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={isInstalling}
          >
            {t("cancel")}
          </Button>
          <Button
            className="btn btn--primary"
            onClick={handleInstall}
            disabled={selectedInstallations.size === 0 || isInstalling}
          >
            {isInstalling
              ? t("installing")
              : t("install_to_selected", { count: selectedInstallations.size })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

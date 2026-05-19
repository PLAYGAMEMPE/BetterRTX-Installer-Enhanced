import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "classix";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Installation } from "../../store/appStore";
import Switch from "../ui/Switch";

interface InstallationInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  installations: Installation[];
  presetName: string;
  onInstall: (selectedInstallations: string[]) => void;
  isInstalling?: boolean;
}

const InstallationInstanceModal: React.FC<InstallationInstanceModalProps> = ({
  isOpen,
  onClose,
  installations,
  presetName,
  onInstall,
  isInstalling = false,
}) => {
  const { t } = useTranslation();
  const [selectedInstallations, setSelectedInstallations] = useState<
    Set<string>
  >(new Set());

  const handleInstallationToggle = (installPath: string): void => {
    const newSelected = new Set(selectedInstallations);
    if (newSelected.has(installPath)) {
      newSelected.delete(installPath);
    } else {
      newSelected.add(installPath);
    }
    setSelectedInstallations(newSelected);
  };

  const handleSelectAll = (): void => {
    if (selectedInstallations.size === installations.length) {
      setSelectedInstallations(new Set());
    } else {
      setSelectedInstallations(
        new Set(installations.map((inst) => inst.InstallLocation))
      );
    }
  };

  const handleInstall = (): void => {
    if (selectedInstallations.size > 0) {
      onInstall(Array.from(selectedInstallations));
      onClose();
    }
  };

  const handleClose = (): void => {
    setSelectedInstallations(new Set());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("install_preset_to_instances", { presetName })}
      className="installation-modal"
    >
      <div className="installation-modal__content">
        <p className="installation-modal__description">
          {t("select_installations_description")}
        </p>

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
              <div className="installation-item__label" onClick={() => handleInstallationToggle(installation.InstallLocation)}>
                <Switch
                  checked={selectedInstallations.has(
                    installation.InstallLocation
                  )}
                  onCheckedChange={() =>
                    handleInstallationToggle(installation.InstallLocation)
                  }
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
              </div>
            </div>
          ))}
        </div>

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

export default InstallationInstanceModal;

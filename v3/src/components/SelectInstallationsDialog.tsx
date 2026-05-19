import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "classix";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { useAppStore } from "../store/appStore";
import { useStatusStore } from "../store/statusStore";

interface SelectInstallationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmKey: string; // i18n key for idle confirm label; expects { count }
  busyKey: string; // i18n key for busy label
  onConfirm: (selected: string[]) => Promise<boolean>;
}

const SelectInstallationsDialog: React.FC<SelectInstallationsDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmKey,
  busyKey,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { installations, selectedInstallations, refreshInstallations } = useAppStore();
  const { addMessage } = useStatusStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Pre-select current selections from the store
      setSelected(new Set(selectedInstallations));
      if (installations.length === 0) {
        // Mirror RtpackDialog behavior
        refreshInstallations();
      }
    } else {
      setSelected(new Set());
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggle = (path: string): void => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
  };

  const handleSelectAll = (): void => {
    if (selected.size === installations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(installations.map((i) => i.InstallLocation)));
    }
  };

  const handleClose = (): void => {
    setSelected(new Set());
    setIsProcessing(false);
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    if (selected.size === 0) {
      addMessage({ message: t("status_select_installation_warning"), type: "error" });
      return;
    }
    setIsProcessing(true);
    try {
      const ok = await onConfirm(Array.from(selected));
      if (ok) handleClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} className="installation-modal">
      <div className="installation-modal__content">
        {description && (
          <p className="installation-modal__description">{description}</p>
        )}

        <div className="installation-modal__controls">
          <Button className="btn btn--secondary" onClick={handleSelectAll} disabled={isProcessing}>
            {selected.size === installations.length ? t("deselect_all") : t("select_all")}
          </Button>
          <span className="installation-modal__count">
            {t("selected_count", { selected: selected.size, total: installations.length })}
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
                  selected.has(installation.InstallLocation) && "installation-item--selected"
                )}
              >
                <label className="installation-item__label">
                  <input
                    type="checkbox"
                    className="installation-item__checkbox"
                    checked={selected.has(installation.InstallLocation)}
                    onChange={() => toggle(installation.InstallLocation)}
                    disabled={isProcessing}
                  />
                  <div className="installation-item__info">
                    <span className="installation-item__name">{installation.FriendlyName}</span>
                    <span className="installation-item__path">{installation.InstallLocation}</span>
                    {installation.Preview && (
                      <span className="installation-item__badge">{t("preview")}</span>
                    )}
                    {installation.installed_preset && (
                      <span className="installation-item__preset">
                        {t("current_preset", { name: installation.installed_preset.name })}
                      </span>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="installation-modal__actions">
          <Button className="btn btn--secondary" onClick={handleClose} disabled={isProcessing}>
            {t("cancel")}
          </Button>
          <Button
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={selected.size === 0 || isProcessing}
          >
            {isProcessing ? t(busyKey) : t(confirmKey, { count: selected.size })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SelectInstallationsDialog;

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";

interface CreatorNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  defaultName: string;
  isProcessing: boolean;
}

export default function CreatorNameModal({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
  isProcessing,
}: CreatorNameModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3 className="modal-title">{t("creator_name_modal_title")}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="field">
            <label className="field__label" htmlFor="creator-name">
              {t("creator_name_label")}
            </label>
            <div className="field__control">
              <input
                id="creator-name"
                type="text"
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isProcessing}
                placeholder={t("creator_name_placeholder")}
                autoFocus
              />
            </div>
            <p className="text-xs text-app-muted mt-1">
              {t("creator_name_help")}
            </p>
          </div>
        </form>

        <div className="modal-footer">
          <Button
            type="button"
            theme="secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            theme="primary"
            onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            disabled={isProcessing || !name.trim()}
          >
            {isProcessing ? t("creator_installing") : t("install")}
          </Button>
        </div>
      </div>
    </div>
  );
}

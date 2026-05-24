import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { InstallationCard, Installation } from "./InstallationCard";
import Button from "../ui/Button";
import { useStatusStore } from "../../store/statusStore";
import BackupsModal from "./BackupsModal";

interface InstallationsPanelProps {
  installations: Installation[];
  selectedInstallations: Set<string>;
  onInstallationSelection: (path: string, selected: boolean) => void;
  onInstallationAdded: () => void;
  onInstallationRemoved: () => void;
}

export default function InstallationsPanel({
  installations,
  selectedInstallations,
  onInstallationSelection,
  onInstallationAdded,
  onInstallationRemoved,
}: Readonly<InstallationsPanelProps>) {
  const { t } = useTranslation();
  const { addMessage } = useStatusStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newInstallPath, setNewInstallPath] = useState("");
  const [newInstallName, setNewInstallName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [backupsInstallation, setBackupsInstallation] = useState<Installation | null>(null);

  const closeDialog = () => {
    setShowAddDialog(false);
    setNewInstallPath("");
    setNewInstallName("");
  };

  const handleAddInstallation = async () => {
    if (!newInstallPath.trim()) return;

    setIsAdding(true);
    try {
      await invoke("add_custom_installation", {
        path: newInstallPath.trim(),
        name: newInstallName.trim(),
      });
      addMessage({ message: t("installation_added_success"), type: "success" });
      onInstallationAdded();
      closeDialog();
    } catch (error) {
      addMessage({ message: t("error_adding_install", { error: String(error) }), type: "error" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveInstallation = async (path: string) => {
    try {
      await invoke("remove_custom_installation", { path });
      addMessage({ message: t("installation_removed_success"), type: "success" });
      onInstallationRemoved();
    } catch (error) {
      addMessage({ message: t("error_removing_install", { error: String(error) }), type: "error" });
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("add_installation")
      });
      if (selected) {
        setNewInstallPath(selected);
      }
    } catch (error) {
      console.error("Error opening folder dialog:", error);
    }
  };

  return (
    <div className="installations-panel">
      <div className="section-toolbar mb-4 flex items-center justify-between">
        <div className="toolbar-title select-none cursor-default">
          <h2>{t("installations_title")}</h2>
          <span className="item-count">
            {t("installations_found_count", { count: installations.length })}
          </span>
        </div>
      </div>

      <div className="installations-list flex flex-wrap gap-4 justify-stretch">
        {installations.length > 0
          ? installations.map((installation) => (
            <InstallationCard
              key={installation.InstallLocation}
              installation={installation}
              selected={selectedInstallations.has(installation.InstallLocation)}
              onSelectionChange={onInstallationSelection}
              onRemove={installation.IsCustom ? handleRemoveInstallation : undefined}
              onViewBackups={() => setBackupsInstallation(installation)}
            />
          ))
          : (
            <div className="empty-state text-center py-8 col-span-full">
              <p>{t("installations_none_found")}</p>
              <p className="text-xs mt-2">
                {t("installations_none_found_hint")}
              </p>
            </div>
          )}
      </div>

      <Button
        theme="primary"
        block
        extra="mt-4"
        onClick={() => setShowAddDialog(true)}
      >
        {t("add_installation")}
      </Button>

      <BackupsModal
        installation={backupsInstallation}
        onClose={() => setBackupsInstallation(null)}
      />

      {/* Diálogo para añadir instalación personalizada */}
      {showAddDialog && createPortal(
        <div
          className="dialog-overlay"
          style={{
            left: "16rem",
            backgroundColor: "transparent",
          }}
        >
          <div className="dialog" style={{ maxHeight: "none", margin: "1.5rem" }}>
            <div className="dialog__header">
              <h2 className="dialog__title">{t("add_custom_installation")}</h2>
              <button className="dialog__close" onClick={closeDialog}>×</button>
            </div>
            <div className="dialog__content" style={{ flex: "none", overflow: "visible" }}>
              <div className="space-y-4">
                <div className="field">
                  <label className="field__label select-none cursor-default">
                    {t("installation_name")}
                  </label>
                  <input
                    type="text"
                    className="field__input"
                    value={newInstallName}
                    onChange={(e) => setNewInstallName(e.target.value)}
                    placeholder={t("installation_name_placeholder")}
                  />
                </div>
                <div className="field">
                  <label className="field__label select-none cursor-default">
                    {t("installation_path")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="field__input flex-1"
                      value={newInstallPath}
                      onChange={(e) => setNewInstallPath(e.target.value)}
                      placeholder={t("installation_path_placeholder")}
                    />
                    <Button theme="secondary" size="sm" onClick={handleBrowseFolder}>
                      {t("browse")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="dialog__actions">
              <Button theme="secondary" onClick={closeDialog}>
                {t("cancel")}
              </Button>
              <Button
                theme="primary"
                onClick={handleAddInstallation}
                disabled={!newInstallPath.trim() || isAdding}
              >
                {isAdding ? t("adding") : t("add")}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { InstallationCard, Installation } from "./InstallationCard";
import Button from "../ui/Button";
import { PlusIcon } from "lucide-react";

interface InstallationsPanelProps {
  installations: Installation[];
  selectedInstallations: Set<string>;
  onInstallationSelection: (path: string, selected: boolean) => void;
  onInstallationAdded: () => void;
}

export default function InstallationsPanel({
  installations,
  selectedInstallations,
  onInstallationSelection,
  onInstallationAdded,
}: InstallationsPanelProps) {
  const { t } = useTranslation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newInstallPath, setNewInstallPath] = useState("");
  const [newInstallName, setNewInstallName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddInstallation = async () => {
    if (!newInstallPath.trim()) return;

    setIsAdding(true);
    try {
      const isValid = await invoke<boolean>("validate_minecraft_path", {
        path: newInstallPath,
      });

      if (!isValid) {
        alert("Invalid Minecraft installation path");
        return;
      }

      // Trigger refresh of installations list
      onInstallationAdded();

      // Reset form
      setShowAddDialog(false);
      setNewInstallPath("");
      setNewInstallName("");
    } catch (error) {
      console.error("Error adding installation:", error);
      alert(`Error adding installation: ${error}`);
    } finally {
      setIsAdding(false);
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
        setNewInstallPath(selected as string);
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

        <Button
          theme="secondary"
          className="btn size-12"
          onClick={() => setShowAddDialog(true)}
          title={t("add_installation")}
        >
          <PlusIcon className="size-8 scale-250" />
        </Button>
      </div>

      <div className="installations-list flex flex-wrap gap-4 justify-stretch">
        {installations.length > 0
          ? installations.map((installation) => (
            <InstallationCard
              key={installation.InstallLocation}
              installation={installation}
              selected={selectedInstallations.has(
                installation.InstallLocation
              )}
              onSelectionChange={onInstallationSelection}
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
        className="btn btn--primary mt-4"
        onClick={() => setShowAddDialog(true)}
      >
        {t("add_installation")}
      </Button>

      {/* Add Installation Dialog */}
      {showAddDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <div className="dialog__header">
              <h2 className="dialog__title">{t("add_custom_installation")}</h2>
              <button
                className="dialog__close"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewInstallPath("");
                  setNewInstallName("");
                }}
              >
                ×
              </button>
            </div>
            <div className="dialog__content">
              <div className="space-y-4">
                <div className="field">
                  <label className="field__label select-none cursor-default">{t("installation_name")}</label>
                  <input
                    type="text"
                    className="field__input"
                    value={newInstallName}
                    onChange={(e) => setNewInstallName(e.target.value)}
                    placeholder={t("installation_name_placeholder")}
                  />
                </div>
                <div className="field">
                  <label className="field__label">{t("installation_path")}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="field__input flex-1"
                      value={newInstallPath}
                      onChange={(e) => setNewInstallPath(e.target.value)}
                      placeholder={t("installation_path_placeholder")}
                    />
                    <Button className="btn" onClick={handleBrowseFolder}>
                      {t("browse")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="dialog__actions">
              <Button
                className="btn button--ghost"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewInstallPath("");
                  setNewInstallName("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                className="btn btn--primary"
                onClick={handleAddInstallation}
                disabled={!newInstallPath.trim() || isAdding}
              >
                {isAdding ? t("adding") : t("add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

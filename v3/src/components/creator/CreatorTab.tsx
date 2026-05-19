import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import Button from "../ui/Button";
import { useAppStore } from "../../store/appStore";
import { useStatusStore } from "../../store/statusStore";
import InstallationInstanceModal from "../installations/InstallationInstanceModal";
import CreatorNameModal from "./CreatorNameModal";

export default function CreatorTab() {
  const { t } = useTranslation();
  const { installations } = useAppStore();
  const { addMessage } = useStatusStore();
  const [settingsHash, setSettingsHash] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [pendingInstallData, setPendingInstallData] = useState<{
    selectedNames: string[];
    presetName: string;
  } | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isMaterialNameModalOpen, setIsMaterialNameModalOpen] = useState(false);
  const [pendingMaterialData, setPendingMaterialData] = useState<{
    selectedNames: string[];
    presetName: string;
  } | null>(null);
  const [selectedRtpack, setSelectedRtpack] = useState<string>("");
  const [isRtpackModalOpen, setIsRtpackModalOpen] = useState(false);

  const handleInstall = async (selectedNames: string[]) => {
    if (selectedNames.length === 0) {
      addMessage({
        message: t("status_select_installation_warning"),
        type: "error",
      });
      return;
    }

    const defaultName = `Settings ${settingsHash.slice(0, 8)}`;
    setPendingInstallData({ selectedNames, presetName: defaultName });
    setIsModalOpen(false);
    setIsNameModalOpen(true);
  };

  const handleNameConfirm = async (presetName: string) => {
    if (!pendingInstallData) return;

    setIsProcessing(true);
    setIsNameModalOpen(false);
    const { refreshInstallations, addConsoleOutput } = useAppStore.getState();
    
    try {
      addConsoleOutput(t("log_installing_creator_preset", { name: presetName }));
      
      // Create a unique UUID for the creator preset using settings hash
      const creatorUuid = `creator-${settingsHash.trim()}`;
      
      await invoke("download_creator_settings", {
        settingsHash: settingsHash.trim(),
        selectedNames: pendingInstallData.selectedNames,
        presetName,
        uuid: creatorUuid,
      });

      addMessage({
        message: t("creator_install_success", { name: presetName }),
        type: "success",
      });
      
      addConsoleOutput(t("log_creator_install_complete"));
      // Refresh installations to show the new creator preset
      await refreshInstallations();
      setSettingsHash("");
    } catch (error) {
      addMessage({
        message: t("creator_install_error", { error }),
        type: "error",
      });
      addConsoleOutput(t("log_creator_install_error", { error }));
    } finally {
      setIsProcessing(false);
      setPendingInstallData(null);
    }
  };

  const handleMaterialInstall = async (selectedNames: string[]) => {
    if (selectedNames.length === 0) {
      addMessage({
        message: t("status_select_installation_warning"),
        type: "error",
      });
      return;
    }

    if (uploadedFiles.length === 0) {
      addMessage({
        message: t("creator_no_materials_uploaded"),
        type: "error",
      });
      return;
    }

    const defaultName = `Materials (${uploadedFiles.length} files)`;
    setPendingMaterialData({ selectedNames, presetName: defaultName });
    setIsMaterialModalOpen(false);
    setIsMaterialNameModalOpen(true);
  };

  const handleMaterialNameConfirm = async (presetName: string) => {
    if (!pendingMaterialData) return;

    setIsProcessing(true);
    setIsMaterialNameModalOpen(false);
    const { refreshInstallations, addConsoleOutput } = useAppStore.getState();
    
    try {
      addConsoleOutput(t("log_installing_material_preset", { name: presetName }));
      
      await invoke("install_uploaded_materials", {
        selectedNames: pendingMaterialData.selectedNames,
        presetName,
      });

      addMessage({
        message: t("creator_materials_install_success", { name: presetName }),
        type: "success",
      });
      
      addConsoleOutput(t("log_material_install_complete"));
      // Refresh installations to show the new material preset
      await refreshInstallations();
      // Clear uploaded files after successful installation
      setUploadedFiles([]);
    } catch (error) {
      addMessage({
        message: t("creator_materials_install_error", { error }),
        type: "error",
      });
      addConsoleOutput(t("log_material_install_error", { error }));
    } finally {
      setIsProcessing(false);
      setPendingMaterialData(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!settingsHash.trim()) {
      addMessage({
        message: t("creator_please_enter_hash"),
        type: "error",
      });
      return;
    }

    setIsModalOpen(true);
  };

  const handleHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettingsHash(e.target.value);
  };

  const handleFileUpload = async () => {
    setIsProcessing(true);
    try {
      // Use Tauri dialog plugin to select multiple files
      const filePaths = await open({
        title: "Select .material.bin files",
        filters: [{
          name: "Material Files",
          extensions: ["material.bin"]
        }],
        multiple: true
      });

      if (!filePaths || filePaths.length === 0) {
        setIsProcessing(false);
        return;
      }

      // Process each selected file
      const uploadedFilenames: string[] = [];
      for (const filePath of filePaths) {
        try {
          // Use Tauri command to upload the file (handles permissions properly)
          const filename = await invoke("upload_material_file", {
            sourcePath: filePath
          }) as string;
          uploadedFilenames.push(filename);
        } catch (error) {
          addMessage({
            message: t("creator_upload_error_single", { 
              filename: filePath.split(/[\\\/]/).pop() || filePath,
              error 
            }),
            type: "error",
          });
        }
      }

      if (uploadedFilenames.length > 0) {
        addMessage({
          message: t("creator_files_uploaded", { count: uploadedFilenames.length }),
          type: "success",
        });

        // Add to uploaded files list
        setUploadedFiles(prev => [...prev, ...uploadedFilenames]);
      }
      
    } catch (error) {
      addMessage({
        message: t("creator_upload_error", { error }),
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = (filename: string) => {
    setUploadedFiles(prev => prev.filter(f => f !== filename));
    addMessage({
      message: t("creator_file_removed", { filename }),
      type: "info",
    });
  };

  const handleRtpackUpload = async () => {
    setIsProcessing(true);
    try {
      // Use Tauri dialog plugin to select .rtpack file
      const filePath = await open({
        title: "Select .rtpack file",
        filters: [{
          name: "RTX Pack Files",
          extensions: ["rtpack"]
        }],
        multiple: false
      });

      if (!filePath) {
        setIsProcessing(false);
        return;
      }

      // Store the selected rtpack path
      setSelectedRtpack(filePath);
      
      addMessage({
        message: t("creator_rtpack_selected", { filename: filePath.split(/[\\\/]/).pop() || filePath }),
        type: "success",
      });

      // Immediately open the installation modal
      setIsRtpackModalOpen(true);
      
    } catch (error) {
      addMessage({
        message: t("creator_rtpack_error", { error }),
        type: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRtpackInstall = async (selectedNames: string[]) => {
    if (selectedNames.length === 0) {
      addMessage({
        message: t("status_select_installation_warning"),
        type: "error",
      });
      return;
    }

    if (!selectedRtpack) {
      addMessage({
        message: t("creator_no_rtpack_selected"),
        type: "error",
      });
      return;
    }

    setIsProcessing(true);
    setIsRtpackModalOpen(false);
    const { refreshInstallations, addConsoleOutput } = useAppStore.getState();
    
    try {
      const filename = selectedRtpack.split(/[\\\/]/).pop() || selectedRtpack;
      addConsoleOutput(t("log_installing_rtpack", { name: filename }));
      
      await invoke("install_from_rtpack", {
        rtpackPath: selectedRtpack,
        selectedNames,
      });

      addMessage({
        message: t("creator_rtpack_install_success", { name: filename }),
        type: "success",
      });
      
      addConsoleOutput(t("log_rtpack_install_complete"));
      // Refresh installations to show the new installation
      await refreshInstallations();
      // Clear selected rtpack after successful installation
      setSelectedRtpack("");
    } catch (error) {
      addMessage({
        message: t("creator_rtpack_install_error", { error }),
        type: "error",
      });
      addConsoleOutput(t("log_rtpack_install_error", { error }));
    } finally {
      setIsProcessing(false);
    }
  };

  const isValidHash = settingsHash.trim().length >= 8;

  return (
    <section className="creator-container">
      <div className="section-toolbar mb-4">
        <div className="toolbar-title flex flex-wrap gap-2">
          <h2 className="text-lg font-semibold mr-4">{t("creator_title")}</h2>
          <span className="text-sm opacity-75">
            {t("creator_subtitle")}
          </span>
        </div>
      </div>

      <div className="creator-content">
        <div className="panel col-span-2">
          <div className="panel__header">
            <h3 className="panel__title">{t("creator_install_title")}</h3>
          </div>
          <div className="panel__body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="field">
                <label className="field__label" htmlFor="settings-hash">
                  {t("creator_settings_hash")}
                </label>
                <div className="field__control">
                  <input
                    id="settings-hash"
                    type="text"
                    className="field__input font-mono"
                    placeholder={t("creator_settings_hash_placeholder")}
                    value={settingsHash}
                    onChange={handleHashChange}
                    disabled={isProcessing}
                  />
                </div>
                <p className="text-xs text-app-muted mt-1">
                  {t("creator_settings_hash_help")}
                </p>
              </div>

              <div className="form-actions">
                <Button
                  type="submit"
                  theme="primary"
                  disabled={isProcessing || !isValidHash}
                >
                  {isProcessing ? t("creator_installing") : t("creator_install_button")}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <h3 className="panel__title">{t("creator_material_files_title")}</h3>
          </div>
          <div className="panel__body">
            <div className="space-y-4">
              <p className="text-sm text-app-muted">
                {t("creator_material_files_subtitle")}
              </p>
              
              <div className="field">
                <label className="field__label">
                  {t("creator_upload_materials")}
                </label>
                <div className="field__control">
                  <Button
                    type="button"
                    theme="secondary"
                    onClick={handleFileUpload}
                    disabled={isProcessing}
                  >
                    {isProcessing ? t("creator_installing") : t("creator_select_files")}
                  </Button>
                </div>
                <p className="text-xs text-app-muted mt-1">
                  {t("creator_upload_dialog_help")}
                </p>
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="uploaded-files">
                  <h4 className="text-sm font-medium mb-2">{t("creator_uploaded_files")}</h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((filename, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-app-surface rounded border">
                        <span className="text-sm font-mono">{filename}</span>
                        <Button
                          type="button"
                          theme="secondary"
                          size="sm"
                          onClick={() => handleRemoveFile(filename)}
                          disabled={isProcessing}
                        >
                          {t("remove")}
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4">
                    <Button
                      type="button"
                      theme="primary"
                      onClick={() => setIsMaterialModalOpen(true)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? t("creator_installing") : t("creator_install_materials")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <h3 className="panel__title">{t("creator_rtpack_title")}</h3>
          </div>
          <div className="panel__body">
            <div className="space-y-4">
              <p className="text-sm text-app-muted">
                {t("creator_rtpack_subtitle")}
              </p>
              
              <div className="field">
                <label className="field__label">
                  {t("creator_select_rtpack")}
                </label>
                <div className="field__control">
                  <Button
                    type="button"
                    theme="secondary"
                    onClick={handleRtpackUpload}
                    disabled={isProcessing}
                  >
                    {isProcessing ? t("creator_installing") : t("creator_browse_rtpack")}
                  </Button>
                </div>
                <p className="text-xs text-app-muted mt-1">
                  {t("creator_rtpack_help")}
                </p>
              </div>
              
              {selectedRtpack && (
                <div className="selected-rtpack">
                  <h4 className="text-sm font-medium mb-2">{t("creator_selected_rtpack")}</h4>
                  <div className="p-2 bg-app-surface rounded border">
                    <span className="text-sm font-mono">{selectedRtpack.split(/[\\\/]/).pop() || selectedRtpack}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <InstallationInstanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        installations={installations}
        presetName={`settings ${settingsHash.slice(0, 8)}...`}
        onInstall={handleInstall}
        isInstalling={isProcessing}
      />
      <CreatorNameModal
        isOpen={isNameModalOpen}
        onClose={() => {
          setIsNameModalOpen(false);
          setPendingInstallData(null);
        }}
        onConfirm={handleNameConfirm}
        defaultName={pendingInstallData?.presetName || ""}
        isProcessing={isProcessing}
      />
      <InstallationInstanceModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        installations={installations}
        presetName={`${uploadedFiles.length} material files`}
        onInstall={handleMaterialInstall}
        isInstalling={isProcessing}
      />
      <CreatorNameModal
        isOpen={isMaterialNameModalOpen}
        onClose={() => {
          setIsMaterialNameModalOpen(false);
          setPendingMaterialData(null);
        }}
        onConfirm={handleMaterialNameConfirm}
        defaultName={pendingMaterialData?.presetName || ""}
        isProcessing={isProcessing}
      />
      <InstallationInstanceModal
        isOpen={isRtpackModalOpen}
        onClose={() => {
          setIsRtpackModalOpen(false);
          setSelectedRtpack("");
        }}
        installations={installations}
        presetName={selectedRtpack ? `${selectedRtpack.split(/[\\\/]/).pop() || selectedRtpack}` : "RTX Pack"}
        onInstall={handleRtpackInstall}
        isInstalling={isProcessing}
      />
    </section>
  );
}

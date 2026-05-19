import { create } from 'zustand';
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from './appStore';
import { useStatusStore } from './statusStore';

interface PresetsStore {
  selectedPreset: string | null;
  installingPresets: Set<string>;
  installModalOpen: boolean;
  installModalPresetUuid: string | null;
  setSelectedPreset: (uuid: string | null) => void;
  handlePresetSelection: (uuid: string, selected: boolean) => void;
  handlePresetInstall: (uuid: string, t: (key: string, options?: any) => string) => Promise<void>;
  openInstallModal: (uuid: string) => void;
  closeInstallModal: () => void;
  handleInstallToSelected: (uuid: string, selectedInstallations: string[], t: (key: string, options?: any) => string) => Promise<void>;
}

export const usePresetsStore = create<PresetsStore>((set) => ({
  selectedPreset: null,
  installingPresets: new Set<string>(),
  installModalOpen: false,
  installModalPresetUuid: null,

  setSelectedPreset: (uuid: string | null) => {
    set({ selectedPreset: uuid });
  },

  handlePresetSelection: (uuid: string, selected: boolean) => {
    set({ selectedPreset: selected ? uuid : null });
  },

  handlePresetInstall: async (uuid: string, t: (key: string, options?: any) => string) => {
    const { selectedInstallations, addConsoleOutput, refreshInstallations } = useAppStore.getState();
    const { addMessage } = useStatusStore.getState();
    
    if (selectedInstallations.size === 0) {
      addMessage({
        message: t("status_select_installation_warning"),
        type: "error",
      });
      return;
    }

    // Add preset to installing set
    set((state) => ({
      installingPresets: new Set(state.installingPresets).add(uuid)
    }));

    try {
      addMessage({ message: t("status_installing_preset"), type: "loading" });
      addConsoleOutput(
        t("log_installing_preset", { uuid, count: selectedInstallations.size })
      );

      for (const installPath of selectedInstallations) {
        addConsoleOutput(t("log_installing_to", { installPath }));
        await invoke("download_and_install_pack", { uuid, selectedNames: [installPath] });
        addConsoleOutput(t("log_installed_to", { installPath }));
      }

      addMessage({ message: t("status_install_success"), type: "success" });
      addConsoleOutput(t("log_install_complete"));
      // Refresh installations to show updated preset info
      await refreshInstallations();
    } catch (error) {
      const errorMsg = t("status_install_error", { error });
      addMessage({ message: errorMsg, type: "error" });
      addConsoleOutput(errorMsg);
    } finally {
      // Remove preset from installing set
      set((state) => {
        const newSet = new Set(state.installingPresets);
        newSet.delete(uuid);
        return { installingPresets: newSet };
      });
    }
  },

  openInstallModal: (uuid: string) => {
    set({ installModalOpen: true, installModalPresetUuid: uuid });
  },

  closeInstallModal: () => {
    set({ installModalOpen: false, installModalPresetUuid: null });
  },

  handleInstallToSelected: async (uuid: string, selectedInstallations: string[], t: (key: string, options?: any) => string) => {
    const { addConsoleOutput, refreshInstallations } = useAppStore.getState();
    const { addMessage } = useStatusStore.getState();
    
    // Add preset to installing set
    set((state) => ({
      installingPresets: new Set(state.installingPresets).add(uuid)
    }));

    try {
      addMessage({ message: t("status_installing_preset"), type: "loading" });
      addConsoleOutput(
        t("log_installing_preset", { uuid, count: selectedInstallations.length })
      );

      for (const installPath of selectedInstallations) {
        addConsoleOutput(t("log_installing_to", { installPath }));
        await invoke("download_and_install_pack", { uuid, selectedNames: [installPath] });
        addConsoleOutput(t("log_installed_to", { installPath }));
      }

      addMessage({ message: t("status_install_success"), type: "success" });
      addConsoleOutput(t("log_install_complete"));
      // Refresh installations to show updated preset info
      await refreshInstallations();
    } catch (error) {
      const errorMsg = t("status_install_error", { error });
      addMessage({ message: errorMsg, type: "error" });
      addConsoleOutput(errorMsg);
    } finally {
      // Remove preset from installing set
      set((state) => {
        const newSet = new Set(state.installingPresets);
        newSet.delete(uuid);
        return { installingPresets: newSet };
      });
    }
  },
}));

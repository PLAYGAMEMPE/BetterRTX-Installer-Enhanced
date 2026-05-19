import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface Installation {
  FriendlyName: string;
  InstallLocation: string;
  Preview: boolean;
  installed_preset?: {
    uuid: string;
    name: string;
    installed_at: string;
    is_creator?: boolean;
  };
}

export interface PackInfo {
  name: string;
  uuid: string;
  stub: string;
  tonemapping: string;
  bloom: string;
}

interface AppState {
  // State
  installations: Installation[];
  presets: PackInfo[];
  selectedInstallations: Set<string>;
  selectedPreset: string | null;
  consoleOutput: string[];
  activeTab: 'installations' | 'presets' | 'actions' | 'creator';
  toolbarOpen: boolean;
  iobitPath: string | null;

  // Actions
  setInstallations: (installations: Installation[]) => void;
  setPresets: (presets: PackInfo[]) => void;
  setSelectedInstallations: (selected: Set<string>) => void;
  setSelectedPreset: (preset: string | null) => void;
  setActiveTab: (tab: 'installations' | 'presets' | 'actions' | 'creator') => void;
  setToolbarOpen: (open: boolean) => void;
  addConsoleOutput: (message: string) => void;
  clearConsole: () => void;
  addInstallation: (installation: Installation) => void;
  removeInstallation: (path: string) => void;
  setIobitPath: (path: string | null) => void;

  // Async actions
  refreshInstallations: () => Promise<void>;
  refreshPresets: (forceRefresh?: boolean) => Promise<void>;
  clearCache: () => Promise<void>;
  installRTX: (installPath: string) => Promise<void>;
  updateOptions: (installPath: string) => Promise<void>;
  backupSupportFiles: (installPath: string) => Promise<void>;
  uninstallRTX: (installPaths: string[]) => Promise<void>;
  refreshIobitPath: () => Promise<void>;
  selectIobitPath: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  installations: [],
  presets: [],
  selectedInstallations: new Set(),
  selectedPreset: null,
  consoleOutput: [],
  activeTab: 'installations',
  toolbarOpen: false,
  iobitPath: null,

  // Setters
  setInstallations: (installations) => set({ installations }),
  setPresets: (presets) => set({ presets }),
  setSelectedInstallations: (selectedInstallations) => set({ selectedInstallations }),
  setSelectedPreset: (selectedPreset) => set({ selectedPreset }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setToolbarOpen: (toolbarOpen) => set({ toolbarOpen }),
  setIobitPath: (iobitPath) => set({ iobitPath }),

  addConsoleOutput: (message) => {
    const timestamp = new Date().toLocaleTimeString();
    set((state) => ({
      consoleOutput: [...state.consoleOutput, `[${timestamp}] ${message}`]
    }));
  },

  clearConsole: () => set({ consoleOutput: [] }),

  addInstallation: (installation) => {
    set((state) => ({
      installations: [...state.installations, installation]
    }));
  },

  removeInstallation: (path) => {
    set((state) => ({
      installations: state.installations.filter(inst => inst.InstallLocation !== path),
      selectedInstallations: new Set([...state.selectedInstallations].filter(p => p !== path))
    }));
  },

  // Async actions
  refreshInstallations: async () => {
    const { addConsoleOutput, setInstallations } = get();
    
    try {
      addConsoleOutput('Scanning for Minecraft installations...');
      
      const data = await invoke<Installation[]>('list_installations');
      setInstallations(data);
      addConsoleOutput(`Found ${data.length} installations`);
    } catch (error) {
      const errorMsg = `Error loading installations: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  refreshPresets: async (forceRefresh = false) => {
    const { addConsoleOutput, setPresets } = get();
    
    try {
      addConsoleOutput('Fetching RTX presets...');
      
      const data = await invoke<PackInfo[]>('list_presets', { forceRefresh });
      setPresets(data);
      addConsoleOutput(`Loaded ${data.length} presets`);
    } catch (error) {
      const errorMsg = `Error loading presets: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  clearCache: async () => {
    const { addConsoleOutput } = get();
    
    try {
      addConsoleOutput('Clearing cache...');
      await invoke('clear_cache');
      addConsoleOutput('Cache cleared successfully');
    } catch (error) {
      const errorMsg = `Error clearing cache: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  installRTX: async (installPath) => {
    const { addConsoleOutput } = get();
    try {
      addConsoleOutput(`Installing RTX DLSS to ${installPath}...`);
      await invoke('install_dlss_for_selected', { selectedNames: [installPath] });
      addConsoleOutput('RTX DLSS installed successfully');
    } catch (error) {
      const errorMsg = `Error installing RTX DLSS: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  updateOptions: async (installPath) => {
    const { addConsoleOutput } = get();
    try {
      addConsoleOutput(`Updating options for ${installPath}...`);
      await invoke('update_options_for_selected', { selectedNames: [installPath] });
      addConsoleOutput('Options updated successfully');
    } catch (error) {
      const errorMsg = `Error updating options: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  backupSupportFiles: async (installPath) => {
    const { addConsoleOutput } = get();
    try {
      addConsoleOutput(`Creating backup for ${installPath}...`);
      const backupDir = await invoke('backup_selected', { destDir: 'C:\\Users\\Public\\Documents', selectedNames: [installPath] });
      addConsoleOutput(`Backup created successfully: ${backupDir}`);
    } catch (error) {
      const errorMsg = `Error creating backup: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },

  uninstallRTX: async (installPaths) => {
    const { addConsoleOutput } = get();
    try {
      addConsoleOutput(`Uninstalling RTX from ${installPaths.length} installation(s)...`);
      await invoke('uninstall_rtx', { selectedNames: installPaths });
      addConsoleOutput('RTX uninstalled successfully');
    } catch (error) {
      const errorMsg = `Error uninstalling RTX: ${error}`;
      addConsoleOutput(errorMsg);
      throw error;
    }
  },

  refreshIobitPath: async () => {
    const { addConsoleOutput, setIobitPath } = get();
    
    try {
      const result = await invoke<string>('check_iobit_unlocker');
      const pathMatch = result.match(/IObit Unlocker found at: (.+)/);
      if (pathMatch) {
        setIobitPath(pathMatch[1]);
        addConsoleOutput('IObit Unlocker detected');
      } else {
        setIobitPath(null);
      }
    } catch (error) {
      setIobitPath(null);
      addConsoleOutput(`IObit Unlocker not found: ${error}`);
    }
  },

  selectIobitPath: async () => {
    const { addConsoleOutput, setIobitPath } = get();
    
    try {
      const selectedPath = await invoke<string | null>('open_iobit_file_dialog');
      if (selectedPath) {
        const result = await invoke<string>('set_iobit_path', { path: selectedPath });
        setIobitPath(selectedPath);
        addConsoleOutput(result);
      }
    } catch (error) {
      const errorMsg = `Error setting IObit path: ${error}`;
      addConsoleOutput(errorMsg);
    }
  },
}));

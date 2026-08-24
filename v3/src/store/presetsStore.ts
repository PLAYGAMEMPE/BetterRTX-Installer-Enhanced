import { create } from 'zustand';
import { useAppStore } from './appStore';
import { useStatusStore } from './statusStore';
import {
  installPreset,
  subscribeToInstallEvents,
  type ProgressEvent,
} from '../ipc/install';

interface PresetsStore {
  selectedPreset: string | null;
  installingPresets: Set<string>;
  installModalOpen: boolean;
  installModalPresetUuid: string | null;
  /** Progreso actual de la instalacion en curso (null si no hay instalacion). */
  installProgress: ProgressEvent | null;

  setSelectedPreset: (uuid: string | null) => void;
  handlePresetSelection: (uuid: string, selected: boolean) => void;
  openInstallModal: (uuid: string) => void;
  closeInstallModal: () => void;
  handleInstallToSelected: (
    uuid: string,
    selectedInstallations: string[],
    t: (key: string, options?: Record<string, unknown>) => string
  ) => Promise<void>;
}

export const usePresetsStore = create<PresetsStore>((set) => ({
  selectedPreset: null,
  installingPresets: new Set<string>(),
  installModalOpen: false,
  installModalPresetUuid: null,
  installProgress: null,

  setSelectedPreset: (uuid) => set({ selectedPreset: uuid }),

  handlePresetSelection: (uuid, selected) =>
    set({ selectedPreset: selected ? uuid : null }),

  openInstallModal: (uuid) =>
    set({ installModalOpen: true, installModalPresetUuid: uuid }),

  closeInstallModal: () =>
    set({ installModalOpen: false, installModalPresetUuid: null }),

  handleInstallToSelected: async (uuid, selectedInstallations, t) => {
    const { addConsoleOutput, refreshInstallations } = useAppStore.getState();
    const { addMessage, removeMessage } = useStatusStore.getState();

    set((state) => ({
      installingPresets: new Set(state.installingPresets).add(uuid),
      installProgress: null,
    }));

    // Suscribirse a eventos de progreso antes de invocar.
    const unsub = await subscribeToInstallEvents({
      onProgress: (ev) => {
        set({ installProgress: ev });
        addConsoleOutput(`[${ev.step}/${ev.total}] ${ev.label}`);
      },
      onLog: (ev) => {
        addConsoleOutput(`[${ev.level.toUpperCase()}] ${ev.message}`);
      },
      onRollback: (ev) => {
        addMessage({ message: `Instalacion revertida: ${ev.reason}`, type: 'error' });
        addConsoleOutput(`[ROLLBACK] ${ev.reason}`);
      },
    });

    let loadingMessageId: string | null = null;
    try {
      loadingMessageId = addMessage({ message: t('status_installing_preset'), type: 'loading' });

      for (const installPath of selectedInstallations) {
        addConsoleOutput(t('log_installing_to', { installPath }));
        await installPreset(installPath, uuid);
        addConsoleOutput(t('log_installed_to', { installPath }));
      }

      addMessage({ message: t('status_install_success'), type: 'success' });
      addConsoleOutput(t('log_install_complete'));
      await refreshInstallations();
    } catch (error) {
      const errorMsg = t('status_install_error', { error });
      addMessage({ message: errorMsg, type: 'error' });
      addConsoleOutput(errorMsg);
    } finally {
      if (loadingMessageId) {
        removeMessage(loadingMessageId);
      }
      unsub();
      set((state) => {
        const next = new Set(state.installingPresets);
        next.delete(uuid);
        return { installingPresets: next, installProgress: null };
      });
    }
  },
}));

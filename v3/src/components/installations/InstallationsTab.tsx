import { useCallback } from "react";
import { useAppStore } from "../../store/appStore";
import InstallationsPanel from "./InstallationsPanel";
import IoBitPanel from "./IoBitPanel";

export default function InstallationsTab() {
  const {
    installations,
    selectedInstallations,
    setSelectedInstallations,
    refreshInstallations,
  } = useAppStore();

  const handleInstallationSelection = useCallback(
    (path: string, selected: boolean): void => {
      const newSet = new Set(selectedInstallations);
      if (selected) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      setSelectedInstallations(newSet);
    },
    [selectedInstallations]
  );

  const handleInstallationAdded = useCallback(async (): Promise<void> => {
    await refreshInstallations();
  }, [refreshInstallations]);

  return (
    <div className="installations-container">
      <InstallationsPanel
        installations={installations}
        selectedInstallations={selectedInstallations}
        onInstallationSelection={handleInstallationSelection}
        onInstallationAdded={handleInstallationAdded}
      />
      
      <IoBitPanel />
    </div>
  );
}

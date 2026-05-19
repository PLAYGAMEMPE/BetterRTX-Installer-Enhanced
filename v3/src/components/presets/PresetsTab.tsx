import { PresetCard } from "./PresetCard";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/appStore";
import { usePresetsStore } from "../../store/presetsStore";
import InstallationInstanceModal from "../installations/InstallationInstanceModal";
import { useState, useMemo } from "react";

export default function PresetsTab() {
  const { t } = useTranslation();
  const { presets, installations } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const {
    selectedPreset,
    installingPresets,
    installModalOpen,
    installModalPresetUuid,
    handlePresetSelection,
    openInstallModal,
    closeInstallModal,
    handleInstallToSelected,
  } = usePresetsStore();

  const onPresetInstall = (uuid: string) => openInstallModal(uuid);

  const handleModalInstall = (selectedInstallations: string[]) => {
    if (installModalPresetUuid) {
      handleInstallToSelected(installModalPresetUuid, selectedInstallations, t);
    }
  };

  const getPresetName = (uuid: string): string => {
    const preset = presets.find((p) => p.uuid === uuid);
    return preset?.name || "Unknown Preset";
  };

  const filteredPresets = useMemo(() => {
    let filtered = presets;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (preset) =>
          preset.name.toLowerCase().includes(query) ||
          preset.stub.toLowerCase().includes(query) ||
          preset.tonemapping.toLowerCase().includes(query) ||
          preset.bloom.toLowerCase().includes(query)
      );
    }

    // Apply version filter
    if (selectedFilter !== "all") {
      filtered = filtered.filter((preset) => {
        // Extract BetterRTX version from preset name
        const versionMatch = preset.name.match(/BetterRTX\s+(\d+\.\d+(?:\.\d+)?)/i);
        
        if (selectedFilter === "other") {
          // Show presets that don't have a BetterRTX version pattern
          return !versionMatch;
        }
        
        if (!versionMatch) {
          return false;
        }
        
        const presetVersion = versionMatch[1];
        
        // Match major.minor version (e.g., "1.4" matches "1.4.0", "1.4.1", etc.)
        return presetVersion.startsWith(selectedFilter);
      });
    }

    return filtered;
  }, [presets, searchQuery, selectedFilter]);

  return (
    <section className="presets-container">
      <div className="section-toolbar flex justify-between items-center mb-4">
        <div className="toolbar-title">
          <h2 className="text-lg font-semibold select-none cursor-default">{t("presets_title")}</h2>
          <span className="text-sm opacity-75 select-none cursor-default">
            {t("presets_loaded_count", { count: filteredPresets.length })} /{" "}
            {presets.length}
          </span>
        </div>
      </div>
      <div className="filter-controls flex gap-3 mb-4">
        <div className="search-input flex-1">
          <input
            type="text"
            placeholder={t("search_presets", "Search presets...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-app-panel border border-app-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
          />
        </div>
        <div className="filter-dropdown">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-3 py-2 bg-app-panel border border-app-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent cursor-pointer"
          >
            <option disabled value="">{t("filter_select", "Select a version")}</option>
            <option value="all">{t("filter_any_version", "Any Version")}</option>
            <option value="1.4">{t("filter_v14", "BetterRTX 1.4")}</option>
            <option value="1.3">{t("filter_v13", "BetterRTX 1.3")}</option>
            <option value="1.2">{t("filter_v12", "BetterRTX 1.2")}</option>
          </select>
        </div>
      </div>
      <div className="presets-list">
        {filteredPresets.length > 0 ? (
          filteredPresets.map((preset) => (
            <PresetCard
              key={preset.uuid}
              preset={preset}
              selected={selectedPreset === preset.uuid}
              isInstalling={installingPresets.has(preset.uuid)}
              onSelectionChange={handlePresetSelection}
              onInstall={onPresetInstall}
            />
          ))
        ) : (
          <div className="empty-state text-center py-8 col-span-full">
            <p>
              {searchQuery || selectedFilter !== "all"
                ? t(
                    "presets_none_match_filter",
                    "No presets match your search criteria"
                  )
                : t("presets_none_available")}
            </p>
            {(searchQuery || selectedFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilter("all");
                }}
                className="mt-2 text-sm text-brand-accent hover:text-brand-accent-600 underline"
              >
                {t("clear_filters", "Clear filters")}
              </button>
            )}
          </div>
        )}
      </div>
      <InstallationInstanceModal
        isOpen={installModalOpen}
        onClose={closeInstallModal}
        installations={installations}
        presetName={
          installModalPresetUuid ? getPresetName(installModalPresetUuid) : ""
        }
        onInstall={handleModalInstall}
        isInstalling={
          installModalPresetUuid
            ? installingPresets.has(installModalPresetUuid)
            : false
        }
      />
    </section>
  );
}

import { useAppStore } from "../store/appStore";
import { useTranslation } from "react-i18next";
import { Settings, X } from "lucide-react";
import { ToolbarSection } from "./ToolbarSection";
import Logo from "./Logo";
import pkg from "../../package.json";
import { open } from "@tauri-apps/plugin-shell";
import cx from "classix";
import { useStatusStore } from "../store/statusStore";
import { memo, useCallback, useMemo } from "react";
import LanguageSelector from "./LanguageSelector";

interface AppHeaderProps {}

function AppHeader({}: AppHeaderProps) {
  const { toolbarOpen, setToolbarOpen, addConsoleOutput } = useAppStore();
  const { t, i18n } = useTranslation();
  const { addMessage } = useStatusStore();
  
  // Memoize version string to prevent unnecessary re-renders
  const versionString = useMemo(() => {
    return t('installer_version', { version: pkg.version });
  }, [t, pkg.version]);
  
  // Memoize toolbar button icon class
  const toolbarButtonClass = useMemo(() => {
    return cx("toolbar-menu-btn border", toolbarOpen ? "border-app-border" : "border-transparent");
  }, [toolbarOpen]);

  const handleVersionClick = useCallback(async () => {
    try {
      await open(`https://github.com/PLAYGAMEMPE/BetterRTX-Installer-Enhanced`);
    } catch (error) {
      console.error('Failed to open release page:', error);
    }
  }, []);

  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value, (err) => {
      if (err) {
        addConsoleOutput('Failed to change language: ' + err);
        addMessage({
          type: 'error',
          message: t('language_change_error', 'Failed to change language'),
        });
      }
    });
  }, [i18n, addConsoleOutput, addMessage, t]);
  
  const handleToggleToolbar = useCallback(() => {
    setToolbarOpen(!toolbarOpen);
  }, [toolbarOpen, setToolbarOpen]);
  
  const handleLogoClick = useCallback(async () => {
    try {
      await open(`https://bedrock.graphics`);
    } catch (error) {
      addConsoleOutput('Failed to launch bedrock.graphics: ' + error);
      addMessage({
        type: 'error',
        message: t('bedrock_graphics_open_error', 'Failed to launch bedrock.graphics'),
      });
    }
  }, []);
  
  return (
    <header className="top-toolbar">
      <div className="toolbar-left">
        <Logo width={163} height={32} onClick={handleLogoClick} />
      </div>

      <div className="toolbar-right">
        <button 
          className="app-version app-version--link" 
          onClick={handleVersionClick}
          title={t('open_release_page', 'Open release page on GitHub')}
        >
          {versionString}
        </button>
        {/* Menu button to show toolbar */}
        <button
          id="toolbar-menu-btn"
          className={toolbarButtonClass}
          onClick={handleToggleToolbar}
          aria-expanded={toolbarOpen}
          aria-controls="toolbar-popover"
        >
          {toolbarOpen ? <X size={16} /> : <Settings size={16} />}
        </button>

        {/* Toolbar popover */}
        <div
          id="toolbar-popover"
          className={`toolbar-popover ${toolbarOpen ? "block" : "hidden"}`}
          role="dialog"
          aria-modal="false"
          aria-label={t("toolbar_options_label")}
        >
          <ToolbarSection />
        </div>

        <LanguageSelector
          currentLanguage={i18n.resolvedLanguage ?? i18n.language}
          onLanguageChange={handleLanguageChange}
          translatorDebugLabel={t("translator_debug")}
        />
      </div>
    </header>
  );
}

export default memo(AppHeader);

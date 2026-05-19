import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { StatusBarContainer } from "./StatusBar";
import { ConsolePanel } from "./ConsolePanel";
import { RtpackDialog } from "./RtpackDialog";
import { DeepLinkDialog } from "./DeepLinkDialog";
import { useAppStore } from "../store/appStore";
import AppHeader from "./AppHeader";
import ActionsTab from "./actions/ActionsTab";
import PresetsTab from "./presets/PresetsTab";
import CreatorTab from "./creator/CreatorTab";
import { SideNav } from "./ui/SideNav";
import InstallationNav from "./installations/InstallationNav";
import InstallationsTab from "./installations/InstallationsTab";
import DropzoneIndicator from "./ui/DropzoneIndicator";
import { cx } from "classix";

const App: React.FC = () => {
  const [rtpackDialogOpen, setRtpackDialogOpen] = useState(false);
  const [rtpackPath, setRtpackPath] = useState("");
  const [deepLinkDialogOpen, setDeepLinkDialogOpen] = useState(false);
  const [deepLinkUrl, setDeepLinkUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [animateTabs, setAnimateTabs] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const {
    consoleOutput,
    activeTab,
    clearConsole,
    refreshInstallations,
    refreshPresets,
  } = useAppStore();

  const handleRtpackDialogClose = useCallback(() => {
    setRtpackDialogOpen(false);
  }, []);

  const handleDeepLinkDialogClose = useCallback(() => {
    setDeepLinkDialogOpen(false);
  }, []);

  const tabClasses = useMemo(() => {
    const getBaseClass = (tabName: string) => {
      const isActive = activeTab === tabName;
      return cx(
        "tab-panel w-full",
        isActive ? (animateTabs ? "block tab-view" : "block") : "hidden"
      );
    };

    return {
      installations: getBaseClass("installations"),
      presets: getBaseClass("presets"),
      actions: getBaseClass("actions"),
      creator: getBaseClass("creator"),
    };
  }, [activeTab, animateTabs]);

  useEffect(() => {
    refreshInstallations();
    refreshPresets();
  }, [refreshInstallations, refreshPresets]);

  // Listen for rtpack file open events
  useEffect(() => {
    const unlisten = listen("rtpack-file-opened", (event) => {
      // In Tauri v2, the payload is accessed directly from the event
      const filePath = typeof event.payload === 'string' ? event.payload : '';
      console.log('RTpack file opened:', filePath);
      setRtpackPath(filePath);
      setRtpackDialogOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Enable tab transition animations after initial mount only
  useEffect(() => {
    setAnimateTabs(true);
  }, []);

  // Listen for deep link protocol events
  useEffect(() => {
    const unlisten = listen("deep-link-received", (event) => {
      // In Tauri v2, the payload is accessed directly from the event
      const url = typeof event.payload === 'string' ? event.payload : '';
      console.log('Deep link received:', url);
      setDeepLinkUrl(url);
      setDeepLinkDialogOpen(true);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle drag-n-drop indicator and file drops
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      const webview = getCurrentWebview();
      unlisten = await webview.onDragDropEvent((event) => {
        if (event.payload.type === 'enter') {
          setIsDragging(true);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          const paths = event.payload.paths || [];
          for (const path of paths) {
            if (path.toLowerCase().endsWith(".rtpack")) {
              setRtpackPath(path);
              setRtpackDialogOpen(true);
              break;
            }
          }
        } else if (event.payload.type === 'leave') {
          setIsDragging(false);
        }
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div className="app">
      <DropzoneIndicator isDragging={isDragging} />

      {/* Top Header */}
      <AppHeader />
      <div className="app-with-sidebar">
        {/* Sidebar Navigation */}
        <nav className="app-sidebar">
          <SideNav>
            <InstallationNav />
          </SideNav>
        </nav>

        {/* Main Application Area */}
        <div className="app-main">
          <StatusBarContainer />

          {/* Main Content Area */}
          <main className="app-content">
            <div className="main-content">
              {/* Tab Content */}
              <div className="tab-content flex flex-col gap-2">
                <div
                  className={tabClasses.installations}
                >
                  <InstallationsTab />
                </div>

                <div
                  className={tabClasses.presets}
                >
                  <PresetsTab />
                </div>

                <div
                  className={tabClasses.actions}
                >
                  <ActionsTab />
                </div>

                <div
                  className={tabClasses.creator}
                >
                  <CreatorTab />
                </div>
              </div>
            </div>
          </main>

          {/* Fixed Console Panel at bottom */}
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <ConsolePanel
              isExpanded={isConsoleExpanded}
              onToggle={setIsConsoleExpanded}
              output={consoleOutput}
              onClear={clearConsole}
            />
          </div>
        </div>

        {/* RTpack Dialog */}
        <RtpackDialog
          isOpen={rtpackDialogOpen}
          rtpackPath={rtpackPath}
          onClose={handleRtpackDialogClose}
        />

        {/* Deep Link Dialog */}
        <DeepLinkDialog
          isOpen={deepLinkDialogOpen}
          deepLinkUrl={deepLinkUrl}
          onClose={handleDeepLinkDialogClose}
        />
      </div>
    </div>
  );
};

export const MemoizedApp = memo(App);

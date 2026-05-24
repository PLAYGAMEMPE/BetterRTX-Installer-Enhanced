import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Archive, RotateCcw } from "lucide-react";
import Button from "../ui/Button";
import { Installation } from "./InstallationCard";
import { useStatusStore } from "../../store/statusStore";

interface BackupEntry {
  session_id: string;
  created_at: string;
  backup_dir: string;
  mechanism: string;
  file_count: number;
}

interface BackupsModalProps {
  installation: Installation | null;
  onClose: () => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const mechanismLabel = (m: string) =>
  m === "indexRedirect" ? "Index Redirect" : "Direct Overwrite";

export default function BackupsModal({ installation, onClose }: Readonly<BackupsModalProps>) {
  const { t } = useTranslation();
  const { addMessage } = useStatusStore();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!installation) return;
    setLoading(true);
    invoke<BackupEntry[]>("list_backups", { installLocation: installation.InstallLocation })
      .then(setBackups)
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  }, [installation]);

  const handleRestore = async (backup: BackupEntry) => {
    if (!installation) return;
    setRestoringId(backup.session_id);
    try {
      await invoke("restore_vanilla", { installLocation: installation.InstallLocation });
      addMessage({ message: t("backup_restored_success"), type: "success" });
      onClose();
    } catch (error) {
      addMessage({ message: t("backup_restore_error", { error: String(error) }), type: "error" });
    } finally {
      setRestoringId(null);
    }
  };

  if (!installation) return null;

  return createPortal(
    <div
      className="dialog-overlay"
      style={{ left: "16rem", backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="dialog" style={{ maxHeight: "none", margin: "1.5rem", minWidth: "32rem" }}>
        <div className="dialog__header">
          <div className="flex items-center gap-2">
            <Archive size={18} />
            <h2 className="dialog__title">{t("backups_title")}</h2>
          </div>
          <button className="dialog__close" onClick={onClose} type="button">×</button>
        </div>

        <div className="dialog__content" style={{ flex: "none", overflow: "visible" }}>
          <p className="text-sm text-app-muted mb-3 select-none">
            {installation.FriendlyName}
          </p>

          {loading && (
            <p className="text-sm text-app-muted text-center py-4">{t("loading")}</p>
          )}

          {!loading && backups.length === 0 && (
            <p className="text-sm text-app-muted text-center py-4">{t("backups_none_found")}</p>
          )}

          {!loading && backups.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {backups.map((b) => (
                <div
                  key={b.session_id}
                  className="flex items-center justify-between gap-3 rounded border border-app-border/40 bg-app-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{formatDate(b.created_at)}</p>
                    <p className="text-xs text-app-muted">
                      {mechanismLabel(b.mechanism)} · {t("backup_files_count", { count: b.file_count })}
                    </p>
                  </div>
                  <Button
                    theme="secondary"
                    size="sm"
                    disabled={restoringId !== null}
                    onClick={() => handleRestore(b)}
                  >
                    {restoringId === b.session_id ? (
                      t("restoring_backup")
                    ) : (
                      <span className="flex items-center gap-1">
                        <RotateCcw size={13} />
                        {t("restore_backup")}
                      </span>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog__actions">
          <Button theme="secondary" onClick={onClose}>{t("cancel")}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import { Installation } from "./InstallationCard";
import { useStatusStore } from "../../store/statusStore";
import { BackupEntry, listBackups, restoreBackupSession, deleteBackup } from "../../ipc/install";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshBackups = useCallback(() => {
    if (!installation) return;
    setLoading(true);
    listBackups(installation.InstallLocation)
      .then(setBackups)
      .catch(() => setBackups([]))
      .finally(() => setLoading(false));
  }, [installation]);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  const handleRestore = async (backup: BackupEntry) => {
    if (!installation) return;
    setRestoringId(backup.sessionId);
    try {
      await restoreBackupSession(installation.InstallLocation, backup.sessionId);
      addMessage({ message: t("backup_restored_success"), type: "success" });
      onClose();
    } catch (error) {
      addMessage({ message: t("backup_restore_error", { error: String(error) }), type: "error" });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (backup: BackupEntry) => {
    if (!installation) return;
    if (!window.confirm(t("backup_delete_confirm"))) return;
    setDeletingId(backup.sessionId);
    try {
      await deleteBackup(installation.InstallLocation, backup.sessionId);
      addMessage({ message: t("backup_deleted_success"), type: "success" });
      setBackups((prev) => prev.filter((b) => b.sessionId !== backup.sessionId));
    } catch (error) {
      addMessage({ message: t("backup_delete_error", { error: String(error) }), type: "error" });
    } finally {
      setDeletingId(null);
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
                  key={b.sessionId}
                  className="flex items-center justify-between gap-3 rounded border border-app-border/40 bg-app-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{formatDate(b.createdAt)}</p>
                    <p className="text-xs text-app-muted">
                      {mechanismLabel(b.mechanism)} · {t("backup_files_count", { count: b.fileCount })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      theme="secondary"
                      size="sm"
                      disabled={restoringId !== null || deletingId !== null}
                      onClick={() => handleRestore(b)}
                    >
                      {restoringId === b.sessionId ? (
                        t("restoring_backup")
                      ) : (
                        <span className="flex items-center gap-1">
                          <RotateCcw size={13} />
                          {t("restore_backup")}
                        </span>
                      )}
                    </Button>
                    <Button
                      theme="danger"
                      size="sm"
                      disabled={restoringId !== null || deletingId !== null}
                      onClick={() => handleDelete(b)}
                    >
                      {deletingId === b.sessionId ? (
                        t("deleting_backup")
                      ) : (
                        <span className="flex items-center gap-1">
                          <Trash2 size={13} />
                          {t("delete_backup")}
                        </span>
                      )}
                    </Button>
                  </div>
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

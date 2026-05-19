//! Inicializacion del logging estructurado con `tracing`.
//!
//! Escribe a `logs/install.log` (rotacion diaria) ademas de la consola.
//! El guard del appender no bloqueante se conserva vivo en un `OnceLock`
//! durante toda la vida del proceso.

use std::path::PathBuf;
use std::sync::OnceLock;
use tracing_appender::non_blocking::WorkerGuard;

static GUARD: OnceLock<WorkerGuard> = OnceLock::new();

/// Inicializa el subscriber global de `tracing`.
///
/// Es idempotente: si ya hay un subscriber instalado, no hace nada.
/// `log_dir` es la carpeta donde se escribira `install.log`.
pub fn init(log_dir: PathBuf) {
    if GUARD.get().is_some() {
        return;
    }

    if let Err(e) = std::fs::create_dir_all(&log_dir) {
        eprintln!("No se pudo crear el directorio de logs {log_dir:?}: {e}");
        return;
    }

    let file_appender = tracing_appender::rolling::daily(&log_dir, "install.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    let _ = GUARD.set(guard);

    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    let result = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(false)
        .try_init();

    match result {
        Ok(()) => tracing::info!("Logging inicializado en {log_dir:?}"),
        Err(e) => eprintln!("tracing ya estaba inicializado: {e}"),
    }
}

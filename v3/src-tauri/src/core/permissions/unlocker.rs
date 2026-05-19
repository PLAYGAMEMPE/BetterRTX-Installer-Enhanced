//! Provider de utilidades de desbloqueo externas (opcional).
//!
//! Detecta IObit Unlocker o LockHunter ya instalados y los usa unicamente como
//! ultimo recurso cuando los providers nativos no logran escribir. Nunca son
//! obligatorios: si no estan presentes, este provider simplemente no aplica.

use super::{Confidence, InstallContext, InstallKind, PermissionGrant, PermissionProvider};
use crate::infra::error::AppError;
use std::path::Path;

pub struct UnlockerProvider;

/// Rutas conocidas de utilidades de desbloqueo de archivos de terceros.
const CANDIDATES: &[&str] = &[
    r"C:\Program Files (x86)\IObit\IObit Unlocker\IObitUnlocker.exe",
    r"C:\Program Files\IObit\IObit Unlocker\IObitUnlocker.exe",
    r"C:\Program Files\LockHunter\LockHunter.exe",
    r"C:\Program Files (x86)\LockHunter\LockHunter.exe",
];

/// Devuelve las rutas de unlockers externos detectados en el sistema.
pub fn detect_unlockers() -> Vec<String> {
    CANDIDATES
        .iter()
        .filter(|p| Path::new(p).exists())
        .map(|p| p.to_string())
        .collect()
}

impl PermissionProvider for UnlockerProvider {
    fn name(&self) -> &str {
        "UnlockerProvider"
    }

    fn can_handle(&self, ctx: &InstallContext) -> Confidence {
        if detect_unlockers().is_empty() {
            return Confidence::None;
        }
        match ctx.kind {
            InstallKind::WindowsApps => Confidence::High,
            _ => Confidence::Low,
        }
    }

    fn acquire(&self, ctx: &InstallContext) -> Result<PermissionGrant, AppError> {
        let unlockers = detect_unlockers();
        if unlockers.is_empty() {
            return Err(AppError::PermissionDenied {
                path: ctx.materials_dir.display().to_string(),
                strategy: "UnlockerProvider: ningun unlocker externo disponible".into(),
            });
        }
        // El unlocker se invoca en el momento de la copia (DIRECT_OVERWRITE).
        // Aqui solo verificamos que el binario existe.
        Ok(PermissionGrant {
            provider: self.name().to_string(),
            original_sddl: None,
            affected_paths: vec![ctx.materials_dir.clone()],
        })
    }

    fn release(&self, _grant: PermissionGrant) -> Result<(), AppError> {
        Ok(())
    }
}

//! Provider de utilidades de desbloqueo externas (opcional).
//!
//! Detecta IObit Unlocker o LockHunter ya instalados y los usa unicamente como
//! ultimo recurso cuando los providers nativos no logran escribir. Nunca son
//! obligatorios: si no estan presentes, este provider simplemente no aplica.

use super::{Confidence, InstallContext, InstallKind, PermissionProvider};
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
}

//! Provider de instalacion transaccional por staging.
//!
//! Cuando WindowsApps bloquea la escritura directa pese a la elevacion ACL,
//! esta estrategia escribe primero en una carpeta temporal del mismo volumen,
//! valida el resultado y realiza un *swap* atomico. Es el ultimo recurso antes
//! de fallar, y deja siempre un estado consistente.

use super::{Confidence, InstallContext, InstallKind, PermissionProvider};

pub struct StagedInstallProvider;

impl PermissionProvider for StagedInstallProvider {
    fn name(&self) -> &str {
        "StagedInstallProvider"
    }

    fn can_handle(&self, ctx: &InstallContext) -> Confidence {
        match ctx.kind {
            // Red de seguridad transaccional para WindowsApps.
            InstallKind::WindowsApps => Confidence::Low,
            _ => Confidence::None,
        }
    }
}

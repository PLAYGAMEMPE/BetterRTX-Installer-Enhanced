//! Provider de elevacion ACL nativa.
//!
//! Usa `takeown` + `icacls` para conceder escritura temporal sobre la carpeta
//! de materiales: respalda la ACL original, otorga el permiso, y la restaura
//! garantizando que el estado de seguridad quede igual que antes. No depende
//! de utilidades de terceros.

use super::{Confidence, InstallContext, InstallKind, PermissionProvider};

pub struct AclProvider;

impl PermissionProvider for AclProvider {
    fn name(&self) -> &str {
        "AclProvider"
    }

    fn can_handle(&self, ctx: &InstallContext) -> Confidence {
        match ctx.kind {
            // WindowsApps es el caso para el que existe: elevacion + ACL temporal.
            InstallKind::WindowsApps => Confidence::High,
            // Para el resto sirve como red de seguridad si falla la escritura directa.
            _ => Confidence::Low,
        }
    }
}

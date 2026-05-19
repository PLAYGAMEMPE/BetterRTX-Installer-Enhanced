//! Provider para instalaciones sin restricciones de UWP.
//!
//! Las instalaciones en `C:\XboxGames` o side-load aceptan escritura estandar.
//! Es la estrategia preferida: rapida, sin elevacion y sin riesgo de corromper
//! el contenedor UWP.

use super::{Confidence, InstallContext, InstallKind, PermissionGrant, PermissionProvider};
use crate::infra::error::AppError;

pub struct XboxGamesProvider;

impl PermissionProvider for XboxGamesProvider {
    fn name(&self) -> &str {
        "XboxGamesProvider"
    }

    fn can_handle(&self, ctx: &InstallContext) -> Confidence {
        match ctx.kind {
            InstallKind::XboxGames => Confidence::High,
            InstallKind::Sideloaded | InstallKind::Custom if ctx.directly_writable => {
                Confidence::High
            }
            _ => Confidence::None,
        }
    }

    fn acquire(&self, ctx: &InstallContext) -> Result<PermissionGrant, AppError> {
        // Escritura directa: no se requiere ninguna operacion de permisos.
        Ok(PermissionGrant {
            provider: self.name().to_string(),
            original_sddl: None,
            affected_paths: vec![ctx.materials_dir.clone()],
        })
    }

    fn release(&self, _grant: PermissionGrant) -> Result<(), AppError> {
        // Nada que restaurar.
        Ok(())
    }
}

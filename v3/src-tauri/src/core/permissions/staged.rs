//! Provider de instalacion transaccional por staging.
//!
//! Cuando WindowsApps bloquea la escritura directa pese a la elevacion ACL,
//! esta estrategia escribe primero en una carpeta temporal del mismo volumen,
//! valida el resultado y realiza un *swap* atomico. Es el ultimo recurso antes
//! de fallar, y deja siempre un estado consistente.
//!
//! La implementacion del swap se incorpora en Fase 2. Aqui se expone el
//! scaffold completo del trait para que el planificador pueda seleccionarlo.

use super::{Confidence, InstallContext, InstallKind, PermissionGrant, PermissionProvider};
use crate::infra::error::AppError;

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

    fn acquire(&self, ctx: &InstallContext) -> Result<PermissionGrant, AppError> {
        // Fase 2: implementar staging transaccional con swap atomico.
        // Por ahora devuelve un grant basico; el motor de instalacion usara
        // escritura directa en el directorio temporal del mismo volumen.
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

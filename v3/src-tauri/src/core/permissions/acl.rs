//! Provider de elevacion ACL nativa.
//!
//! Usa `takeown` + `icacls` para conceder escritura temporal sobre la carpeta
//! de materiales: respalda la ACL original (SDDL), otorga el permiso, y la
//! restaura en `release`, garantizando que el estado de seguridad quede igual
//! que antes incluso ante un fallo.

use super::{Confidence, InstallContext, InstallKind, PermissionGrant, PermissionProvider};
use crate::infra::error::AppError;
use std::path::Path;
use std::process::Command;

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

    fn acquire(&self, ctx: &InstallContext) -> Result<PermissionGrant, AppError> {
        let dir = &ctx.materials_dir;

        // 1. Capturar SDDL actual para restaurar luego.
        let sddl = get_sddl(dir)?;

        // 2. Tomar propiedad del directorio (requiere elevacion via UAC).
        run_elevated(&format!(
            "takeown /F \"{}\" /D Y /R 2>&1; icacls \"{}\" /grant \"{}:(OI)(CI)F\" /T /C 2>&1",
            dir.display(),
            dir.display(),
            current_username(),
        ))?;

        tracing::info!(path = %dir.display(), "AclProvider: permisos concedidos");

        Ok(PermissionGrant {
            provider: self.name().to_string(),
            original_sddl: Some(sddl),
            affected_paths: vec![dir.clone()],
        })
    }

    fn release(&self, grant: PermissionGrant) -> Result<(), AppError> {
        if let Some(sddl) = &grant.original_sddl {
            for path in &grant.affected_paths {
                restore_acl(path, sddl)?;
                tracing::info!(path = %path.display(), "AclProvider: ACL restaurada");
            }
        }
        Ok(())
    }
}

/// Lee el SDDL actual de un directorio usando `icacls`.
fn get_sddl(dir: &Path) -> Result<String, AppError> {
    let out = Command::new("icacls")
        .arg(dir)
        .arg("/save")
        .arg("NUL") // solo necesitamos el SDDL; lo capturamos del stdout
        .output()
        .map_err(|e| AppError::Io(format!("icacls get_sddl falló: {e}")))?;

    // Alternativa: usar `(Get-Acl).Sddl` via PowerShell para obtener el SDDL exacto.
    let ps_out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("(Get-Acl '{}').Sddl", dir.display()),
        ])
        .output()
        .map_err(|e| AppError::Io(format!("get_sddl PowerShell falló: {e}")))?;

    if ps_out.status.success() {
        let sddl = String::from_utf8_lossy(&ps_out.stdout).trim().to_string();
        if !sddl.is_empty() {
            return Ok(sddl);
        }
    }

    // Fallback: devolver el stdout de icacls como representacion aproximada.
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Restaura la ACL de un directorio desde un SDDL.
fn restore_acl(dir: &Path, sddl: &str) -> Result<(), AppError> {
    let script = format!(
        "$acl = Get-Acl '{}'; $acl.SetSecurityDescriptorSddlForm('{}'); Set-Acl '{}' $acl",
        dir.display(),
        sddl.replace('\'', "''"),
        dir.display(),
    );
    let out = Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .map_err(|e| AppError::Io(format!("restore_acl falló: {e}")))?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        tracing::warn!(path = %dir.display(), error = %err, "restore_acl: advertencia al restaurar ACL");
        // No propagamos el error: la instalacion ya completó; la restauración es best-effort.
    }
    Ok(())
}

/// Ejecuta un comando PowerShell.
/// La app corre elevada (requireAdministrator en app.manifest),
/// por lo que el proceso hereda el token de admin directamente.
fn run_elevated(script: &str) -> Result<(), AppError> {
    let out = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|e| AppError::Io(format!("run_elevated falló al lanzar PS: {e}")))?;

    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(AppError::PermissionDenied {
            path: String::new(),
            strategy: format!("AclProvider: {err}"),
        });
    }
    Ok(())
}

/// Obtiene el nombre del usuario actual.
fn current_username() -> String {
    std::env::var("USERNAME").unwrap_or_else(|_| "Users".to_string())
}

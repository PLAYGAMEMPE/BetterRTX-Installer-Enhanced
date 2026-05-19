//! Adaptive Hybrid Permission System.
//!
//! Selecciona dinamicamente como obtener permisos de escritura sobre la
//! carpeta de materiales de Minecraft, segun un escaneo real del entorno.
//! Cada estrategia es un *provider* desacoplado que implementa
//! [`PermissionProvider`]:
//!
//! - [`xbox::XboxGamesProvider`]     instalaciones sin restricciones (preferido).
//! - [`acl::AclProvider`]            elevacion ACL temporal nativa (takeown/icacls).
//! - [`unlocker::UnlockerProvider`]  utilidades externas opcionales (IObit/LockHunter).
//! - [`staged::StagedInstallProvider`] instalacion transaccional por staging/swap.
//! - [`recovery`]                    journal de mutaciones para rollback/recovery.

pub mod acl;
pub mod recovery;
pub mod staged;
pub mod unlocker;
pub mod xbox;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::infra::error::AppError;

/// Confianza de un provider para resolver un contexto dado.
/// El orden de declaracion define el orden natural: `None` < `Low` < `High`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Confidence {
    None,
    Low,
    High,
}

/// Tipo de instalacion de Minecraft Bedrock detectada.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InstallKind {
    /// `C:\XboxGames\...` — escritura estandar, sin elevacion.
    XboxGames,
    /// `C:\Program Files\WindowsApps\...` — UWP protegido.
    WindowsApps,
    /// BedrockLauncher / MCLauncher u otros side-load.
    Sideloaded,
    /// Ruta personalizada elegida por el usuario.
    Custom,
}

/// Contexto que describe una instalacion concreta a la que se aplicara un preset.
#[derive(Debug, Clone)]
pub struct InstallContext {
    #[allow(dead_code)]
    pub install_location: PathBuf,
    pub materials_dir: PathBuf,
    pub kind: InstallKind,
    /// `true` si la carpeta de materiales acepta escritura directa sin elevacion.
    pub directly_writable: bool,
}

/// Token que representa permisos activos sobre la carpeta de materiales.
///
/// Se debe pasar a `release` cuando la instalacion termine (exitosa o no),
/// para restaurar el estado de seguridad previo.
#[derive(Debug)]
pub struct PermissionGrant {
    /// Nombre del provider que emitio el grant.
    pub provider: String,
    /// SDDL de la ACL original, si el provider la modifico (AclProvider).
    pub original_sddl: Option<String>,
    /// Rutas afectadas por el grant (usadas en release para restaurar).
    pub affected_paths: Vec<PathBuf>,
}

/// Estrategia desacoplada para obtener permisos de escritura.
pub trait PermissionProvider: Send + Sync {
    /// Nombre estable del provider.
    fn name(&self) -> &str;

    /// Confianza con la que este provider puede manejar el contexto dado.
    fn can_handle(&self, ctx: &InstallContext) -> Confidence;

    /// Obtiene permisos de escritura sobre la carpeta de materiales.
    ///
    /// Implementaciones deben ser idempotentes y siempre emitir un `PermissionGrant`
    /// que permita a `release` restaurar el estado original.
    fn acquire(&self, ctx: &InstallContext) -> Result<PermissionGrant, AppError>;

    /// Libera los permisos adquiridos y restaura el estado de seguridad original.
    fn release(&self, grant: PermissionGrant) -> Result<(), AppError>;
}

/// Resultado de la seleccion dinamica de estrategia de permisos.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRecommendation {
    /// Provider recomendado como primera opcion.
    pub provider: String,
    /// Confianza del provider recomendado.
    pub confidence: Confidence,
    /// Otros providers viables, en orden de prioridad descendente.
    pub alternatives: Vec<String>,
}

/// Lista de providers en orden de prioridad (mas seguro primero).
fn providers() -> Vec<Box<dyn PermissionProvider>> {
    vec![
        Box::new(xbox::XboxGamesProvider),
        Box::new(acl::AclProvider),
        Box::new(unlocker::UnlockerProvider),
        Box::new(staged::StagedInstallProvider),
    ]
}

/// Selecciona el mejor provider para el contexto dado.
///
/// Ordena por confianza descendente; ante empate respeta el orden de prioridad
/// de [`providers`] (el ordenamiento es estable).
pub fn recommend(ctx: &InstallContext) -> ProviderRecommendation {
    let mut scored: Vec<(String, Confidence)> = providers()
        .iter()
        .map(|p| (p.name().to_string(), p.can_handle(ctx)))
        .collect();
    scored.sort_by(|a, b| b.1.cmp(&a.1));

    let (provider, confidence) = scored
        .first()
        .cloned()
        .unwrap_or_else(|| ("none".to_string(), Confidence::None));

    let alternatives = scored
        .iter()
        .skip(1)
        .filter(|(_, c)| *c > Confidence::None)
        .map(|(n, _)| n.clone())
        .collect();

    ProviderRecommendation {
        provider,
        confidence,
        alternatives,
    }
}

/// Instancia el provider por nombre para usarlo en acquire/release.
pub fn provider_by_name(name: &str) -> Option<Box<dyn PermissionProvider>> {
    match name {
        "XboxGamesProvider" => Some(Box::new(xbox::XboxGamesProvider)),
        "AclProvider" => Some(Box::new(acl::AclProvider)),
        "UnlockerProvider" => Some(Box::new(unlocker::UnlockerProvider)),
        "StagedInstallProvider" => Some(Box::new(staged::StagedInstallProvider)),
        _ => None,
    }
}

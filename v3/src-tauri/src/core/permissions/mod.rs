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
///
/// `install_location` y `materials_dir` los consumira `acquire` en Fase 1.2.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct InstallContext {
    pub install_location: PathBuf,
    pub materials_dir: PathBuf,
    pub kind: InstallKind,
    /// `true` si la carpeta de materiales acepta escritura directa sin elevacion.
    pub directly_writable: bool,
}

/// Estrategia desacoplada para obtener permisos de escritura.
///
/// Nota: `acquire`/`release` se incorporan en la siguiente iteracion (Fase 1.2).
/// En esta fase los providers exponen `can_handle`, que alimenta el escaneo de
/// capacidades y la seleccion dinamica de estrategia.
pub trait PermissionProvider {
    /// Nombre estable del provider.
    fn name(&self) -> &str;
    /// Confianza con la que este provider puede manejar el contexto dado.
    fn can_handle(&self, ctx: &InstallContext) -> Confidence;
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

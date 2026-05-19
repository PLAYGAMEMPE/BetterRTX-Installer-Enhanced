//! Logica de negocio del instalador, desacoplada de Tauri para ser testeable.
//!
//! - [`backup`]        backup verificado con manifest SHA256 + restauracion a vanilla.
//! - [`compatibility`] verificacion de compatibilidad antes de instalar.
//! - [`detection`]     escaneo de capacidades del entorno de instalacion.
//! - [`diagnostics`]   informe de salud del sistema + instalacion.
//! - [`installer`]     motor hibrido: INDEX_REDIRECT + fallback DIRECT_OVERWRITE.
//! - [`integrity`]     verificacion de integridad SHA256.
//! - [`permissions`]   sistema adaptativo de permisos por providers modulares.

pub mod backup;
pub mod compatibility;
pub mod detection;
pub mod diagnostics;
pub mod installer;
pub mod integrity;
pub mod permissions;

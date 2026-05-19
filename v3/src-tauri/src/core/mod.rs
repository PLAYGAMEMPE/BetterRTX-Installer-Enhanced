//! Logica de negocio del instalador, desacoplada de Tauri para ser testeable.
//!
//! - [`backup`]      backup verificado con manifest SHA256 + restauracion a vanilla.
//! - [`detection`]   escaneo de capacidades del entorno de instalacion.
//! - [`installer`]   motor hibrido: INDEX_REDIRECT + fallback DIRECT_OVERWRITE.
//! - [`integrity`]   verificacion de integridad SHA256.
//! - [`permissions`] sistema adaptativo de permisos por providers modulares.

pub mod backup;
pub mod detection;
pub mod installer;
pub mod integrity;
pub mod permissions;

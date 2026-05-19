//! Logica de negocio del instalador, desacoplada de Tauri para ser testeable.
//!
//! - [`detection`]  escaneo de capacidades del entorno de instalacion.
//! - [`integrity`]  verificacion de integridad SHA256.
//! - [`permissions`] sistema adaptativo de permisos por providers modulares.

pub mod detection;
pub mod integrity;
pub mod permissions;

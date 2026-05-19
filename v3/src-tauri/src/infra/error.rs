//! Error tipado de la aplicacion.
//!
//! Reemplaza el `Result<T, String>` plano del instalador oficial v3 por un
//! enum con codigo estable, mensaje legible, indicador de recuperabilidad y
//! una accion sugerida. Se serializa hacia el frontend como:
//!
//! ```json
//! { "code": "...", "message": "...", "recoverable": true, "suggestedAction": "..." }
//! ```

use serde::ser::{Serialize, SerializeStruct, Serializer};
use std::fmt;

/// Error de dominio de BetterRTX Easy Installer.
///
/// Taxonomia completa de errores; algunas variantes se construyen a partir de
/// Fase 1 (motor de instalacion y compatibility engine).
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum AppError {
    /// No se detecto ninguna instalacion de Minecraft Bedrock.
    MinecraftNotFound,
    /// El sistema bloqueo la escritura en la ruta indicada.
    PermissionDenied { path: String, strategy: String },
    /// El hash SHA256 de un archivo no coincide con el esperado.
    IntegrityMismatch { file: String, expected: String, got: String },
    /// La version del juego y el preset no son compatibles.
    IncompatibleVersion { game: String, preset: String },
    /// Fallo de red al contactar bedrock.graphics o GitHub.
    Network(String),
    /// Fallo de entrada/salida sobre el sistema de archivos.
    Io(String),
    /// Se ejecuto un rollback para dejar el sistema en estado consistente.
    RollbackPerformed { reason: String },
    /// Error generico no clasificado.
    Other(String),
}

impl AppError {
    /// Codigo estable para telemetria y manejo programatico en el frontend.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::MinecraftNotFound => "MINECRAFT_NOT_FOUND",
            AppError::PermissionDenied { .. } => "PERMISSION_DENIED",
            AppError::IntegrityMismatch { .. } => "INTEGRITY_MISMATCH",
            AppError::IncompatibleVersion { .. } => "INCOMPATIBLE_VERSION",
            AppError::Network(_) => "NETWORK_ERROR",
            AppError::Io(_) => "IO_ERROR",
            AppError::RollbackPerformed { .. } => "ROLLBACK_PERFORMED",
            AppError::Other(_) => "UNKNOWN_ERROR",
        }
    }

    /// Mensaje legible para el usuario final.
    pub fn message(&self) -> String {
        match self {
            AppError::MinecraftNotFound => {
                "No se detecto ninguna instalacion de Minecraft Bedrock.".into()
            }
            AppError::PermissionDenied { path, strategy } => format!(
                "Permiso denegado al escribir en '{path}' (estrategia: {strategy})."
            ),
            AppError::IntegrityMismatch { file, expected, got } => format!(
                "El archivo '{file}' esta corrupto: SHA256 esperado {expected}, obtenido {got}."
            ),
            AppError::IncompatibleVersion { game, preset } => format!(
                "El preset '{preset}' no es compatible con la version de Minecraft '{game}'."
            ),
            AppError::Network(e) => format!("Error de red: {e}"),
            AppError::Io(e) => format!("Error de archivo: {e}"),
            AppError::RollbackPerformed { reason } => format!(
                "Se revirtio la instalacion para proteger tu juego. Motivo: {reason}"
            ),
            AppError::Other(e) => e.clone(),
        }
    }

    /// Indica si el usuario puede reintentar o recuperar la operacion.
    pub fn recoverable(&self) -> bool {
        match self {
            AppError::MinecraftNotFound => false,
            AppError::PermissionDenied { .. } => true,
            AppError::IntegrityMismatch { .. } => true,
            AppError::IncompatibleVersion { .. } => false,
            AppError::Network(_) => true,
            AppError::Io(_) => true,
            AppError::RollbackPerformed { .. } => true,
            AppError::Other(_) => false,
        }
    }

    /// Accion concreta sugerida al usuario para resolver el error.
    pub fn suggested_action(&self) -> &'static str {
        match self {
            AppError::MinecraftNotFound => {
                "Instala Minecraft Bedrock o selecciona la carpeta manualmente en Modo avanzado."
            }
            AppError::PermissionDenied { .. } => {
                "Cierra Minecraft y reintenta; la app solicitara permisos de administrador."
            }
            AppError::IntegrityMismatch { .. } => {
                "Vuelve a descargar el preset; el archivo llego corrupto."
            }
            AppError::IncompatibleVersion { .. } => {
                "Elige un preset compatible con tu version de Minecraft."
            }
            AppError::Network(_) => "Revisa tu conexion a internet y reintenta.",
            AppError::Io(_) => "Verifica el espacio en disco y los permisos de la carpeta.",
            AppError::RollbackPerformed { .. } => {
                "Tu juego quedo intacto. Revisa el diagnostico y reintenta."
            }
            AppError::Other(_) => "Revisa logs/install.log para mas detalles.",
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code(), self.message())
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Other(format!("JSON: {e}"))
    }
}

/// Serializa hacia el frontend con la forma `{ code, message, recoverable, suggestedAction }`.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut st = serializer.serialize_struct("AppError", 4)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &self.message())?;
        st.serialize_field("recoverable", &self.recoverable())?;
        st.serialize_field("suggestedAction", self.suggested_action())?;
        st.end()
    }
}

/// Alias de conveniencia para resultados del backend (usado a partir de Fase 1).
#[allow(dead_code)]
pub type AppResult<T> = Result<T, AppError>;

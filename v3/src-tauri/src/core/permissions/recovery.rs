//! Journal de mutaciones para rollback y recovery.
//!
//! Cada operacion que modifica el sistema (backup de archivo, escritura, patch
//! de JSON, cambio de ACL) se registra en un [`Journal`]. Ante un fallo, las
//! acciones se revierten en orden inverso. Si el proceso muere a mitad de una
//! instalacion, al reiniciar se detecta un journal sin cerrar y se ofrece
//! reparar la instalacion interrumpida.
//!
//! Andamiaje para Fase 1: el journal se conecta al motor de instalacion en la
//! siguiente iteracion, de ahi el `allow(dead_code)` a nivel de modulo.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Una mutacion atomica registrada durante la instalacion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action")]
pub enum JournalAction {
    /// Se respaldo un archivo original antes de modificarlo.
    FileBackup { original: PathBuf, backup: PathBuf },
    /// Se escribio un archivo nuevo en la instalacion.
    FileWritten { path: PathBuf },
    /// Se aplico un patch a un JSON; `backup` conserva el original.
    JsonPatched { path: PathBuf, backup: PathBuf },
    /// Se modifico la ACL de una ruta; `original_sddl` permite restaurarla.
    AclModified { path: PathBuf, original_sddl: String },
}

/// Registro ordenado de mutaciones de una sesion de instalacion.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Journal {
    /// Identificador unico de la sesion de instalacion.
    pub session_id: String,
    /// Mutaciones en orden de aplicacion.
    pub actions: Vec<JournalAction>,
    /// `true` cuando la instalacion termino correctamente.
    pub closed: bool,
}

impl Journal {
    /// Crea un journal nuevo para una sesion de instalacion.
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            actions: Vec::new(),
            closed: false,
        }
    }

    /// Registra una mutacion.
    pub fn record(&mut self, action: JournalAction) {
        self.actions.push(action);
    }

    /// Marca la instalacion como completada correctamente.
    pub fn close(&mut self) {
        self.closed = true;
    }

    /// Devuelve las acciones a revertir, en orden inverso al de aplicacion.
    pub fn rollback_order(&self) -> impl Iterator<Item = &JournalAction> {
        self.actions.iter().rev()
    }
}

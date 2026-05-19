//! Verificacion de integridad de archivos mediante SHA256.
//!
//! Se usa para validar los `.material.bin` descargados contra el hash del
//! manifest del preset, detectando corrupcion o descargas incompletas antes
//! de tocar la instalacion de Minecraft.

use crate::infra::error::AppError;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

/// Calcula el SHA256 de un archivo en disco (lectura por bloques).
pub fn sha256_file(path: &Path) -> Result<String, AppError> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(to_hex(&hasher.finalize()))
}

/// Calcula el SHA256 de un buffer en memoria (usado para validar descargas).
#[allow(dead_code)]
pub fn sha256_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    to_hex(&hasher.finalize())
}

/// Verifica que un archivo coincida con el hash SHA256 esperado.
pub fn verify_file(path: &Path, expected_sha256: &str) -> Result<(), AppError> {
    let got = sha256_file(path)?;
    if got.eq_ignore_ascii_case(expected_sha256) {
        Ok(())
    } else {
        Err(AppError::IntegrityMismatch {
            file: path.display().to_string(),
            expected: expected_sha256.to_string(),
            got,
        })
    }
}

fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        let _ = write!(s, "{b:02x}");
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_of_known_input() {
        // SHA256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        assert_eq!(
            sha256_bytes(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}

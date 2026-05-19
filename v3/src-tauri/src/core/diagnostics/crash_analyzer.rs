//! Analizador de crashes de Minecraft via Windows Event Log.
//!
//! Busca en el Application Event Log eventos de error que involucren
//! a Minecraft en los ultimos 7 dias, y los cruza con los timestamps
//! de los backups de BetterRTX para identificar posibles relaciones.

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::process::Command;

/// Evento de crash de Minecraft detectado en el Event Log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashEvent {
    pub timestamp: String,
    pub event_id: String,
    pub source: String,
    pub message: String,
    /// `true` si ocurrio en la hora siguiente a una instalacion de BetterRTX.
    pub possibly_brtx_related: bool,
}

/// Escanea el Event Log de Windows buscando crashes recientes de Minecraft.
///
/// `backup_timestamps` son las fechas ISO 8601 de los backups conocidos
/// (usadas para correlacionar crashes con instalaciones).
pub fn scan_crashes(backup_timestamps: &[String]) -> Vec<CrashEvent> {
    // PowerShell: consulta el log Application filtrando errores de Minecraft.
    let ps = r#"
try {
    $evts = Get-WinEvent -FilterHashtable @{
        LogName   = 'Application';
        Level     = 2;
        StartTime = (Get-Date).AddDays(-7)
    } -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Message -like '*Minecraft*' -or
        $_.ProviderName -like '*Minecraft*' -or
        $_.Message -like '*minecraftUWP*'
    } | Select-Object -First 20

    if ($null -eq $evts) { '[]'; exit }

    $arr = @($evts | ForEach-Object {
        $msg = if ($_.Message.Length -gt 300) { $_.Message.Substring(0,300) + '...' } else { $_.Message }
        @{
            T = $_.TimeCreated.ToString('o')
            I = [string]$_.Id
            S = $_.ProviderName
            M = $msg
        }
    })
    $arr | ConvertTo-Json -Compress
} catch { '[]' }
"#;

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps])
        .output();

    let Ok(out) = output else {
        return vec![];
    };

    let raw = String::from_utf8_lossy(&out.stdout);
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return vec![];
    }

    #[derive(Deserialize)]
    struct RawEvt {
        #[serde(rename = "T")]
        t: String,
        #[serde(rename = "I")]
        i: String,
        #[serde(rename = "S")]
        s: String,
        #[serde(rename = "M")]
        m: String,
    }

    // PowerShell may emit a single object (not array) when only one result.
    let events: Vec<RawEvt> = if trimmed.starts_with('[') {
        serde_json::from_str(trimmed).unwrap_or_default()
    } else {
        serde_json::from_str::<RawEvt>(trimmed)
            .map(|e| vec![e])
            .unwrap_or_default()
    };

    events
        .into_iter()
        .map(|e| {
            let possibly_related = backup_timestamps.iter().any(|ts| {
                let crash = DateTime::parse_from_rfc3339(&e.t);
                let backup = DateTime::parse_from_rfc3339(ts);
                if let (Ok(c), Ok(b)) = (crash, backup) {
                    let diff = c.signed_duration_since(b);
                    // Crash dentro de la hora siguiente al backup = posiblemente relacionado.
                    diff.num_seconds() >= 0 && diff.num_hours() < 1
                } else {
                    false
                }
            });

            CrashEvent {
                timestamp: e.t,
                event_id: e.i,
                source: e.s,
                message: e.m,
                possibly_brtx_related: possibly_related,
            }
        })
        .collect()
}

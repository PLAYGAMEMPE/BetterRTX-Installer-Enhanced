//! Sistema de benchmarks locales y estimador de FPS por tier de GPU.
//!
//! - `detect_gpu()`       Lee nombre y VRAM de la GPU via WMI (PowerShell).
//! - `classify_gpu_tier()` Clasifica la GPU en High/Medium/Low segun keywords.
//! - `estimate_fps()`     Rango de FPS esperado segun tier de GPU.
//! - `load_benchmarks()`  Lista registros FPS guardados por el usuario.
//! - `save_benchmark()`   Agrega un nuevo registro al historial local.

use crate::infra::error::AppError;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

const BENCHMARKS_FILE: &str = "benchmarks.json";

/// Clasificacion de tier de GPU para el estimador de FPS.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GpuTier {
    High,
    Medium,
    Low,
    Unknown,
}

/// Informacion de la GPU del sistema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub tier: GpuTier,
    pub vram_mb: Option<u64>,
    pub tier_label: String,
}

/// Estimacion de rendimiento para la GPU actual con RTX habilitado.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FpsEstimate {
    pub tier: GpuTier,
    pub min_fps: u32,
    pub max_fps: u32,
    /// Confianza de la estimacion: "high" | "medium" | "low" | "unknown".
    pub confidence: String,
    pub note: String,
}

/// Registro de rendimiento observado por el usuario.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchmarkEntry {
    pub preset_uuid: String,
    pub preset_name: String,
    pub gpu_name: String,
    pub fps_avg: f32,
    pub mc_version: String,
    pub recorded_at: String,
}

// ---------------------------------------------------------------------------
// GPU detection
// ---------------------------------------------------------------------------

/// Detecta la GPU primaria via WMI (Win32_VideoController).
pub fn detect_gpu() -> GpuInfo {
    let ps = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $g = Get-CimInstance Win32_VideoController | Select-Object -First 1
    @{ N = $g.Name; R = [long]$g.AdapterRAM } | ConvertTo-Json -Compress
} catch { '{}' }
"#;

    let (name, vram_bytes): (String, Option<u64>) = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", ps])
        .output()
        .ok()
        .and_then(|o| {
            let raw = String::from_utf8_lossy(&o.stdout).to_string();
            #[derive(Deserialize)]
            struct Raw {
                #[serde(rename = "N")]
                n: Option<String>,
                #[serde(rename = "R")]
                r: Option<u64>,
            }
            serde_json::from_str::<Raw>(&raw).ok().map(|r| (r.n.unwrap_or_default(), r.r))
        })
        .unwrap_or_default();

    let tier = classify_gpu_tier(&name);
    let tier_label = match &tier {
        GpuTier::High => "High-end".into(),
        GpuTier::Medium => "Mid-range".into(),
        GpuTier::Low => "Entry-level".into(),
        GpuTier::Unknown => "Unknown".into(),
    };

    GpuInfo {
        name,
        tier,
        vram_mb: vram_bytes.map(|b| b / 1024 / 1024),
        tier_label,
    }
}

/// Clasifica una GPU en un tier segun su nombre.
pub fn classify_gpu_tier(gpu_name: &str) -> GpuTier {
    let n = gpu_name.to_lowercase();

    // High-end: RTX 20/30/40, RX 6800/6900/7900, Arc A750/A770, Quadro RTX
    if ["rtx 40", "rtx 30", "rtx 20", "rx 7900", "rx 6900", "rx 6800",
        "arc a770", "arc a750", "quadro rtx", "rtx a4", "rtx a5", "rtx a6"]
        .iter()
        .any(|k| n.contains(k))
    {
        return GpuTier::High;
    }

    // Mid-range: GTX 10/16, RTX 1660, RX 5700/6600/6700, Arc A380
    if ["rtx 16", "gtx 10", "gtx 16", "rx 6700", "rx 6600", "rx 5700",
        "arc a380", "rx 5600", "rx vega 56", "rx vega 64"]
        .iter()
        .any(|k| n.contains(k))
    {
        return GpuTier::Medium;
    }

    // Low-end: GTX 8/9, RX 5xx, Vega iGPU, Intel UHD/HD
    if ["gtx 9", "gtx 8", "rx 5500", "rx 580", "rx 570", "rx 560",
        "rx 550", "intel uhd", "intel hd", "intel iris", "radeon vega",
        "integrated", "vega 8", "vega 11"]
        .iter()
        .any(|k| n.contains(k))
    {
        return GpuTier::Low;
    }

    GpuTier::Unknown
}

// ---------------------------------------------------------------------------
// FPS estimator
// ---------------------------------------------------------------------------

/// Estima el rango de FPS esperado con BetterRTX activo segun el tier de GPU.
pub fn estimate_fps(gpu_name: &str) -> FpsEstimate {
    match classify_gpu_tier(gpu_name) {
        GpuTier::High => FpsEstimate {
            tier: GpuTier::High,
            min_fps: 60,
            max_fps: 120,
            confidence: "medium".into(),
            note: "RTX features enabled; actual FPS varies by preset and world complexity.".into(),
        },
        GpuTier::Medium => FpsEstimate {
            tier: GpuTier::Medium,
            min_fps: 30,
            max_fps: 60,
            confidence: "medium".into(),
            note: "Playable with most presets; performance-heavy presets may drop below 30 FPS.".into(),
        },
        GpuTier::Low => FpsEstimate {
            tier: GpuTier::Low,
            min_fps: 10,
            max_fps: 30,
            confidence: "low".into(),
            note: "RTX may be unplayable. Consider using lightweight presets or disabling ray tracing.".into(),
        },
        GpuTier::Unknown => FpsEstimate {
            tier: GpuTier::Unknown,
            min_fps: 0,
            max_fps: 0,
            confidence: "unknown".into(),
            note: "GPU not recognized. Record your actual FPS after installing to build a local profile.".into(),
        },
    }
}

// ---------------------------------------------------------------------------
// Local benchmark storage
// ---------------------------------------------------------------------------

/// Lista todos los registros de benchmark guardados localmente.
pub fn load_benchmarks(brtx_dir: &Path) -> Vec<BenchmarkEntry> {
    std::fs::read_to_string(brtx_dir.join(BENCHMARKS_FILE))
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

/// Agrega un nuevo registro de benchmark al historial local.
pub fn save_benchmark(brtx_dir: &Path, entry: BenchmarkEntry) -> Result<(), AppError> {
    let mut entries = load_benchmarks(brtx_dir);
    // Actualizar si ya existe registro para (preset, gpu) del mismo dia.
    let today = Utc::now().date_naive().to_string();
    entries.retain(|e| {
        !(e.preset_uuid == entry.preset_uuid
            && e.gpu_name == entry.gpu_name
            && e.recorded_at.starts_with(&today))
    });
    entries.push(entry);

    let json = serde_json::to_string_pretty(&entries).map_err(|e| AppError::Io(e.to_string()))?;
    std::fs::write(brtx_dir.join(BENCHMARKS_FILE), json).map_err(|e| AppError::Io(e.to_string()))
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use chrono::{Local, DateTime, Utc};
use reqwest::Client;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use winreg::enums::*;
use winreg::RegKey;
use std::collections::HashMap;
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use url::Url;

const BRTX_DIR_NAME: &str = "graphics.bedrock";

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Installation {
    #[serde(rename = "FriendlyName")]
    friendly_name: String,
    #[serde(rename = "InstallLocation")]
    install_location: String,
    #[serde(rename = "Preview")]
    preview: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    installed_preset: Option<InstalledPreset>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct InstalledPreset {
    uuid: String,
    name: String,
    installed_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_creator: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackInfo {
    pub name: String,
    pub uuid: String,
    pub stub: String,
    pub tonemapping: String,
    pub bloom: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CacheEntry<T> {
    data: T,
    timestamp: DateTime<Utc>,
    expires_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Cache {
    presets: Option<CacheEntry<Vec<PackInfo>>>,
    downloads: HashMap<String, CacheEntry<Vec<u8>>>,
}

fn local_app_data() -> PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("C:/Users/Public/AppData/Local"))
}

fn brtx_dir() -> PathBuf {
    local_app_data().join(BRTX_DIR_NAME)
}

fn ensure_dir(p: &Path) -> std::io::Result<()> {
    if !p.exists() {
        fs::create_dir_all(p)?;
    }
    Ok(())
}

fn cache_file_path() -> PathBuf {
    brtx_dir().join("cache.json")
}

async fn load_cache() -> Cache {
    let cache_file = brtx_dir().join("cache.json");
    if cache_file.exists() {
        if let Ok(content) = tokio::fs::read_to_string(&cache_file).await {
            if let Ok(cache) = serde_json::from_str::<Cache>(&content) {
                return cache;
            }
        }
    }
    Cache {
        presets: None,
        downloads: HashMap::new(),
    }
}

async fn save_cache(cache: &Cache) -> Result<(), String> {
    let cache_path = cache_file_path();
    ensure_dir(cache_path.parent().unwrap()).map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    tokio::fs::write(&cache_path, content).await.map_err(|e| e.to_string())
}

fn is_cache_valid<T>(cached: &CacheEntry<T>) -> bool {
    Utc::now() < cached.expires_at
}

async fn run_powershell_async(app_handle: tauri::AppHandle, script: &str) -> Result<String, String> {
    let shell = app_handle.shell();
    let output = shell
        .command("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn PowerShell: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn is_sideloaded(install_location: &str) -> bool {
    // Sideloaded if NOT under Program Files\WindowsApps
    let lc = install_location.to_ascii_lowercase();
    !lc.contains("windowsapps")
}

fn get_custom_iobit_path() -> Option<PathBuf> {
    let config_file = brtx_dir().join("iobit_path.txt");
    if config_file.exists() {
        if let Ok(path_str) = fs::read_to_string(&config_file) {
            let path = PathBuf::from(path_str.trim());
            if path.exists() {
                return Some(path);
            }
        }
    }
    None
}

fn get_iobit_path_cached() -> Option<PathBuf> {
    // Check if we have a cached path
    let cache_file = brtx_dir().join("iobit_path.txt");
    if cache_file.exists() {
        if let Ok(cached_path) = fs::read_to_string(&cache_file) {
            let path = PathBuf::from(cached_path.trim());
            if path.exists() {
                return Some(path);
            }
        }
    }
    
    // Fall back to automatic detection
    get_iobit_unlocker_exe()
}

fn get_iobit_unlocker_exe() -> Option<PathBuf> {
    // First check if user has set a custom path
    if let Some(custom_path) = get_custom_iobit_path() {
        return Some(custom_path);
    }

    // Try common install locations
    let candidates = [
        r"C:\\Program Files (x86)\\IObit\\IObit Unlocker\\IObitUnlocker.exe",
        r"C:\\Program Files\\IObit\\IObit Unlocker\\IObitUnlocker.exe",
    ];
    for c in candidates { if Path::new(c).exists() { return Some(PathBuf::from(c)); } }

    // Fallback: search Program Files dirs shallowly
    for root in [r"C:\\Program Files", r"C:\\Program Files (x86)"] {
        let rootp = Path::new(root);
        if rootp.exists() {
            for entry in WalkDir::new(rootp).max_depth(3) {
                if let Ok(e) = entry {
                    let p = e.path();
                    if p.file_name().map(|n| n.to_string_lossy().eq_ignore_ascii_case("IObitUnlocker.exe")).unwrap_or(false) {
                        return Some(p.to_path_buf());
                    }
                }
            }
        }
    }
    None
}

async fn iobit_delete_async(app_handle: &tauri::AppHandle, iobit: &Path, location: &Path, materials: &[PathBuf]) -> Result<(), String> {
    // RTX material files that need to be deleted before installation
    let rtx_files_to_delete = [
        "RTXStub.material.bin",
        "RTXPostFX.Tonemapping.material.bin", 
        "RTXPostFX.Bloom.material.bin"
    ];
    
    // Collect all files to delete (RTX files + materials), avoiding duplicates
    let mut files_to_delete = std::collections::HashSet::new();
    
    // Add hardcoded RTX files
    for file_name in &rtx_files_to_delete {
        files_to_delete.insert(file_name.to_string());
    }
    
    // Add material files being installed
    for m in materials {
        if let Some(name) = m.file_name() {
            if let Some(name_str) = name.to_str() {
                files_to_delete.insert(name_str.to_string());
            }
        }
    }
    
    if files_to_delete.is_empty() {
        println!("No files to delete");
        return Ok(());
    }

    // Build target paths for all files to delete
    let targets: Vec<_> = files_to_delete
        .iter()
        .map(|file_name| location.join("data").join("renderer").join("materials").join(file_name))
        .collect();

    // Build the exact ArgumentList string for single-pass delete:
    // '/Delete "target1","target2","target3"'
    let targets_joined = targets
        .iter()
        .map(|t| t.display().to_string())
        .collect::<Vec<_>>()
        .join("\",\"");
    let arglist = format!("/Delete \"{}\"", targets_joined);

    // Escape single quotes for embedding in a single-quoted PS string
    let ioexe_ps = iobit.display().to_string().replace("'", "''");
    let arglist_ps = arglist.replace("'", "''");

    let ps_cmd = format!(
        "Start-Process -FilePath '{}' -ArgumentList '{}' -Wait -PassThru",
        ioexe_ps, arglist_ps
    );

    println!(
        "Deleting materials via IObit (single pass): [{}]",
        files_to_delete.iter().cloned().collect::<Vec<_>>().join(", ")
    );

    let shell = app_handle.shell();
    let output = shell
        .command("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_cmd])
        .output()
        .await
        .map_err(|e| format!("Failed to run PowerShell for IObit delete: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("IObit delete reported non-success: {}", stderr);
    }

    println!("IObit single-pass delete completed");
    Ok(())
}

async fn iobit_copy_async(app_handle: &tauri::AppHandle, iobit: &Path, destination: &Path, materials: &[PathBuf]) -> Result<(), String> {
    // Best-effort ensure destination directory for sideloaded installs
    let dest_dir = destination.join("data").join("renderer").join("materials");
    let _ = ensure_dir(&dest_dir);

    if materials.is_empty() {
        println!("No materials to copy");
        return Ok(());
    }

    // Build the exact ArgumentList string used in PowerShell v2 implementation:
    // '/Copy "src1","src2" "destDir"'
    let sources_joined = materials
        .iter()
        .map(|m| m.display().to_string())
        .collect::<Vec<_>>()
        .join("\",\"");
    let arglist = format!("/Copy \"{}\" \"{}\"", sources_joined, dest_dir.display());

    // Escape single quotes for embedding in a single-quoted PS string
    let ioexe_ps = iobit.display().to_string().replace("'", "''");
    let arglist_ps = arglist.replace("'", "''");

    let ps_cmd = format!(
        "Start-Process -FilePath '{}' -ArgumentList '{}' -Wait -PassThru",
        ioexe_ps, arglist_ps
    );

    println!(
        "Copying materials via IObit (single pass): [{}] -> {}",
        materials
            .iter()
            .map(|m| m.file_name().unwrap_or_default().to_string_lossy().to_string())
            .collect::<Vec<_>>()
            .join(", "),
        dest_dir.display()
    );

    let shell = app_handle.shell();
    let output = shell
        .command("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_cmd])
        .output()
        .await
        .map_err(|e| format!("Failed to run PowerShell for IObit copy: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("IObit copy via PowerShell failed: {}", stderr));
    }

    println!("IObit single-pass copy completed");
    Ok(())
}

async fn copy_shader_files_async(app_handle: &tauri::AppHandle, install_location: &str, materials: &[PathBuf], pack: &PackInfo) -> Result<(), String> {
    let mc_dest = Path::new(install_location).join("data").join("renderer").join("materials");
    let sideloaded = is_sideloaded(install_location);

    // For WindowsApps installs, prefer IObit Unlocker; for sideloaded, use direct copy
    // Only use IObit for WindowsApps (non-sideloaded) installations

    if sideloaded {
        // Fallback for sideloaded installations: ensure dir, delete then copy directly
        ensure_dir(&mc_dest).map_err(|e| format!("Failed to create materials dir: {e}"))?;
        for m in materials {
            if !m.exists() { return Err(format!("Source material not found: {}", m.display())); }
            let dest = mc_dest.join(m.file_name().ok_or("invalid material filename")?);
            if dest.exists() {
                println!("Removing existing file before copy: {}", dest.display());
                let _ = fs::remove_file(&dest);
            }
            fs::copy(m, &dest).map_err(|e| format!("Direct copy failed to {}: {e}", dest.display()))?;
        }
        let installed_preset = InstalledPreset {
            uuid: pack.uuid.clone(),
            name: pack.name.clone(),
            installed_at: chrono::Utc::now().to_rfc3339(),
            is_creator: None,
        };
        if let Err(e) = save_installed_preset(install_location, &installed_preset) {
            println!("⚠ Failed to save preset tracking: {}", e);
        }
        return Ok(());
    }

    if let Some(ioexe) = get_iobit_path_cached() {
        println!("Using IObit Unlocker for WindowsApps delete+copy");
        match try_iobit_copy_async(app_handle, &ioexe, install_location, materials).await {
            Ok(_) => {
                let installed_preset = InstalledPreset {
                    uuid: pack.uuid.clone(),
                    name: pack.name.clone(),
                    installed_at: chrono::Utc::now().to_rfc3339(),
                    is_creator: None,
                };
                if let Err(e) = save_installed_preset(install_location, &installed_preset) {
                    println!("⚠ Failed to save preset tracking: {}", e);
                }
                return Ok(());
            }
            Err(e) => {
                println!("⚠ IObit Unlocker failed: {}", e);
                // Continue to appropriate fallback below
            }
        }
    } else {
        println!("⚠ IObit Unlocker not found, using fallback method for WindowsApps");
    }

    println!("Attempting elevated PowerShell fallback...");
    match try_elevated_copy_async(app_handle, &mc_dest, materials).await {
        Ok(_) => {
            let installed_preset = InstalledPreset {
                uuid: pack.uuid.clone(),
                name: pack.name.clone(),
                installed_at: chrono::Utc::now().to_rfc3339(),
                is_creator: None,
            };
            if let Err(e) = save_installed_preset(install_location, &installed_preset) {
                println!("⚠ Failed to save preset tracking: {}", e);
            }
            Ok(())
        }
        Err(e) => Err(e)
    }
}

async fn try_iobit_copy_async(app_handle: &tauri::AppHandle, ioexe: &Path, install_location: &str, materials: &[PathBuf]) -> Result<(), String> {
    println!("Starting IObit operations for {} files", materials.len());
    let install_path = Path::new(install_location);
    
    // Delete existing files first
    println!("Deleting existing material files...");
    iobit_delete_async(app_handle, ioexe, install_path, materials).await?;
    
    // Copy new files
    println!("Copying material files with IObit Unlocker...");
    iobit_copy_async(app_handle, ioexe, install_path, materials).await?;
    
    // Skipping file verification per user preference
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    println!("IObit operations completed successfully");
    Ok(())
}

async fn try_elevated_copy_async(app_handle: &tauri::AppHandle, mc_dest: &Path, materials: &[PathBuf]) -> Result<(), String> {
    // Use PowerShell with elevation request to copy files
    let mut ps_script = String::from("Start-Process powershell -Verb RunAs -ArgumentList '-Command', '");
    
    for m in materials {
        let src = m.to_string_lossy().replace('\\', "\\\\").replace('\'', "\'\'");
        let dest_file = mc_dest.join(m.file_name().unwrap());
        let dest = dest_file.to_string_lossy().replace('\\', "\\\\").replace('\'', "\'\'");
        ps_script.push_str(&format!("Copy-Item '{}' '{}' -Force; ", src, dest));
    }
    
    ps_script.push_str("' -Wait");
    
    let shell = app_handle.shell();
    let output = shell
        .command("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
        .output()
        .await
        .map_err(|e| format!("Failed to run elevated PowerShell: {e}"))?;

    if output.status.success() {
        // Skipping file verification per user preference
        Ok(())
    } else {
        Err(format!("Elevated PowerShell failed: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

fn extract_rtpack_to(pack: &Path, out_dir: &Path) -> Result<(), String> {
    ensure_dir(out_dir).map_err(|e| e.to_string())?;
    let mut f = File::open(pack).map_err(|e| format!("Open pack failed: {e}"))?;
    let mut data = Vec::new();
    f.read_to_end(&mut data).map_err(|e| format!("Read pack failed: {e}"))?;
    let reader = std::io::Cursor::new(data);
    let mut zip = zip::ZipArchive::new(reader).map_err(|e| format!("Invalid .rtpack: {e}"))?;
    for i in 0..zip.len() {
        let mut file = zip.by_index(i).map_err(|e| e.to_string())?;
        let outpath = out_dir.join(file.name());
        if file.name().ends_with('/') {
            ensure_dir(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() { ensure_dir(parent).map_err(|e| e.to_string())?; }
            let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn find_materials(root: &Path) -> Vec<PathBuf> {
    let mut v = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let p = entry.path();
        if p.is_file() && p.extension().map(|e| e == "bin").unwrap_or(false) {
            if let Some(stem) = p.file_stem() {
                let s = stem.to_string_lossy();
                if s.contains("material") { v.push(p.to_path_buf()); }
            }
        }
    }
    v
}

fn read_json_file<T: for<'de> Deserialize<'de>>(p: &Path) -> Option<T> {
    let s = fs::read_to_string(p).ok()?;
    serde_json::from_str(&s).ok()
}

fn write_json_file<T: Serialize>(p: &Path, val: &T) -> Result<(), String> {
    if let Some(parent) = p.parent() { ensure_dir(parent).map_err(|e| e.to_string())?; }
    let s = serde_json::to_string_pretty(val).map_err(|e| e.to_string())?;
    fs::write(p, s).map_err(|e| e.to_string())
}

fn find_launcher_installs(
    installations: &mut Vec<Installation>,
    launcher_name: &str,
    base_path_env: &str,
    sub_path: &str,
) {
    let Ok(app_data) = std::env::var(base_path_env) else { return };
    let launcher_path = std::path::Path::new(&app_data).join(sub_path);
    let Ok(entries) = std::fs::read_dir(launcher_path) else { return };

    let new_installations = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map_or(false, |ft| ft.is_dir()))
        .filter_map(|entry| {
            let path = entry.path();
            let version_name = path.file_name()?.to_str()?;
            Some(Installation {
                friendly_name: format!("{} - {}", launcher_name, version_name),
                install_location: path.to_str()?.to_string(),
                preview: false,
                installed_preset: None,
            })
        });

    installations.extend(new_installations);
}

#[tauri::command]
async fn list_installations(app_handle: tauri::AppHandle) -> Result<Vec<Installation>, String> {
    let ps = r#"
    $ErrorActionPreference='Stop';
    $pkgs = Get-AppxPackage -Name 'Microsoft.Minecraft*' | Where-Object { $_.InstallLocation -notlike '*Java*' };
    $res = @();
    foreach ($mc in $pkgs) {
      $name = (Get-AppxPackageManifest -Package $mc).Package.Properties.DisplayName;
      $res += [PSCustomObject]@{ FriendlyName=$name; InstallLocation=$mc.InstallLocation; Preview= ($mc.InstallLocation -like '*Beta*' -or $name -like '*Preview*') };
    }
    $res | ConvertTo-Json -Depth 3
    "#;
    let out = run_powershell_async(app_handle, ps).await?;
    let out_trim = out.trim();
    if out_trim.is_empty() { return Ok(vec![]); }
    
    let mut installations: Vec<Installation> = {
        let parsed: Result<Vec<Installation>, _> = serde_json::from_str(out_trim);
        if let Ok(v) = parsed {
            v
        } else {
            let parsed_single: Result<Installation, _> = serde_json::from_str(out_trim);
            if let Ok(i) = parsed_single { vec![i] } else { vec![] }
        }
    };

    find_launcher_installs(
        &mut installations,
        "BedrockLauncher",
        "APPDATA",
        "BedrockLauncher/data/versions",
    );
    find_launcher_installs(
        &mut installations,
        "MCLauncher",
        "LOCALAPPDATA",
        "MCLauncher/installs",
    );
    
    // Add installed preset information to each installation
    for installation in &mut installations {
        installation.installed_preset = get_installed_preset(&installation.install_location);
    }
    
    Ok(installations)
}

#[tauri::command]
async fn get_api_packs() -> Result<Vec<PackInfo>, String> {
    list_presets(false).await
}

#[tauri::command]
async fn list_presets(force_refresh: bool) -> Result<Vec<PackInfo>, String> {
    let mut cache = load_cache().await;
    
    // Check if we have valid cached data and don't need to force refresh
    if !force_refresh {
        if let Some(ref cached_presets) = cache.presets {
            if is_cache_valid(cached_presets) {
                return Ok(cached_presets.data.clone());
            }
        }
    }
    
    // Fetch fresh data from API
    let packs_dir = brtx_dir().join("packs");
    ensure_dir(&packs_dir).map_err(|e| e.to_string())?;
    
    let url = "https://bedrock.graphics/api";
    let client = Client::new();
    let text = client
        .get(url)
        .send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;
    
    // Parse the JSON response directly as PackInfo array
    let presets: Vec<PackInfo> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse presets JSON: {}. Response was: {}", e, text))?;
    
    // Cache the results for 1 hour
    let now = Utc::now();
    let expires_at = now + chrono::Duration::hours(1);
    // Update cache with fresh data
    cache.presets = Some(CacheEntry {
        data: presets.clone(),
        timestamp: now,
        expires_at,
    });
    
    save_cache(&cache).await.map_err(|e| e.to_string())?;
    
    Ok(presets)
}

fn get_installed_preset(install_location: &str) -> Option<InstalledPreset> {
    let presets_file = brtx_dir().join("installed_presets.json");
    if let Some(installations) = read_json_file::<HashMap<String, InstalledPreset>>(&presets_file) {
        return installations.get(install_location).cloned();
    }
    None
}

fn save_installed_preset(install_location: &str, preset: &InstalledPreset) -> Result<(), String> {
    let presets_file = brtx_dir().join("installed_presets.json");
    
    // Load existing installations or create new map
    let mut installations = read_json_file::<HashMap<String, InstalledPreset>>(&presets_file)
        .unwrap_or_else(HashMap::new);
    
    // Update with new preset
    installations.insert(install_location.to_string(), preset.clone());
    
    // Save using write_json_file
    write_json_file(&presets_file, &installations)
}

async fn get_cached_download(url: &str) -> Option<Vec<u8>> {
    let cache = load_cache().await;
    if let Some(cached) = cache.downloads.get(url) {
        if is_cache_valid(cached) {
            return Some(cached.data.clone());
        }
    }
    None
}

async fn cache_download(url: &str, data: &[u8]) -> Result<(), String> {
    let mut cache = load_cache().await;
    let now = Utc::now();
    let expires_at = now + chrono::Duration::hours(24); // Cache downloads for 24 hours
    
    cache.downloads.insert(url.to_string(), CacheEntry {
        data: data.to_vec(),
        timestamp: now,
        expires_at,
    });
    
    save_cache(&cache).await
}

// Helper: download a URL to a file path with caching
async fn download_to_file_with_cache(client: &Client, url: &str, file_path: &Path) -> Result<(), String> {
    if let Some(cached_data) = get_cached_download(url).await {
        tokio::fs::write(file_path, cached_data).await.map_err(|e| e.to_string())?;
        return Ok(());
    }
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let data = resp.bytes().await.map_err(|e| e.to_string())?;
    let _ = cache_download(url, &data).await;
    tokio::fs::write(file_path, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_cache() -> Result<(), String> {
    let cache_path = cache_file_path();
    if cache_path.exists() {
        fs::remove_file(cache_path).map_err(|e| e.to_string())?;
    }
    
    // Also clear downloaded packs directory
    let packs_dir = brtx_dir().join("packs");
    if packs_dir.exists() {
        fs::remove_dir_all(&packs_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn get_cache_info() -> Result<serde_json::Value, String> {
    let cache = load_cache().await;
    let mut info = serde_json::Map::new();
    
    if let Some(ref presets_cache) = cache.presets {
        info.insert("presets_cached".to_string(), serde_json::Value::Bool(true));
        info.insert("presets_count".to_string(), serde_json::Value::from(presets_cache.data.len() as u64));
        info.insert("presets_expires".to_string(), serde_json::Value::String(presets_cache.expires_at.to_rfc3339()));
    } else {
        info.insert("presets_cached".to_string(), serde_json::Value::Bool(false));
    }
    
    info.insert("downloads_cached".to_string(), serde_json::Value::from(cache.downloads.len() as u64));
    
    Ok(serde_json::Value::Object(info))
}

#[tauri::command]
async fn download_and_install_pack(app_handle: tauri::AppHandle, uuid: String, selected_names: Vec<String>) -> Result<(), String> {
    let all = list_installations(app_handle.clone()).await?;
    // Map by InstallLocation because the UI sends InstallLocation values
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    
    // Get the preset info from cached API data
    let packs = get_api_packs().await?;
    let preset = packs.iter().find(|p| p.uuid == uuid).ok_or("Preset not found")?;
    
    let dir = brtx_dir().join("packs").join(&uuid);
    ensure_dir(&dir).map_err(|e| e.to_string())?;
    let client = Client::new();
    
    // Download files with caching
    let stub_path = dir.join("RTXStub.material.bin");
    download_to_file_with_cache(&client, &preset.stub, &stub_path).await?;
    let tone_path = dir.join("RTXPostFX.Tonemapping.material.bin");
    download_to_file_with_cache(&client, &preset.tonemapping, &tone_path).await?;
    let bloom_path = dir.join("RTXPostFX.Bloom.material.bin");
    download_to_file_with_cache(&client, &preset.bloom, &bloom_path).await?;

    let materials = vec![
        stub_path.clone(),
        tone_path.clone(),
        bloom_path.clone(),
    ];
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, preset).await?;
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

#[tauri::command]
async fn install_from_rtpack(app_handle: tauri::AppHandle, rtpack_path: String, selected_names: Vec<String>) -> Result<(), String> {
    if !rtpack_path.to_ascii_lowercase().ends_with(".rtpack") { return Err("Invalid file type; expected .rtpack".into()); }
    let pack_name = Path::new(&rtpack_path).file_stem().and_then(|s| s.to_str()).ok_or("Invalid pack path")?.to_string();
    let out_dir = brtx_dir().join("packs").join(&pack_name);
    extract_rtpack_to(Path::new(&rtpack_path), &out_dir)?;
    let materials = find_materials(&out_dir);
    if materials.is_empty() { return Err("No materials found in pack".into()); }
    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            // Create a dummy pack for material file installation
            let dummy_pack = PackInfo {
                name: pack_name.clone().chars().take(20).collect(),
                uuid: format!("material-files-{}", chrono::Utc::now().timestamp()),
                stub: String::new(),
                tonemapping: String::new(),
                bloom: String::new(),
            };
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, &dummy_pack).await?;
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

#[tauri::command]
async fn install_materials(app_handle: tauri::AppHandle, material_paths: Vec<String>, selected_names: Vec<String>) -> Result<(), String> {
    if material_paths.is_empty() { return Err("No files provided".into()); }
    let materials: Vec<PathBuf> = material_paths.iter().map(PathBuf::from).collect();
    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all.into_iter().map(|i| (i.install_location.clone(), i)).collect();
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            // Create a dummy pack for material file installation
            let dummy_pack = PackInfo {
                name: "Material Files".to_string(),
                uuid: "material-files".to_string(),
                stub: String::new(),
                tonemapping: String::new(),
                bloom: String::new(),
            };
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, &dummy_pack).await?;
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

fn backup_initial_shader_files(location: &str, backup_dir: &Path) -> Result<(), String> {
    ensure_dir(backup_dir).map_err(|e| e.to_string())?;
    let dlss = Path::new(location).join("nvngx_dlss.dll");
    if dlss.exists() { let _ = fs::copy(&dlss, backup_dir.join("nvngx_dlss.dll")); }
    let materials = [
        "RTXStub.material.bin",
        "RTXPostFX.Tonemapping.material.bin",
        "RTXPostFX.Bloom.material.bin",
    ];
    let mc_src = Path::new(location).join("data").join("renderer").join("materials");
    for m in materials { let src = mc_src.join(m); if src.exists() { let _ = fs::copy(&src, backup_dir.join(m)); } }
    Ok(())
}

fn zip_dir(src_dir: &Path, dest_zip: &Path) -> Result<(), String> {
    let file = File::create(dest_zip).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let src = src_dir.to_path_buf();
    for entry in WalkDir::new(&src).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        let name = path.strip_prefix(&src).map_err(|e| e.to_string())?.to_string_lossy().replace('\\', "/");
        if path.is_file() {
            zip.start_file(name, options).map_err(|e| e.to_string())?;
            let mut f = File::open(path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        } else if !name.is_empty() {
            zip.add_directory(name + "/", options).map_err(|e| e.to_string())?;
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn backup_selected(app_handle: tauri::AppHandle, dest_dir: String, selected_names: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let dest = PathBuf::from(dest_dir);
    if !dest.exists() { return Err("Destination directory does not exist".into()); }
    let all = list_installations(app_handle).await?;
    // UI sends InstallLocation values in selected_names
    let targets: Vec<Installation> = if let Some(names) = selected_names {
        all
            .into_iter()
            .filter(|i| names.contains(&i.install_location))
            .collect()
    } else {
        all
    };
    let mut created = Vec::new();
    for ins in targets {
        let instance = ins.install_location.split(['\\', '/']).last().unwrap_or("instance").replace(' ', "_");
        let backup_dir = brtx_dir().join("backup").join(&ins.friendly_name);
        ensure_dir(backup_dir.parent().unwrap()) .map_err(|e| e.to_string())?;
        ensure_dir(&backup_dir).map_err(|e| e.to_string())?;
        backup_initial_shader_files(&ins.install_location, &backup_dir)?;
        let ts = Local::now().format("%Y-%m-%d_%H-%M");
        let zip_path = dest.join(format!("betterrtx_backup_{}_{}.zip", instance, ts));
        zip_dir(&backup_dir, &zip_path)?;
        let rtpack = zip_path.with_extension("rtpack");
        fs::rename(&zip_path, &rtpack).map_err(|e| e.to_string())?;
        // Clean temp backup dir
        let _ = fs::remove_dir_all(&backup_dir);
        created.push(rtpack.to_string_lossy().to_string());
    }
    Ok(created)
}

#[tauri::command]
async fn install_dlss_for_selected(app_handle: tauri::AppHandle, selected_names: Vec<String>) -> Result<(), String> {
    let dir = brtx_dir().join("dlss");
    if !dir.exists() {
        ensure_dir(&dir).map_err(|e| e.to_string())?;
        let client = Client::new();
        let versions: serde_json::Value = client.get("https://bedrock.graphics/api/dlss").send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
        let latest = versions.get("latest").and_then(|v| v.as_str()).ok_or("Invalid DLSS API response")?;
        let zip_path = dir.join("nvngx_dlss.zip");
        let resp = client.get(latest).send().await.map_err(|e| e.to_string())?;
        let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
        tokio::fs::write(&zip_path, bytes).await.map_err(|e| e.to_string())?;
        // extract
        extract_rtpack_to(&zip_path, &dir).or_else(|_| {
            // Some DLSS zips may not be .rtpack format; try normal zip extraction path
            let file = File::open(&zip_path).map_err(|e| e.to_string())?;
            let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
            for i in 0..zip.len() {
                let mut file = zip.by_index(i).map_err(|e| e.to_string())?;
                let out = dir.join(file.name());
                if file.name().ends_with('/') { ensure_dir(&out).map_err(|e| e.to_string())?; } else {
                    if let Some(par) = out.parent() { ensure_dir(par).map_err(|e| e.to_string())?; }
                    let mut of = File::create(&out).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut of).map_err(|e| e.to_string())?;
                }
            }
            Ok::<(), String>(())
        })?;
        let _ = fs::remove_file(&zip_path);
    }

    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            let src = dir.join("nvngx_dlss.dll");
            if !src.exists() { return Err("DLSS DLL not found".into()); }
            let dest = Path::new(&ins.install_location).join("nvngx_dlss.dll");
            if is_sideloaded(&ins.install_location) {
                fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            } else if let Some(ioexe) = get_iobit_unlocker_exe() {
                // Use IObit via PowerShell to mirror quoting behavior from v2
                println!("Attempting to delete existing DLSS via IObit: {}", dest.display());
                let ioexe_ps = ioexe.display().to_string().replace("'", "''");
                let del_arglist = format!("/Delete \"{}\"", dest.display());
                let del_arglist_ps = del_arglist.replace("'", "''");
                let del_ps_cmd = format!(
                    "Start-Process -FilePath '{}' -ArgumentList '{}' -Wait -PassThru",
                    ioexe_ps, del_arglist_ps
                );
                let out = app_handle.shell().command("powershell.exe")
                    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &del_ps_cmd])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to run IObit Unlocker: {e}"))?;
                if !out.status.success() {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    println!("IObit DLSS delete reported non-success for {}: {}", dest.display(), stderr);
                }
                println!("Copying DLSS via IObit: {} -> {}", src.display(), dest.display());
                let copy_arglist = format!("/Copy \"{}\" \"{}\"", src.display(), dest.display());
                let copy_arglist_ps = copy_arglist.replace("'", "''");
                let copy_ps_cmd = format!(
                    "Start-Process -FilePath '{}' -ArgumentList '{}' -Wait -PassThru",
                    ioexe_ps, copy_arglist_ps
                );
                let out = app_handle.shell().command("powershell.exe")
                    .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &copy_ps_cmd])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to run IObit Unlocker: {e}"))?;
                if !out.status.success() {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("IObit copy failed for {}: {}", src.display(), stderr));
                }
                // Skipping post-copy file verification per user preference
            } else {
                return Err("IObit Unlocker not found; cannot update DLSS in WindowsApps".into());
            }
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

fn update_options_file(path: &Path) -> Result<(), String> {
    if !path.exists() { return Err(format!("Options file not found: {}", path.display())); }
    let mut content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    if content.contains("show_advanced_video_settings:0") {
        content = content.replace("show_advanced_video_settings:0", "show_advanced_video_settings:1");
    } else if !content.contains("show_advanced_video_settings:1") {
        content.push_str("\nshow_advanced_video_settings:1");
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_options_for_selected(app_handle: tauri::AppHandle, selected_names: Vec<String>) -> Result<(), String> {
    let all = list_installations(app_handle.clone()).await?;
    // Map by InstallLocation because the UI sends InstallLocation values
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    let com_mojang = local_app_data().join(r"Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftpe\options.txt");
    let preview_com_mojang = local_app_data().join(r"Packages\Microsoft.MinecraftPreview_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftpe\options.txt");
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            if ins.preview { update_options_file(&preview_com_mojang)?; } else { update_options_file(&com_mojang)?; }
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

#[tauri::command]
fn is_brtx_protocol_registered() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let classes = hkcu.open_subkey("Software\\Classes").map_err(|e| e.to_string())?;
    
    match classes.open_subkey("brtx") {
        Ok(brtx_key) => {
            // Check if URL Protocol value exists
            match brtx_key.get_value::<String, _>("URL Protocol") {
                Ok(_) => Ok(true),
                Err(_) => Ok(false),
            }
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn register_brtx_protocol() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let classes = hkcu.open_subkey_with_flags("Software\\Classes", KEY_ALL_ACCESS).map_err(|e| e.to_string())?;
    
    // Register brtx:// protocol
    let brtx_key = classes.create_subkey("brtx").map_err(|e| e.to_string())?.0;
    brtx_key.set_value("", &"URL:BetterRTX Protocol").map_err(|e| e.to_string())?;
    brtx_key.set_value("URL Protocol", &"").map_err(|e| e.to_string())?;
    
    // Set icon
    let icon_path = brtx_dir().join("brtx.ico");
    // Skipping network download of icon in sync context; path may be populated elsewhere.
    let _ = brtx_key.set_value("DefaultIcon", &format!("{},0", icon_path.display()));
    
    // Shell open command -> this app exe
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let shell_open = brtx_key.create_subkey("shell\\open\\command").map_err(|e| e.to_string())?.0;
    let cmd = format!("\"{}\" \"%1\"", exe.display());
    shell_open.set_value("", &cmd).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn register_rtpack_extension() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let classes = hkcu.open_subkey_with_flags("Software\\Classes", KEY_ALL_ACCESS).map_err(|e| e.to_string())?;
    // .rtpack -> BetterRTX.PackageFile
    let rtpack_key = classes.create_subkey(".rtpack").map_err(|e| e.to_string())?.0;
    rtpack_key.set_value("", &"BetterRTX.PackageFile").map_err(|e| e.to_string())?;
    // BetterRTX.PackageFile
    let app_key = classes.create_subkey("BetterRTX.PackageFile").map_err(|e| e.to_string())?.0;
    app_key.set_value("", &"BetterRTX Preset").map_err(|e| e.to_string())?;

    // Icon file
    let icon_path = brtx_dir().join("rtpack.ico");
    // Skipping network download of icon in sync context; path may be populated elsewhere.
    let _ = app_key.set_value("DefaultIcon", &icon_path.to_string_lossy().to_string());

    // Shell open command -> this app exe
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let shell_open = app_key.create_subkey("shell\\open\\command").map_err(|e| e.to_string())?.0;
    let cmd = format!("\"{}\" \"%1\"", exe.display());
    shell_open.set_value("", &cmd).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_iobit_unlocker() -> Result<String, String> {
    if let Some(path) = get_iobit_unlocker_exe() {
        Ok(format!("IObit Unlocker found at: {}", path.display()))
    } else {
        Err("IObit Unlocker not found. Please install IObit Unlocker to modify WindowsApps installations.".into())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct MinecraftOptions {
    gfx_options: HashMap<String, String>,
    instance_name: String,
    options_path: String,
}

#[tauri::command]
async fn get_minecraft_options() -> Result<Vec<MinecraftOptions>, String> {
    let local_app_data = local_app_data();
    let packages_dir = local_app_data.join("Packages");
    
    let minecraft_packages = [
        ("Microsoft.MinecraftUWP_8wekyb3d8bbwe", "Minecraft"),
        ("Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe", "Minecraft Preview"),
    ];
    
    // Define which options are graphics-related
    let graphics_related_keys = [
        "gfx_", // All gfx_ prefixed options
        "show_advanced_video_settings",
        "raytracing_viewdistance",
        "graphics_mode",
        "graphics_mode_switch",
        "gfx_viewdistance",
        "gfx_particleviewdistance",
        "gfx_viewbobbing",
        "gfx_fancygraphics",
        "gfx_transparentleaves",
        "gfx_smoothlighting",
        "gfx_fancyskies",
        "gfx_msaa",
        "gfx_texel_aa",
        "gfx_multithreaded_renderer",
        "gfx_vsync",
        "frame_pacing_enabled",
    ];
    
    let mut all_options = Vec::new();
    
    for (package_name, friendly_name) in minecraft_packages {
        let options_path = packages_dir
            .join(package_name)
            .join("LocalState")
            .join("games")
            .join("com.mojang")
            .join("minecraftpe")
            .join("options.txt");
        
        if options_path.exists() {
            match tokio::fs::read_to_string(&options_path).await {
                Ok(content) => {
                    let mut gfx_options = HashMap::new();
                    
                    for line in content.lines() {
                        if let Some((key, value)) = line.split_once(':') {
                            // Check if this key is graphics-related
                            let is_graphics = graphics_related_keys.iter().any(|&pattern| {
                                if pattern.ends_with('_') {
                                    key.starts_with(pattern)
                                } else {
                                    key == pattern
                                }
                            });
                            
                            if is_graphics {
                                gfx_options.insert(key.to_string(), value.to_string());
                            }
                        }
                    }
                    
                    all_options.push(MinecraftOptions {
                        gfx_options,
                        instance_name: friendly_name.to_string(),
                        options_path: options_path.to_string_lossy().to_string(),
                    });
                }
                Err(e) => {
                    eprintln!("Failed to read options file for {}: {}", friendly_name, e);
                }
            }
        }
    }
    
    if all_options.is_empty() {
        return Err("No Minecraft installations with options.txt found".into());
    }
    
    Ok(all_options)
}

#[tauri::command]
async fn save_minecraft_options(options_path: String, gfx_options: HashMap<String, String>) -> Result<(), String> {
    let path = PathBuf::from(&options_path);
    
    if !path.exists() {
        return Err(format!("Options file not found: {}", options_path));
    }
    
    // Read the current content
    let content = tokio::fs::read_to_string(&path).await
        .map_err(|e| format!("Failed to read options file: {}", e))?;
    
    let mut lines: Vec<String> = Vec::new();
    let mut processed_keys = std::collections::HashSet::new();
    
    // Update existing lines
    for line in content.lines() {
        if let Some((key, _)) = line.split_once(':') {
            if key.starts_with("gfx_") {
                // Update with new value if we have it
                if let Some(new_value) = gfx_options.get(key) {
                    lines.push(format!("{}:{}", key, new_value));
                    processed_keys.insert(key.to_string());
                } else {
                    // Keep the original line if not in our update map
                    lines.push(line.to_string());
                }
            } else {
                // Keep non-gfx options unchanged
                lines.push(line.to_string());
            }
        } else {
            // Keep lines that aren't key:value pairs
            lines.push(line.to_string());
        }
    }
    
    // Add any new gfx_ options that weren't in the file
    for (key, value) in &gfx_options {
        if !processed_keys.contains(key) {
            lines.push(format!("{}:{}", key, value));
        }
    }
    
    // Write back to file
    let new_content = lines.join("\n");
    tokio::fs::write(&path, new_content).await
        .map_err(|e| format!("Failed to write options file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn set_iobit_path(path: String) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    
    // Validate the path exists and is an executable
    if !path_buf.exists() {
        return Err("The specified file does not exist.".into());
    }
    
    // Check if it's IObitUnlocker.exe or a shortcut to it
    let file_name = path_buf.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    if !file_name.contains("iobitunlocker") && !file_name.ends_with(".lnk") {
        return Err("Please select IObitUnlocker.exe or a shortcut to it.".into());
    }
    
    // Save the path to config file
    let config_dir = brtx_dir();
    ensure_dir(&config_dir).map_err(|e| format!("Failed to create config directory: {e}"))?;
    let config_file = config_dir.join("iobit_path.txt");
    fs::write(&config_file, &path).map_err(|e| format!("Failed to save IObit path: {e}"))?;
    
    Ok(format!("IObit Unlocker path set to: {}", path))
}

#[tauri::command]
fn handle_file_drop(_paths: Vec<String>) -> Result<(), String> {
    // This command will be called from the frontend when files are dropped
    // The frontend will handle the actual file drop event and call this command
    // We don't need to do anything here as the frontend handles the logic
    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ProtocolData {
    protocol_type: String, // "preset" or "creator"
    id: String,
}

#[tauri::command]
fn handle_deep_link(url: String) -> Result<ProtocolData, String> {
    let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    
    if parsed_url.scheme() != "brtx" {
        return Err("Invalid protocol scheme".to_string());
    }
    
    let path = parsed_url.path();
    let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    
    if parts.len() != 2 {
        return Err("Invalid URL format. Expected brtx://preset/[uuid] or brtx://creator/[hash]".to_string());
    }
    
    let protocol_type = parts[0].to_string();
    let id = parts[1].to_string();
    
    if protocol_type != "preset" && protocol_type != "creator" {
        return Err("Invalid protocol type. Expected 'preset' or 'creator'".to_string());
    }
    
    Ok(ProtocolData { protocol_type, id })
}

#[tauri::command]
async fn download_preset_by_uuid(app_handle: tauri::AppHandle, uuid: String, selected_names: Vec<String>) -> Result<(), String> {
    // Get preset info from API
    let url = format!("https://bedrock.graphics/api/preset/{}", uuid);
    let client = Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let preset: PackInfo = response.json().await.map_err(|e| e.to_string())?;
    
    // Use existing download and install logic
    download_and_install_pack(app_handle, preset.uuid, selected_names).await
}

#[tauri::command]
fn get_brtx_dir() -> Result<String, String> {
    let dir = brtx_dir();
    dir.to_str()
        .ok_or_else(|| "Invalid path".to_string())
        .map(|s| s.to_string())
}


#[tauri::command]
async fn download_creator_settings(
    app_handle: tauri::AppHandle, 
    settings_hash: String, 
    selected_names: Vec<String>,
    preset_name: Option<String>,
    uuid: Option<String>
) -> Result<(), String> {
    let base_url = format!("https://bedrock.graphics/build/{}", settings_hash);
    let dir = brtx_dir().join("creator").join(&settings_hash);
    ensure_dir(&dir).map_err(|e| e.to_string())?;
    
    let client = Client::new();
    
    // Download the three material.bin files directly
    let stub_url = format!("{}/{}", base_url, "stubs/RTXStub.material.bin");
    let stub_path = dir.join("RTXStub.material.bin");
    download_to_file_with_cache(&client, &stub_url, &stub_path).await?;
    let tone_url = format!("{}/{}", base_url, "RTXPostFX.Tonemapping.material.bin");
    let tone_path = dir.join("RTXPostFX.Tonemapping.material.bin");
    download_to_file_with_cache(&client, &tone_url, &tone_path).await?;
    let bloom_url = format!("{}/{}", base_url, "RTXPostFX.Bloom.material.bin");
    let bloom_path = dir.join("RTXPostFX.Bloom.material.bin");
    download_to_file_with_cache(&client, &bloom_url, &bloom_path).await?;
    
    // Install the downloaded materials
    let materials = vec![
        dir.join("RTXStub.material.bin"),
        dir.join("RTXPostFX.Tonemapping.material.bin"),
        dir.join("RTXPostFX.Bloom.material.bin"),
    ];
    
    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    
    // Use provided name or fallback to hash-based name
    let display_name = preset_name.unwrap_or_else(|| {
        let short_hash = settings_hash.get(0..8).unwrap_or(&settings_hash);
        format!("Creator Settings ({})", short_hash)
    });
    
    // Use provided UUID or generate one from hash
    let creator_uuid = uuid.unwrap_or_else(|| format!("creator-{}", settings_hash));
        
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            let creator_pack = PackInfo {
                name: display_name.clone(),
                uuid: creator_uuid.clone(),
                stub: String::new(),
                tonemapping: String::new(),
                bloom: String::new(),
            };
            
            // Install materials using existing infrastructure
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, &creator_pack).await?;
            
            // Override the saved preset to mark it as creator-made
            let creator_preset = InstalledPreset {
                uuid: creator_uuid.clone(),
                name: display_name.clone(),
                installed_at: chrono::Utc::now().to_rfc3339(),
                is_creator: Some(true),
            };
            
            if let Err(e) = save_installed_preset(&ins.install_location, &creator_preset) {
                println!("⚠ Failed to save creator preset tracking: {}", e);
            }
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn install_uploaded_materials(
    app_handle: tauri::AppHandle,
    selected_names: Vec<String>,
    preset_name: Option<String>
) -> Result<(), String> {
    let uploaded_dir = brtx_dir().join("creator").join("uploaded");
    
    // Get all uploaded material files
    let materials: Vec<PathBuf> = if uploaded_dir.exists() {
        fs::read_dir(&uploaded_dir)
            .map_err(|e| e.to_string())?
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.is_file() && path.extension()?.to_str()? == "bin" {
                    Some(path)
                } else {
                    None
                }
            })
            .collect()
    } else {
        return Err("No uploaded material files found".to_string());
    };
    
    if materials.is_empty() {
        return Err("No material files to install".to_string());
    }
    
    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    
    let display_name = preset_name.unwrap_or_else(|| "Uploaded Materials".to_string());
    let material_uuid = format!("materials-{}", chrono::Utc::now().timestamp());
    
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            let material_pack = PackInfo {
                name: display_name.clone(),
                uuid: material_uuid.clone(),
                stub: String::new(),
                tonemapping: String::new(),
                bloom: String::new(),
            };
            
            // Install materials using existing infrastructure
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, &material_pack).await?;
            
            // Save as creator preset
            let creator_preset = InstalledPreset {
                uuid: material_uuid.clone(),
                name: display_name.clone(),
                installed_at: chrono::Utc::now().to_rfc3339(),
                is_creator: Some(true),
            };
            
            if let Err(e) = save_installed_preset(&ins.install_location, &creator_preset) {
                println!("⚠ Failed to save material preset tracking: {}", e);
            }
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn upload_material_file(source_path: String) -> Result<String, String> {
    // Extract filename from source path
    let source = Path::new(&source_path);
    let filename = source.file_name()
        .and_then(|name| name.to_str())
        .ok_or("Invalid filename")?;
    
    // Create target directory
    let target_dir = brtx_dir().join("creator").join("uploaded");
    ensure_dir(&target_dir).map_err(|e| e.to_string())?;
    
    // Copy file to target directory
    let target_path = target_dir.join(filename);
    fs::copy(&source, &target_path).map_err(|e| e.to_string())?;
    
    Ok(filename.to_string())
}

#[tauri::command]
fn validate_minecraft_path(path: String) -> Result<bool, String> {
    let minecraft_path = Path::new(&path);
    
    // Check if path exists
    if !minecraft_path.exists() {
        return Ok(false);
    }
    
    // Check for common Minecraft files/directories
    let required_paths = [
        "data",
        "AppxManifest.xml", // For UWP apps
        "Minecraft.exe",    // For some installations
    ];
    
    // At least one of these should exist for a valid Minecraft installation
    let has_minecraft_indicators = required_paths.iter().any(|&p| {
        minecraft_path.join(p).exists()
    });
    
    // Also check for materials directory structure
    let materials_dir = minecraft_path.join("data").join("renderer").join("materials");
    let has_materials_structure = materials_dir.exists() || minecraft_path.join("data").exists();
    
    Ok(has_minecraft_indicators || has_materials_structure)
}

#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .set_title("Select Minecraft Installation Folder")
        .blocking_pick_folder();

    match result {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
fn open_iobit_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .set_title("Select IObit Unlocker Executable")
        .add_filter("Executable Files", &["exe"])
        .add_filter("Shortcut Files", &["lnk"])
        .add_filter("All Files", &["*"])
        .blocking_pick_file();

    match result {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
fn get_iobit_path() -> Result<Option<String>, String> {
    if let Some(path) = get_iobit_path_cached() {
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn uninstall_rtx(app_handle: tauri::AppHandle, selected_names: Vec<String>) -> Result<(), String> {
    // Download original material.bin files from the uninstall API endpoints
    let dir = brtx_dir().join("uninstall");
    ensure_dir(&dir).map_err(|e| e.to_string())?;
    let client = Client::new();
    
    // Download original files with caching
    let stub_path = dir.join("RTXStub.material.bin");
    download_to_file_with_cache(&client, "https://bedrock.graphics/api/uninstall/rtxstub", &stub_path).await?;
    let tone_path = dir.join("RTXPostFX.Tonemapping.material.bin");
    download_to_file_with_cache(&client, "https://bedrock.graphics/api/uninstall/rtxpostfx", &tone_path).await?;
    let bloom_path = dir.join("RTXPostFX.Bloom.material.bin");
    download_to_file_with_cache(&client, "https://bedrock.graphics/api/uninstall/bloom", &bloom_path).await?;

    let materials = vec![
        stub_path.clone(),
        tone_path.clone(),
        bloom_path.clone(),
    ];
    
    let all = list_installations(app_handle.clone()).await?;
    let map: std::collections::HashMap<_, _> = all
        .into_iter()
        .map(|i| (i.install_location.clone(), i))
        .collect();
    
    for install_location in selected_names {
        if let Some(ins) = map.get(&install_location) {
            // Create a dummy pack for uninstall
            let uninstall_pack = PackInfo {
                name: "Original Files".to_string(),
                uuid: "uninstall-original".to_string(),
                stub: String::new(),
                tonemapping: String::new(),
                bloom: String::new(),
            };
            copy_shader_files_async(&app_handle, &ins.install_location, &materials, &uninstall_pack).await?;
            
            // Remove the installed preset tracking for this installation
            let presets_file = brtx_dir().join("installed_presets.json");
            if let Some(mut installations) = read_json_file::<HashMap<String, InstalledPreset>>(&presets_file) {
                installations.remove(&install_location);
                let _ = write_json_file(&presets_file, &installations);
            }
        } else {
            println!("⚠ Skipping unknown selection (no matching installation): {}", install_location);
        }
    }
    Ok(())
}

#[tauri::command]
async fn uninstall_package(app_handle: tauri::AppHandle, restore_initial: bool) -> Result<(), String> {
    if restore_initial {
        let all = list_installations(app_handle.clone()).await?;
        for ins in all {
            let backup = brtx_dir().join("backup").join(&ins.friendly_name);
            if backup.exists() {
                let materials = vec![
                    backup.join("RTXStub.material.bin"),
                    backup.join("RTXPostFX.Tonemapping.material.bin"),
                    backup.join("RTXPostFX.Bloom.material.bin"),
                ];
                let existing: Vec<PathBuf> = materials.into_iter().filter(|p| p.exists()).collect();
                if !existing.is_empty() { 
                    let dummy_pack = PackInfo {
                        name: "Backup Restore".to_string(),
                        uuid: "backup-restore".to_string(),
                        stub: String::new(),
                        tonemapping: String::new(),
                        bloom: String::new(),
                    };
                    copy_shader_files_async(&app_handle, &ins.install_location, &existing, &dummy_pack).await?; 
                }
            }
        }
    }
    
    // Clear installed presets tracking
    let presets_file = brtx_dir().join("installed_presets.json");
    if presets_file.exists() {
        let _ = fs::remove_file(&presets_file);
    }
    
    let _ = fs::remove_dir_all(brtx_dir());
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Handle command line arguments for file associations and deep links
            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let arg = &args[1];
                if arg.to_lowercase().ends_with(".rtpack") && std::path::Path::new(arg).exists() {
                    let _ = app.emit("rtpack-file-opened", arg);
                } else if arg.starts_with("brtx://") {
                    let _ = app.emit("deep-link-received", arg);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_installations,
            get_api_packs,
            list_presets,
            download_and_install_pack,
            install_from_rtpack,
            install_materials,
            backup_selected,
            install_dlss_for_selected,
            update_options_for_selected,
            register_rtpack_extension,
            register_brtx_protocol,
            is_brtx_protocol_registered,
            check_iobit_unlocker,
            get_minecraft_options,
            save_minecraft_options,
            set_iobit_path,
            get_iobit_path,
            open_iobit_file_dialog,
            handle_file_drop,
            uninstall_package,
            uninstall_rtx,
            clear_cache,
            get_cache_info,
            handle_deep_link,
            download_preset_by_uuid,
            download_creator_settings,
            upload_material_file,
            install_uploaded_materials,
            get_brtx_dir,
            validate_minecraft_path,
            open_folder_dialog,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

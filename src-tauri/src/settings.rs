use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "dikt";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
  pub base_url: String,
  pub model: String,
  pub hotkey: String,
  pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredSettings {
  base_url: String,
  model: String,
  hotkey: String,
}

impl Default for AppSettings {
  fn default() -> Self {
    Self {
      base_url: "https://api.openai.com/v1".to_string(),
      model: "whisper-1".to_string(),
      hotkey: "CommandOrControl+Shift+Space".to_string(),
      api_key: String::new(),
    }
  }
}

pub fn load_settings() -> AppSettings {
  let mut settings = AppSettings::default();

  if let Ok(path) = settings_path() {
    if let Ok(contents) = fs::read_to_string(&path) {
      if let Ok(stored) = serde_json::from_str::<StoredSettings>(&contents) {
        settings.base_url = stored.base_url;
        settings.model = stored.model;
        settings.hotkey = stored.hotkey;
      }
    }
  }

  if let Ok(Some(api_key)) = get_api_key() {
    settings.api_key = api_key;
  }

  settings
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
  let stored = StoredSettings {
    base_url: settings.base_url.clone(),
    model: settings.model.clone(),
    hotkey: settings.hotkey.clone(),
  };

  let path = settings_path()?;
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let contents = serde_json::to_string_pretty(&stored).map_err(|e| e.to_string())?;
  fs::write(&path, contents).map_err(|e| e.to_string())?;

  if settings.api_key.trim().is_empty() {
    delete_api_key()?;
  } else {
    store_api_key(&settings.api_key)?;
  }

  Ok(())
}

fn settings_path() -> Result<PathBuf, String> {
  let base_dir = if let Ok(appdata) = std::env::var("APPDATA") {
    PathBuf::from(appdata)
  } else if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
    PathBuf::from(xdg)
  } else if let Ok(home) = std::env::var("HOME") {
    PathBuf::from(home).join(".config")
  } else {
    std::env::temp_dir()
  };

  Ok(base_dir.join("dikt").join("settings.json"))
}

fn store_api_key(api_key: &str) -> Result<(), String> {
  let entry = keyring::Entry::new(SERVICE_NAME, "api-key").map_err(|e| e.to_string())?;
  entry.set_password(api_key).map_err(|e| e.to_string())?;
  Ok(())
}

fn get_api_key() -> Result<Option<String>, String> {
  let entry = keyring::Entry::new(SERVICE_NAME, "api-key").map_err(|e| e.to_string())?;
  match entry.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

fn delete_api_key() -> Result<(), String> {
  let entry = keyring::Entry::new(SERVICE_NAME, "api-key").map_err(|e| e.to_string())?;
  match entry.delete_credential() {
    Ok(_) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

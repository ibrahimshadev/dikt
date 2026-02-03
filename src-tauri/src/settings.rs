use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
  pub base_url: String,
  pub model: String,
  pub hotkey: String,
  pub api_key: String,
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

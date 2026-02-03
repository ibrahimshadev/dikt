use tauri::State;

use crate::clipboard;
use crate::settings::AppSettings;
use crate::state::AppState;
use crate::transcribe;

#[tauri::command]
pub fn start_recording(state: State<'_, AppState>) -> Result<(), String> {
    state.recorder.start()
}

#[tauri::command]
pub async fn stop_and_transcribe(state: State<'_, AppState>) -> Result<String, String> {
    let wav_data = state.recorder.stop()?;

    let settings = state.settings.lock().map_err(|_| "Settings lock poisoned")?.clone();

    let text =
        transcribe::transcribe(&settings.base_url, &settings.api_key, &settings.model, wav_data)
            .await?;

    clipboard::copy_and_paste(&text)?;

    Ok(text)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state
        .settings
        .lock()
        .map_err(|_| "Settings lock poisoned")?
        .clone())
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    crate::settings::save_settings(&settings)?;
    let mut guard = state
        .settings
        .lock()
        .map_err(|_| "Settings lock poisoned")?;
    *guard = settings;
    Ok(())
}

#[tauri::command]
pub async fn test_connection(settings: AppSettings) -> Result<String, String> {
    if settings.api_key.trim().is_empty() {
        return Err("Missing API key".to_string());
    }

    if settings.base_url.trim().is_empty() {
        return Err("Missing base URL".to_string());
    }

    if settings.model.trim().is_empty() {
        return Err("Missing model".to_string());
    }

    Ok("Settings look valid.".to_string())
}

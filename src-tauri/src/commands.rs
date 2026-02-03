use tauri::{LogicalSize, State, WebviewWindow};

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

#[tauri::command]
pub fn resize_window(window: WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;

    // Reposition to keep bottom anchored
    position_window_bottom_internal(&window)?;
    Ok(())
}

#[tauri::command]
pub fn position_window_bottom(window: WebviewWindow) -> Result<(), String> {
    position_window_bottom_internal(&window)
}

pub fn position_window_bottom_internal(window: &WebviewWindow) -> Result<(), String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;

    let monitor_size = monitor.size();
    let scale_factor = monitor.scale_factor();

    let window_size = window.outer_size().map_err(|e| e.to_string())?;

    let x = ((monitor_size.width as f64 / scale_factor) - (window_size.width as f64 / scale_factor))
        / 2.0;
    let y = (monitor_size.height as f64 / scale_factor)
        - (window_size.height as f64 / scale_factor)
        - 5.0; // 5px from bottom

    window
        .set_position(tauri::LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;

    Ok(())
}

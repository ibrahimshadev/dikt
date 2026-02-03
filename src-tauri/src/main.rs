mod audio;
mod clipboard;
mod commands;
mod settings;
mod state;
mod transcribe;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .manage(state::AppState::default())
    .invoke_handler(tauri::generate_handler![
      commands::start_recording,
      commands::stop_and_transcribe,
      commands::get_settings,
      commands::save_settings,
      commands::test_connection,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

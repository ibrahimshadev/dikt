use std::sync::Mutex;

use crate::audio::AudioRecorder;
use crate::settings::AppSettings;

pub struct AppState {
    pub recorder: AudioRecorder,
    pub settings: Mutex<AppSettings>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            recorder: AudioRecorder::default(),
            settings: Mutex::new(AppSettings::default()),
        }
    }
}

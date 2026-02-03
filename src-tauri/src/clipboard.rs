use std::thread;
use std::time::Duration;

use arboard::Clipboard;
use enigo::{Direction::{Click, Press, Release}, Enigo, Key, Keyboard, Settings};

pub fn copy_and_paste(text: &str) -> Result<(), String> {
  let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
  clipboard.set_text(text).map_err(|e| e.to_string())?;

  thread::sleep(Duration::from_millis(50));

  let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
  enigo.key(Key::Control, Press).map_err(|e| e.to_string())?;
  enigo.key(Key::Unicode('v'), Click).map_err(|e| e.to_string())?;
  enigo.key(Key::Control, Release).map_err(|e| e.to_string())?;

  Ok(())
}

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionHistoryItem {
    pub id: String,
    pub text: String,
    pub created_at_ms: i64,
}

fn history_path() -> Result<PathBuf, String> {
    let base_dir = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        PathBuf::from(xdg)
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".config")
    } else {
        std::env::temp_dir()
    };

    Ok(base_dir.join("dikt").join("transcription_history.json"))
}

fn load_history_from(path: &PathBuf) -> Vec<TranscriptionHistoryItem> {
    let contents = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_history_to(path: &PathBuf, items: &[TranscriptionHistoryItem]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let contents = serde_json::to_string_pretty(items).map_err(|e| e.to_string())?;
    fs::write(path, contents).map_err(|e| e.to_string())
}

pub fn load_history() -> Vec<TranscriptionHistoryItem> {
    match history_path() {
        Ok(p) => load_history_from(&p),
        Err(_) => Vec::new(),
    }
}

pub fn append_item(text: &str, max_items: usize) -> Result<(), String> {
    let path = history_path()?;
    let mut items = load_history_from(&path);

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let item = TranscriptionHistoryItem {
        id: uuid::Uuid::new_v4().to_string(),
        text: text.to_string(),
        created_at_ms: now_ms,
    };

    items.insert(0, item);
    items.truncate(max_items);

    save_history_to(&path, &items)
}

pub fn delete_item(id: &str) -> Result<(), String> {
    let path = history_path()?;
    let mut items = load_history_from(&path);
    items.retain(|item| item.id != id);
    save_history_to(&path, &items)
}

pub fn clear_history() -> Result<(), String> {
    let path = history_path()?;
    save_history_to(&path, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_path() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dikt_test_{}", uuid::Uuid::new_v4()));
        dir.join("dikt").join("transcription_history.json")
    }

    #[test]
    fn load_empty_returns_empty_vec() {
        let path = test_path();
        let items = load_history_from(&path);
        assert!(items.is_empty());
    }

    #[test]
    fn save_load_roundtrip() {
        let path = test_path();
        let items = vec![TranscriptionHistoryItem {
            id: "test-1".to_string(),
            text: "Hello world".to_string(),
            created_at_ms: 1000,
        }];
        save_history_to(&path, &items).unwrap();
        let loaded = load_history_from(&path);
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "test-1");
        assert_eq!(loaded[0].text, "Hello world");
        let _ = fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn append_prepends_and_trims() {
        let path = test_path();
        for i in 0..5 {
            let mut items = load_history_from(&path);
            let item = TranscriptionHistoryItem {
                id: uuid::Uuid::new_v4().to_string(),
                text: format!("item {i}"),
                created_at_ms: i as i64,
            };
            items.insert(0, item);
            items.truncate(3);
            save_history_to(&path, &items).unwrap();
        }
        let items = load_history_from(&path);
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].text, "item 4");
        assert_eq!(items[1].text, "item 3");
        assert_eq!(items[2].text, "item 2");
        let _ = fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn delete_by_id() {
        let path = test_path();
        let items = vec![
            TranscriptionHistoryItem {
                id: "a".to_string(),
                text: "two".to_string(),
                created_at_ms: 2,
            },
            TranscriptionHistoryItem {
                id: "b".to_string(),
                text: "one".to_string(),
                created_at_ms: 1,
            },
        ];
        save_history_to(&path, &items).unwrap();

        let mut loaded = load_history_from(&path);
        loaded.retain(|item| item.id != "a");
        save_history_to(&path, &loaded).unwrap();

        let result = load_history_from(&path);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].text, "one");
        let _ = fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn clear_removes_all() {
        let path = test_path();
        let items = vec![TranscriptionHistoryItem {
            id: "a".to_string(),
            text: "hello".to_string(),
            created_at_ms: 1,
        }];
        save_history_to(&path, &items).unwrap();
        save_history_to(&path, &[]).unwrap();
        let result = load_history_from(&path);
        assert!(result.is_empty());
        let _ = fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn malformed_json_returns_empty() {
        let path = test_path();
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "not valid json!!!").unwrap();
        let items = load_history_from(&path);
        assert!(items.is_empty());
        let _ = fs::remove_dir_all(path.parent().unwrap().parent().unwrap());
    }
}

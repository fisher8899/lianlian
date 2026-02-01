use enigo::{Enigo, MouseControllable, MouseButton};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
struct ControlEvent {
    #[serde(rename = "type")]
    event_type: String, // mousemove, mousedown, mouseup, keypress
    x: Option<i32>,
    y: Option<i32>,
    button: Option<String>, // left, right
    key: Option<String>,
}

#[tauri::command]
fn remote_control(payload: String) {
    let mut enigo = Enigo::new();
    
    if let Ok(event) = serde_json::from_str::<ControlEvent>(&payload) {
        // println!("Control: {:?}", event); // 可以在这里打印日志
        match event.event_type.as_str() {
            "mousemove" => {
                if let (Some(x), Some(y)) = (event.x, event.y) {
                    enigo.mouse_move_to(x, y);
                }
            },
            "mousedown" => {
                let btn = match event.button.as_deref() {
                    Some("right") => MouseButton::Right,
                    _ => MouseButton::Left,
                };
                enigo.mouse_down(btn);
            },
            "mouseup" => {
                let btn = match event.button.as_deref() {
                    Some("right") => MouseButton::Right,
                    _ => MouseButton::Left,
                };
                enigo.mouse_up(btn);
            },
            // TODO: Add keypress support
            _ => {}
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![remote_control])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

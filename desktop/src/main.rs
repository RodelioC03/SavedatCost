#![cfg_attr(windows, windows_subsystem = "windows")]

use std::{env, path::PathBuf, process::Command, thread, time::Duration};

use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::{Icon, WindowBuilder},
};
use wry::WebViewBuilder;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn app_directory() -> PathBuf {
    env::current_exe()
        .expect("Could not locate SavedatCost.exe")
        .parent()
        .expect("SavedatCost.exe has no parent directory")
        .to_path_buf()
}

fn start_local_backend(directory: &PathBuf) -> std::process::Child {
    let node = directory.join("runtime").join("node.exe");
    let server = directory.join("server.js");
    let mut command = Command::new(node);
    command.arg(server).current_dir(directory);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command.spawn().expect("Could not start the local SavedatCost database service")
}

fn main() {
    let directory = app_directory();
    let mut backend = start_local_backend(&directory);
    thread::sleep(Duration::from_millis(700));

    let event_loop = EventLoop::new();
    let icon = Icon::from_rgba(include_bytes!("../assets/savedatcost.rgba").to_vec(), 256, 256).ok();
    let mut window_builder = WindowBuilder::new()
        .with_title("SavedatCost — Finance Workbench")
        .with_inner_size(tao::dpi::LogicalSize::new(1320.0, 820.0))
        .with_min_inner_size(tao::dpi::LogicalSize::new(960.0, 640.0));
    if let Some(icon) = icon { window_builder = window_builder.with_window_icon(Some(icon)); }
    let window = window_builder
        .build(&event_loop)
        .expect("Could not create the SavedatCost window");

    let _webview = WebViewBuilder::new()
        .with_url("http://127.0.0.1:5173")
        .build(&window)
        .expect("Could not create the SavedatCost WebView");

    event_loop.run(move |event, _, control_flow| {
            *control_flow = ControlFlow::Wait;
            if let Event::WindowEvent { event: WindowEvent::CloseRequested, .. } = event {
                let _ = backend.kill();
                *control_flow = ControlFlow::Exit;
            }
        });
}

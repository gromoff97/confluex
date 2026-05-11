mod archive;
mod process;
mod release;
mod versioning;

use camino::Utf8PathBuf;
use release::{PublishArgs, PublishLevel};

fn main() {
    if let Err(error) = run() {
        eprintln!("ERROR: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() || args[0] == "--help" || args[0] == "-h" {
        print_help();
        return Ok(());
    }
    match args.remove(0).as_str() {
        "publish" => run_publish(args),
        other => Err(format!("unknown xtask command: {other}").into()),
    }
}

fn run_publish(args: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
    let mut level = None;
    let mut dry_run = false;
    for arg in args {
        match arg.as_str() {
            "fix" => level = Some(PublishLevel::Fix),
            "minor" => level = Some(PublishLevel::Minor),
            "major" => level = Some(PublishLevel::Major),
            "--dry-run" => dry_run = true,
            other => return Err(format!("unsupported publish argument: {other}").into()),
        }
    }
    if dry_run {
        return Err("publish --dry-run is not supported; use `cargo publish --dry-run -p confluex` for package checks".into());
    }
    let root = Utf8PathBuf::from_path_buf(std::env::current_dir()?)
        .map_err(|path| format!("workspace path is not UTF-8: {}", path.display()))?;
    release::run(PublishArgs {
        root,
        level: level.ok_or("publish level is required: major, minor, or fix")?,
    })?;
    Ok(())
}

fn print_help() {
    println!("Usage:");
    println!("  cargo xtask publish <major|minor|fix>");
}

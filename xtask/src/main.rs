mod archive;
mod process;
mod release;
mod versioning;

use camino::Utf8PathBuf;
use release::{ReleaseArgs, ReleaseLevel};

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
        "release" => run_release(args),
        other => Err(format!("unknown xtask command: {other}").into()),
    }
}

fn run_release(args: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
    let mut level = None;
    let mut dry_run = false;
    for arg in args {
        match arg.as_str() {
            "patch" => level = Some(ReleaseLevel::Patch),
            "minor" => level = Some(ReleaseLevel::Minor),
            "major" => level = Some(ReleaseLevel::Major),
            "--dry-run" => dry_run = true,
            other => return Err(format!("unsupported release argument: {other}").into()),
        }
    }
    let root = Utf8PathBuf::from_path_buf(std::env::current_dir()?)
        .map_err(|path| format!("workspace path is not UTF-8: {}", path.display()))?;
    release::run(ReleaseArgs {
        root,
        level: level.ok_or("release level is required: patch, minor, or major")?,
        dry_run,
    })?;
    Ok(())
}

fn print_help() {
    println!("Usage:");
    println!("  cargo xtask release <patch|minor|major> [--dry-run]");
}

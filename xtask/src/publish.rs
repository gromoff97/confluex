use camino::{Utf8Path, Utf8PathBuf};
use thiserror::Error;

use crate::archive::{self, Artifact};
use crate::process;
use crate::versioning::{self, BumpLevel};

#[derive(Clone, Copy, Debug)]
pub enum PublishLevel {
    Fix,
    Minor,
    Major,
}

#[derive(Debug)]
pub struct PublishArgs {
    pub root: Utf8PathBuf,
    pub level: PublishLevel,
}

#[derive(Debug, Error)]
pub enum PublishError {
    #[error(transparent)]
    Versioning(#[from] versioning::VersioningError),
    #[error(transparent)]
    Archive(#[from] archive::ArchiveError),
    #[error(transparent)]
    Process(#[from] process::ProcessError),
    #[error("working tree is dirty:\n{0}")]
    Dirty(String),
}

pub fn run(args: PublishArgs) -> Result<(), PublishError> {
    assert_clean_git(&args.root)?;
    process::run(&args.root, "gh", &["auth", "status"])?;

    let current = versioning::read_current_workspace_version(&args.root)?;
    let next = versioning::bump(&current, to_bump_level(args.level));
    let tag = format!("v{next}");
    println!("publish version: {current} -> {next}");

    versioning::set_workspace_version(&args.root, &next)?;
    process::run(&args.root, "cargo", &["check", "--workspace"])?;
    process::run(
        &args.root,
        "cargo",
        &["build", "--release", "-p", "confluex"],
    )?;

    let artifact = archive::build_source_archive(&args.root, &next)?;
    print_artifact(&artifact);

    process::run(
        &args.root,
        "git",
        &["add", "crates/confluex/Cargo.toml", "Cargo.lock"],
    )?;
    process::run(
        &args.root,
        "git",
        &["commit", "-m", &format!("release: {tag}")],
    )?;
    process::run(
        &args.root,
        "cargo",
        &["publish", "--dry-run", "-p", "confluex"],
    )?;
    process::run(&args.root, "git", &["tag", &tag])?;
    process::run(&args.root, "cargo", &["publish", "-p", "confluex"])?;
    process::run(&args.root, "git", &["push"])?;
    process::run(&args.root, "git", &["push", "origin", &tag])?;
    upload_release(&args.root, &tag, &artifact)?;
    Ok(())
}

fn to_bump_level(level: PublishLevel) -> BumpLevel {
    match level {
        PublishLevel::Fix => BumpLevel::Fix,
        PublishLevel::Minor => BumpLevel::Minor,
        PublishLevel::Major => BumpLevel::Major,
    }
}

fn assert_clean_git(root: &Utf8Path) -> Result<(), PublishError> {
    let status = process::run(root, "git", &["status", "--porcelain"])?;
    if !status.trim().is_empty() {
        return Err(PublishError::Dirty(status));
    }
    Ok(())
}

fn upload_release(root: &Utf8Path, tag: &str, artifact: &Artifact) -> Result<(), PublishError> {
    if !process::succeeds(root, "gh", &["release", "view", tag])? {
        process::run(
            root,
            "gh",
            &["release", "create", tag, "--title", tag, "--notes", tag],
        )?;
    }
    process::run(
        root,
        "gh",
        &[
            "release",
            "upload",
            tag,
            artifact.archive_path.as_str(),
            artifact.sha256_path.as_str(),
            "--clobber",
        ],
    )?;
    Ok(())
}

fn print_artifact(artifact: &Artifact) {
    println!("artifact: {}", artifact.archive_path);
    println!("sha256: {}", artifact.sha256);
    println!("sha256 file: {}", artifact.sha256_path);
}

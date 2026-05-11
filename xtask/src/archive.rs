use std::fs::File;
use std::io::{BufReader, Read, Write};

use camino::{Utf8Path, Utf8PathBuf};
use flate2::write::GzEncoder;
use flate2::Compression;
use semver::Version;
use sha2::{Digest, Sha256};
use tar::Builder;
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Debug)]
pub struct Artifact {
    pub archive_path: Utf8PathBuf,
    pub sha256_path: Utf8PathBuf,
    pub sha256: String,
}

#[derive(Debug, Error)]
pub enum ArchiveError {
    #[error("I/O error for {path}: {source}")]
    Io {
        path: Utf8PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("walkdir error: {0}")]
    Walkdir(#[from] walkdir::Error),
    #[error("non UTF-8 path: {0}")]
    NonUtf8(String),
    #[error("path {path} is outside root {root}")]
    OutsideRoot {
        path: Utf8PathBuf,
        root: Utf8PathBuf,
    },
}

pub fn build_source_archive(root: &Utf8Path, version: &Version) -> Result<Artifact, ArchiveError> {
    let out_dir = root.join("target/confluex-release");
    fs_err::create_dir_all(&out_dir).map_err(|source| ArchiveError::Io {
        path: out_dir.clone(),
        source,
    })?;

    let base_name = format!("confluex-{version}-source");
    let stage = tempfile::tempdir_in(&out_dir).map_err(|source| ArchiveError::Io {
        path: out_dir.clone(),
        source,
    })?;
    let stage_root = Utf8PathBuf::from_path_buf(stage.path().join(&base_name))
        .map_err(|path| ArchiveError::NonUtf8(path.display().to_string()))?;
    fs_err::create_dir_all(&stage_root).map_err(|source| ArchiveError::Io {
        path: stage_root.clone(),
        source,
    })?;
    copy_release_inputs(root, &stage_root)?;

    let archive_path = out_dir.join(format!("{base_name}.tar.gz"));
    let archive_file = File::create(&archive_path).map_err(|source| ArchiveError::Io {
        path: archive_path.clone(),
        source,
    })?;
    let encoder = GzEncoder::new(archive_file, Compression::best());
    let mut tar = Builder::new(encoder);
    tar.append_dir_all(&base_name, stage_root.as_std_path())
        .map_err(|source| ArchiveError::Io {
            path: archive_path.clone(),
            source,
        })?;
    let encoder = tar.into_inner().map_err(|source| ArchiveError::Io {
        path: archive_path.clone(),
        source,
    })?;
    encoder.finish().map_err(|source| ArchiveError::Io {
        path: archive_path.clone(),
        source,
    })?;

    let sha256 = sha256_file(&archive_path)?;
    let sha256_path = out_dir.join(format!("{base_name}.tar.gz.sha256"));
    let mut sha_file = File::create(&sha256_path).map_err(|source| ArchiveError::Io {
        path: sha256_path.clone(),
        source,
    })?;
    writeln!(
        sha_file,
        "{sha256}  {}",
        archive_path.file_name().unwrap_or("confluex-source.tar.gz")
    )
    .map_err(|source| ArchiveError::Io {
        path: sha256_path.clone(),
        source,
    })?;

    Ok(Artifact {
        archive_path,
        sha256_path,
        sha256,
    })
}

fn copy_release_inputs(root: &Utf8Path, stage_root: &Utf8Path) -> Result<(), ArchiveError> {
    for file in ["Cargo.toml", "Cargo.lock", "README.md", "LICENSE"] {
        copy_file(root, stage_root, file)?;
    }
    remove_xtask_workspace_member(&stage_root.join("Cargo.toml"))?;
    copy_tree(root, stage_root, "crates/confluex-cli")?;
    copy_tree(root, stage_root, "crates/confluex-core")?;
    Ok(())
}

fn remove_xtask_workspace_member(path: &Utf8Path) -> Result<(), ArchiveError> {
    let text = fs_err::read_to_string(path).map_err(|source| ArchiveError::Io {
        path: path.to_owned(),
        source,
    })?;
    let text = text
        .replace("  \"xtask\",\n", "")
        .replace("  \"xtask\"\n", "");
    fs_err::write(path, text).map_err(|source| ArchiveError::Io {
        path: path.to_owned(),
        source,
    })
}

fn copy_file(root: &Utf8Path, stage_root: &Utf8Path, relative: &str) -> Result<(), ArchiveError> {
    let from = root.join(relative);
    let to = stage_root.join(relative);
    if let Some(parent) = to.parent() {
        fs_err::create_dir_all(parent).map_err(|source| ArchiveError::Io {
            path: parent.to_owned(),
            source,
        })?;
    }
    fs_err::copy(&from, &to).map_err(|source| ArchiveError::Io { path: from, source })?;
    Ok(())
}

fn copy_tree(root: &Utf8Path, stage_root: &Utf8Path, relative: &str) -> Result<(), ArchiveError> {
    let source_root = root.join(relative);
    for entry in WalkDir::new(source_root.as_std_path()) {
        let entry = entry?;
        if entry.file_type().is_dir() {
            continue;
        }
        let source = Utf8PathBuf::from_path_buf(entry.path().to_path_buf())
            .map_err(|path| ArchiveError::NonUtf8(path.display().to_string()))?;
        if source.components().any(|part| part.as_str() == "target") {
            continue;
        }
        let rel = source
            .strip_prefix(root)
            .map_err(|_| ArchiveError::OutsideRoot {
                path: source.clone(),
                root: root.to_owned(),
            })?;
        copy_file(root, stage_root, rel.as_str())?;
    }
    Ok(())
}

fn sha256_file(path: &Utf8Path) -> Result<String, ArchiveError> {
    let file = File::open(path).map_err(|source| ArchiveError::Io {
        path: path.to_owned(),
        source,
    })?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|source| ArchiveError::Io {
                path: path.to_owned(),
                source,
            })?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let digest = hasher.finalize();
    let bytes: &[u8] = AsRef::<[u8]>::as_ref(&digest);
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

use camino::{Utf8Path, Utf8PathBuf};
use semver::Version;
use thiserror::Error;
use toml_edit::{value, DocumentMut};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BumpLevel {
    Fix,
    Minor,
    Major,
}

#[derive(Debug, Error)]
pub enum VersioningError {
    #[error("failed to read {path}: {source}")]
    Read {
        path: Utf8PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse TOML {path}: {source}")]
    Toml {
        path: Utf8PathBuf,
        #[source]
        source: toml_edit::TomlError,
    },
    #[error("manifest {path} is missing package.version")]
    MissingVersion { path: Utf8PathBuf },
    #[error("failed to parse semver `{version}` from {path}: {source}")]
    Semver {
        path: Utf8PathBuf,
        version: String,
        #[source]
        source: semver::Error,
    },
    #[error("failed to write {path}: {source}")]
    Write {
        path: Utf8PathBuf,
        #[source]
        source: std::io::Error,
    },
}

pub fn bump(version: &Version, level: BumpLevel) -> Version {
    match level {
        BumpLevel::Fix => Version::new(version.major, version.minor, version.patch + 1),
        BumpLevel::Minor => Version::new(version.major, version.minor + 1, 0),
        BumpLevel::Major => Version::new(version.major + 1, 0, 0),
    }
}

pub fn read_package_version(path: &Utf8Path) -> Result<Version, VersioningError> {
    let text = fs_err::read_to_string(path).map_err(|source| VersioningError::Read {
        path: path.to_owned(),
        source,
    })?;
    let doc = text
        .parse::<DocumentMut>()
        .map_err(|source| VersioningError::Toml {
            path: path.to_owned(),
            source,
        })?;
    let version =
        doc["package"]["version"]
            .as_str()
            .ok_or_else(|| VersioningError::MissingVersion {
                path: path.to_owned(),
            })?;
    Version::parse(version).map_err(|source| VersioningError::Semver {
        path: path.to_owned(),
        version: version.to_owned(),
        source,
    })
}

pub fn set_package_version(path: &Utf8Path, next: &Version) -> Result<(), VersioningError> {
    let text = fs_err::read_to_string(path).map_err(|source| VersioningError::Read {
        path: path.to_owned(),
        source,
    })?;
    let mut doc = text
        .parse::<DocumentMut>()
        .map_err(|source| VersioningError::Toml {
            path: path.to_owned(),
            source,
        })?;
    doc["package"]["version"] = value(next.to_string());
    fs_err::write(path, doc.to_string()).map_err(|source| VersioningError::Write {
        path: path.to_owned(),
        source,
    })
}

pub fn read_current_workspace_version(root: &Utf8Path) -> Result<Version, VersioningError> {
    read_package_version(&root.join("crates/confluex/Cargo.toml"))
}

pub fn set_workspace_version(root: &Utf8Path, next: &Version) -> Result<(), VersioningError> {
    set_package_version(&root.join("crates/confluex/Cargo.toml"), next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bump_patch_increments_patch_only() {
        assert_eq!(
            bump(&Version::new(1, 2, 3), BumpLevel::Fix),
            Version::new(1, 2, 4)
        );
    }

    #[test]
    fn bump_minor_resets_patch() {
        assert_eq!(
            bump(&Version::new(1, 2, 3), BumpLevel::Minor),
            Version::new(1, 3, 0)
        );
    }

    #[test]
    fn bump_major_resets_minor_and_patch() {
        assert_eq!(
            bump(&Version::new(1, 2, 3), BumpLevel::Major),
            Version::new(2, 0, 0)
        );
    }
}

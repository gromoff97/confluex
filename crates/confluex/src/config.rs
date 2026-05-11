//! Configuration loading, source provenance, and option merging.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;

use camino::{Utf8Path, Utf8PathBuf};
use serde::de::{self, IgnoredAny, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::cli::ExportRequest;

pub const PUBLIC_JSON_CONFIG_KEYS: [&str; 9] = [
    "confluenceBaseUrl",
    "confluenceToken",
    "insecure",
    "outputRoot",
    "maxPages",
    "maxDownloadMib",
    "sleepMs",
    "maxFindCandidates",
    "linkDepth",
];

pub const PUBLIC_ENV_CONFIG_KEYS: [&str; 2] =
    ["CONFLUEX_CONFLUENCE_BASE_URL", "CONFLUEX_CONFLUENCE_TOKEN"];

const JS_MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct JsonConfig {
    pub confluence_base_url: Option<String>,
    pub confluence_token: Option<String>,
    pub insecure: Option<bool>,
    pub output_root: Option<Utf8PathBuf>,
    pub max_pages: Option<u64>,
    pub max_download_mib: Option<u64>,
    pub sleep_ms: Option<u64>,
    pub max_find_candidates: Option<u64>,
    pub link_depth: Option<u64>,
}

impl<'de> Deserialize<'de> for JsonConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(JsonConfigVisitor)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LoadedJsonConfig {
    Ok {
        path: Utf8PathBuf,
        config: JsonConfig,
    },
    Absent {
        path: Utf8PathBuf,
    },
    Invalid {
        path: Utf8PathBuf,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputRootProvenance {
    Explicit,
    Configured,
    Generated,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigurationSession {
    pub values: BTreeMap<String, String>,
    pub output_root_provenance: OutputRootProvenance,
    pub user_config_path: Option<Utf8PathBuf>,
    pub secrets: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigurationSessionInput {
    pub argv_values: BTreeMap<String, String>,
    pub explicit_config: JsonConfig,
    pub user_config: JsonConfig,
    pub env: EnvMap,
    pub user_config_path: Option<Utf8PathBuf>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EnvMap(pub BTreeMap<String, String>);

impl EnvMap {
    pub fn from_current_process() -> Self {
        Self(std::env::vars().collect())
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).map(String::as_str)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetupUserConfig {
    pub confluence_base_url: String,
    pub confluence_token: String,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("invalid JSON configuration")]
    InvalidJson,
    #[error("invalid configuration path")]
    InvalidPath,
    #[error("missing home directory")]
    MissingHome,
    #[error("user configuration write failed: {0}")]
    Write(String),
}

pub fn decode_strict_utf8_json_config(bytes: &[u8]) -> Result<JsonConfig, ConfigError> {
    let text = std::str::from_utf8(bytes).map_err(|_| ConfigError::InvalidJson)?;
    serde_json::from_str::<JsonConfig>(text).map_err(|_| ConfigError::InvalidJson)
}

pub fn load_explicit_json_config(cwd: &Utf8Path, source_path: &str) -> LoadedJsonConfig {
    let Some(config_path) = normalize_config_path(cwd, source_path) else {
        return LoadedJsonConfig::Invalid {
            path: Utf8PathBuf::from(source_path),
        };
    };

    let metadata = match std::fs::symlink_metadata(&config_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return LoadedJsonConfig::Absent { path: config_path };
        }
        Err(_) => return LoadedJsonConfig::Invalid { path: config_path },
    };

    if !metadata.file_type().is_file() {
        return LoadedJsonConfig::Invalid { path: config_path };
    }

    let bytes = match std::fs::read(&config_path) {
        Ok(bytes) => bytes,
        Err(_) => return LoadedJsonConfig::Invalid { path: config_path },
    };

    match decode_strict_utf8_json_config(&bytes) {
        Ok(config) => LoadedJsonConfig::Ok {
            path: config_path,
            config,
        },
        Err(_) => LoadedJsonConfig::Invalid { path: config_path },
    }
}

pub fn user_config_path(env: &EnvMap) -> Result<Utf8PathBuf, ConfigError> {
    if cfg!(windows) {
        let appdata = non_empty(env.get("APPDATA")).ok_or(ConfigError::MissingHome)?;
        return Ok(Utf8PathBuf::from(appdata)
            .join("confluex")
            .join("config.json"));
    }

    let config_root = non_empty(env.get("XDG_CONFIG_HOME"))
        .map(Utf8PathBuf::from)
        .or_else(|| non_empty(env.get("HOME")).map(|home| Utf8PathBuf::from(home).join(".config")))
        .ok_or(ConfigError::MissingHome)?;
    Ok(config_root.join("confluex").join("config.json"))
}

pub fn load_user_config(env: &EnvMap) -> LoadedJsonConfig {
    let config_path = match user_config_path(env) {
        Ok(path) => path,
        Err(_) => {
            return LoadedJsonConfig::Invalid {
                path: Utf8PathBuf::new(),
            }
        }
    };

    let bytes = match std::fs::read(&config_path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return LoadedJsonConfig::Ok {
                path: config_path,
                config: JsonConfig::default(),
            };
        }
        Err(_) => return LoadedJsonConfig::Invalid { path: config_path },
    };

    match decode_strict_utf8_json_config(&bytes) {
        Ok(config) => LoadedJsonConfig::Ok {
            path: config_path,
            config,
        },
        Err(_) => LoadedJsonConfig::Invalid { path: config_path },
    }
}

pub async fn write_user_config(
    config: &SetupUserConfig,
    env: &EnvMap,
) -> Result<Utf8PathBuf, ConfigError> {
    let path = user_config_path(env)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| ConfigError::Write(error.to_string()))?;
    }
    let body = serde_json::to_string_pretty(config).map_err(|_| ConfigError::InvalidJson)? + "\n";
    tokio::fs::write(&path, body)
        .await
        .map_err(|error| ConfigError::Write(error.to_string()))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let permissions = std::fs::Permissions::from_mode(0o600);
        tokio::fs::set_permissions(&path, permissions)
            .await
            .map_err(|error| ConfigError::Write(error.to_string()))?;
    }

    Ok(path)
}

pub fn build_configuration_session(input: ConfigurationSessionInput) -> ConfigurationSession {
    let had_argv_out = input.argv_values.contains_key("--out");
    let mut values = input.argv_values;
    apply_configured_value(
        &mut values,
        "--out",
        input.explicit_config.output_root.as_ref(),
        input.user_config.output_root.as_ref(),
    );
    apply_configured_value(
        &mut values,
        "--max-pages",
        input.explicit_config.max_pages,
        input.user_config.max_pages,
    );
    apply_configured_value(
        &mut values,
        "--max-download-mib",
        input.explicit_config.max_download_mib,
        input.user_config.max_download_mib,
    );
    apply_configured_value(
        &mut values,
        "--sleep-ms",
        input.explicit_config.sleep_ms,
        input.user_config.sleep_ms,
    );
    apply_configured_value(
        &mut values,
        "--max-find-candidates",
        input.explicit_config.max_find_candidates,
        input.user_config.max_find_candidates,
    );
    apply_configured_value(
        &mut values,
        "--link-depth",
        input.explicit_config.link_depth,
        input.user_config.link_depth,
    );

    let output_root_provenance = if had_argv_out {
        OutputRootProvenance::Explicit
    } else if values.contains_key("--out") {
        OutputRootProvenance::Configured
    } else {
        OutputRootProvenance::Generated
    };

    ConfigurationSession {
        values,
        output_root_provenance,
        user_config_path: input.user_config_path,
        secrets: selected_secrets(&input.explicit_config, &input.user_config, &input.env),
    }
}

pub fn apply_effective_configuration(
    mut request: ExportRequest,
    explicit_config: &JsonConfig,
    user_config: &JsonConfig,
    env: &EnvMap,
) -> EffectiveExportRequest {
    if request.output_root.is_none() {
        request.output_root = selected_config_value(
            explicit_config.output_root.as_ref(),
            user_config.output_root.as_ref(),
        )
        .cloned();
    }
    if request.max_pages.is_none() {
        request.max_pages = selected_config_value(explicit_config.max_pages, user_config.max_pages);
    }
    if request.max_download_mib.is_none() {
        request.max_download_mib = selected_config_value(
            explicit_config.max_download_mib,
            user_config.max_download_mib,
        );
    }
    if request.sleep_ms.is_none() {
        request.sleep_ms = selected_config_value(explicit_config.sleep_ms, user_config.sleep_ms);
    }
    if request.max_find_candidates.is_none() {
        request.max_find_candidates = selected_config_value(
            explicit_config.max_find_candidates,
            user_config.max_find_candidates,
        );
    }
    if request.link_depth.is_none() {
        request.link_depth =
            selected_config_value(explicit_config.link_depth, user_config.link_depth);
    }
    if !request.insecure {
        request.insecure =
            selected_config_value(explicit_config.insecure, user_config.insecure).unwrap_or(false);
    }

    EffectiveExportRequest {
        request,
        confluence_base_url: selected_string_config_or_env(
            explicit_config.confluence_base_url.as_deref(),
            user_config.confluence_base_url.as_deref(),
            env,
            "CONFLUEX_CONFLUENCE_BASE_URL",
        )
        .map(str::to_owned),
        confluence_token: selected_string_config_or_env(
            explicit_config.confluence_token.as_deref(),
            user_config.confluence_token.as_deref(),
            env,
            "CONFLUEX_CONFLUENCE_TOKEN",
        )
        .map(str::to_owned),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EffectiveExportRequest {
    pub request: ExportRequest,
    pub confluence_base_url: Option<String>,
    pub confluence_token: Option<String>,
}

struct JsonConfigVisitor;

impl<'de> Visitor<'de> for JsonConfigVisitor {
    type Value = JsonConfig;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a Confluex JSON configuration object")
    }

    fn visit_map<M>(self, mut map: M) -> Result<Self::Value, M::Error>
    where
        M: MapAccess<'de>,
    {
        let mut seen = BTreeSet::new();
        let mut config = JsonConfig::default();

        while let Some(key) = map.next_key::<String>()? {
            if !seen.insert(key.clone()) {
                let _: IgnoredAny = map.next_value()?;
                return Err(de::Error::custom("duplicate JSON config key"));
            }

            match key.as_str() {
                "confluenceBaseUrl" => config.confluence_base_url = Some(map.next_value()?),
                "confluenceToken" => config.confluence_token = Some(map.next_value()?),
                "insecure" => config.insecure = Some(map.next_value()?),
                "outputRoot" => config.output_root = Some(map.next_value()?),
                "maxPages" => {
                    config.max_pages = Some(positive_safe_integer(map.next_value::<Value>()?)?)
                }
                "maxDownloadMib" => {
                    config.max_download_mib =
                        Some(positive_safe_integer(map.next_value::<Value>()?)?)
                }
                "sleepMs" => {
                    config.sleep_ms = Some(non_negative_safe_integer(map.next_value::<Value>()?)?)
                }
                "maxFindCandidates" => {
                    config.max_find_candidates =
                        Some(positive_safe_integer(map.next_value::<Value>()?)?)
                }
                "linkDepth" => {
                    config.link_depth = Some(non_negative_safe_integer(map.next_value::<Value>()?)?)
                }
                _ => {
                    let _: IgnoredAny = map.next_value()?;
                    return Err(de::Error::unknown_field(&key, &PUBLIC_JSON_CONFIG_KEYS));
                }
            }
        }

        Ok(config)
    }
}

fn positive_safe_integer<E>(value: Value) -> Result<u64, E>
where
    E: de::Error,
{
    let integer = safe_integer::<E>(value)?;
    if integer == 0 {
        return Err(E::custom("expected positive safe integer"));
    }
    Ok(integer)
}

fn non_negative_safe_integer<E>(value: Value) -> Result<u64, E>
where
    E: de::Error,
{
    safe_integer(value)
}

fn safe_integer<E>(value: Value) -> Result<u64, E>
where
    E: de::Error,
{
    let Value::Number(number) = value else {
        return Err(E::custom("expected safe integer"));
    };

    if let Some(unsigned) = number.as_u64() {
        return safe_integer_limit(unsigned);
    }

    let Some(float) = number.as_f64() else {
        return Err(E::custom("expected safe integer"));
    };
    if !float.is_finite() || float.is_sign_negative() || float.fract() != 0.0 {
        return Err(E::custom("expected safe integer"));
    }

    safe_integer_limit(float as u64)
}

fn safe_integer_limit<E>(value: u64) -> Result<u64, E>
where
    E: de::Error,
{
    if value > JS_MAX_SAFE_INTEGER {
        return Err(E::custom("integer exceeds JavaScript safe integer range"));
    }
    Ok(value)
}

fn normalize_config_path(cwd: &Utf8Path, source_path: &str) -> Option<Utf8PathBuf> {
    if source_path.is_empty()
        || source_path.chars().any(|character| character == '\0')
        || !cwd.is_absolute()
    {
        return None;
    }

    let raw_path = Utf8Path::new(source_path);
    let joined = if raw_path.is_absolute() {
        raw_path.to_path_buf()
    } else {
        cwd.join(raw_path)
    };
    Some(lexically_normalize_posix(&joined))
}

fn lexically_normalize_posix(path: &Utf8Path) -> Utf8PathBuf {
    let source = path.as_str();
    let absolute = source.starts_with('/');
    let mut segments: Vec<&str> = Vec::new();

    for segment in source.split('/') {
        match segment {
            "" | "." => {}
            ".." if !segments.is_empty() && segments.last() != Some(&"..") => {
                segments.pop();
            }
            ".." if !absolute => segments.push(segment),
            ".." => {}
            _ => segments.push(segment),
        }
    }

    let mut normalized = if absolute {
        String::from("/")
    } else {
        String::new()
    };
    normalized.push_str(&segments.join("/"));
    if normalized.is_empty() {
        normalized.push('.');
    }
    Utf8PathBuf::from(normalized)
}

fn apply_configured_value<T>(
    values: &mut BTreeMap<String, String>,
    option_token: &str,
    explicit_value: Option<T>,
    user_value: Option<T>,
) where
    T: ToString,
{
    if values.contains_key(option_token) {
        return;
    }
    if let Some(value) = selected_config_value(explicit_value, user_value) {
        values.insert(option_token.to_owned(), value.to_string());
    }
}

fn selected_secrets(
    explicit_config: &JsonConfig,
    user_config: &JsonConfig,
    env: &EnvMap,
) -> Vec<String> {
    selected_string_config_or_env(
        explicit_config.confluence_token.as_deref(),
        user_config.confluence_token.as_deref(),
        env,
        "CONFLUEX_CONFLUENCE_TOKEN",
    )
    .filter(|secret| !secret.is_empty())
    .map(|secret| vec![secret.to_owned()])
    .unwrap_or_default()
}

fn selected_string_config_or_env<'a>(
    explicit_value: Option<&'a str>,
    user_value: Option<&'a str>,
    env: &'a EnvMap,
    env_key: &str,
) -> Option<&'a str> {
    explicit_value.or(user_value).or_else(|| env.get(env_key))
}

fn selected_config_value<T>(explicit_value: Option<T>, user_value: Option<T>) -> Option<T> {
    explicit_value.or(user_value)
}

fn non_empty(value: Option<&str>) -> Option<&str> {
    value.filter(|text| !text.is_empty())
}

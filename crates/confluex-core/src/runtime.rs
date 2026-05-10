//! Accepted-run boundary, lifecycle lines, diagnostics, and exit outcome.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

use crate::config::EnvMap;

pub const DEPENDENCY_PROBE_TIMEOUT: Duration = Duration::from_millis(5000);
pub const DEPENDENCY_PROBE_MAX_BUFFER_BYTES: usize = 64 * 1024;
pub const CHILD_ENV_ALLOWLIST: [&str; 10] = [
    "PATH",
    "Path",
    "PATHEXT",
    "HOME",
    "USERPROFILE",
    "TMPDIR",
    "TEMP",
    "TMP",
    "SystemRoot",
    "WINDIR",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitCode {
    Success,
    Usage,
    RuntimeFailure,
    Interrupted,
}

impl ExitCode {
    pub fn code(self) -> i32 {
        match self {
            Self::Success => 0,
            Self::Usage => 64,
            Self::RuntimeFailure => 1,
            Self::Interrupted => 130,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliOutcome {
    pub exit: ExitCode,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InvocationDecision<T> {
    Accepted(T),
    Rejected(CliOutcome),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DependencyState {
    pub label: String,
    pub state: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DependencyProbePolicy {
    pub timeout: Duration,
    pub max_buffer_bytes: usize,
}

pub async fn executable_dependency_probe(
    label: &str,
    executable: &str,
    env: &EnvMap,
) -> DependencyState {
    let child_env = allowed_child_process_env(env);
    let Some(resolved) = resolve_executable(executable, &child_env) else {
        return DependencyState {
            label: label.to_owned(),
            state: "absent".to_owned(),
        };
    };

    let mut command = Command::new(resolved);
    command
        .arg("--version")
        .env_clear()
        .envs(child_env.0.iter())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);

    let version = match timeout(DEPENDENCY_PROBE_TIMEOUT, command.output()).await {
        Ok(Ok(output)) if output.status.success() => parse_version_probe(&output.stdout),
        _ => None,
    };

    DependencyState {
        label: label.to_owned(),
        state: version
            .map(|version| format!("present:{version}"))
            .unwrap_or_else(|| "present:unknown_version".to_owned()),
    }
}

pub fn dependency_probe_policy() -> DependencyProbePolicy {
    DependencyProbePolicy {
        timeout: DEPENDENCY_PROBE_TIMEOUT,
        max_buffer_bytes: DEPENDENCY_PROBE_MAX_BUFFER_BYTES,
    }
}

pub fn allowed_child_process_env(parent: &EnvMap) -> EnvMap {
    let values = CHILD_ENV_ALLOWLIST
        .into_iter()
        .filter_map(|key| {
            parent
                .get(key)
                .map(|value| (key.to_owned(), value.to_owned()))
        })
        .collect::<BTreeMap<_, _>>();
    EnvMap(values)
}

pub fn runtime_prerequisite_failure(name: &str, details: Option<&str>) -> String {
    match details.filter(|details| !details.is_empty()) {
        Some(details) => format!("ERROR: runtime_prerequisite_failed {name} {details}\n"),
        None => format!("ERROR: runtime_prerequisite_failed {name}\n"),
    }
}

fn resolve_executable(executable: &str, env: &EnvMap) -> Option<PathBuf> {
    let path_value = env.get("PATH").or_else(|| env.get("Path")).unwrap_or("");
    let executable_names = executable_candidates(executable, env);
    for directory in std::env::split_paths(path_value) {
        if directory.as_os_str().is_empty() {
            continue;
        }

        for executable_name in &executable_names {
            let candidate = directory.join(executable_name);
            if is_executable_file(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

fn executable_candidates(executable: &str, env: &EnvMap) -> Vec<String> {
    if !cfg!(windows) || Path::new(executable).extension().is_some() {
        return vec![executable.to_owned()];
    }

    let path_ext = env.get("PATHEXT").unwrap_or(".COM;.EXE;.BAT;.CMD");
    let extensions = path_ext
        .split(';')
        .map(str::trim)
        .filter(|extension| !extension.is_empty())
        .collect::<Vec<_>>();
    let mut candidates = Vec::with_capacity(1 + extensions.len() * 2);
    candidates.push(executable.to_owned());
    candidates.extend(
        extensions
            .iter()
            .map(|extension| format!("{executable}{}", extension.to_lowercase())),
    );
    candidates.extend(
        extensions
            .iter()
            .map(|extension| format!("{executable}{}", extension.to_uppercase())),
    );
    candidates
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        metadata.permissions().mode() & 0o111 != 0
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn parse_version_probe(stdout: &[u8]) -> Option<String> {
    if stdout.len() > DEPENDENCY_PROBE_MAX_BUFFER_BYTES {
        return None;
    }

    let text = String::from_utf8_lossy(stdout);
    for line in text.split('\n') {
        let trimmed = trim_ascii_whitespace(line);
        if trimmed.is_empty() {
            continue;
        }
        if trimmed == "unknown_version" || has_ascii_control(trimmed) {
            return None;
        }
        return Some(trimmed.to_owned());
    }
    None
}

fn trim_ascii_whitespace(value: &str) -> &str {
    value.trim_matches(|character| matches!(character, ' ' | '\t' | '\n' | '\r'))
}

fn has_ascii_control(value: &str) -> bool {
    value
        .chars()
        .any(|character| matches!(character as u32, 0x00..=0x1f | 0x7f))
}

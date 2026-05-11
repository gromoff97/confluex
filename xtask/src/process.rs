use std::process::{Command, Stdio};

use camino::Utf8Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProcessError {
    #[error("failed to start command `{command}`: {source}")]
    Start {
        command: String,
        #[source]
        source: std::io::Error,
    },
    #[error(
        "command `{command}` failed with status {status}\nstdout:\n{stdout}\nstderr:\n{stderr}"
    )]
    Status {
        command: String,
        status: i32,
        stdout: String,
        stderr: String,
    },
}

pub fn run(cwd: &Utf8Path, program: &str, args: &[&str]) -> Result<String, ProcessError> {
    let command_label = command_label(program, args);
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .output()
        .map_err(|source| ProcessError::Start {
            command: command_label.clone(),
            source,
        })?;
    if !output.status.success() {
        return Err(ProcessError::Status {
            command: command_label,
            status: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn succeeds(cwd: &Utf8Path, program: &str, args: &[&str]) -> Result<bool, ProcessError> {
    let output = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .output()
        .map_err(|source| ProcessError::Start {
            command: command_label(program, args),
            source,
        })?;
    Ok(output.status.success())
}

fn command_label(program: &str, args: &[&str]) -> String {
    std::iter::once(program)
        .chain(args.iter().copied())
        .collect::<Vec<_>>()
        .join(" ")
}

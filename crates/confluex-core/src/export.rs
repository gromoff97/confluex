//! Rust export orchestration entry point.

use crate::cli::ExportRequest;
use crate::runtime::{CliOutcome, ExitCode};

pub async fn run_export(_request: ExportRequest) -> CliOutcome {
    CliOutcome {
        exit: ExitCode::RuntimeFailure,
        stdout: String::new(),
        stderr: "ERROR: rust export orchestration is not complete\n".to_owned(),
    }
}

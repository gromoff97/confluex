//! Accepted-run boundary, lifecycle lines, diagnostics, and exit outcome.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitCode {
    Success,
    Usage,
    ConfiguredStop,
    RuntimeFailure,
    Interrupted,
}

impl ExitCode {
    pub fn code(self) -> i32 {
        match self {
            Self::Success => 0,
            Self::Usage => 64,
            Self::ConfiguredStop => 3,
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

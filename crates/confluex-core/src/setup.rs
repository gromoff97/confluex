//! Rust setup workflow: prompts, dependency readiness, connection validation, and config persistence.

use std::io::{self, Write};

use crate::config::{write_user_config, EnvMap, SetupUserConfig};
use crate::confluence::{
    check_current_user_access, CurrentUserAccessResult, RemoteOperationFailureReason,
    TransportPolicy,
};
use crate::runtime::{
    check_node_version, executable_dependency_probe, CliOutcome, DependencyState, ExitCode,
    NodeVersionCheck,
};

pub async fn run_setup() -> CliOutcome {
    match run_setup_inner().await {
        Ok(outcome) => outcome,
        Err(reason) => setup_failure(reason),
    }
}

async fn run_setup_inner() -> Result<CliOutcome, SetupFailureReason> {
    let mut stdout = io::stdout();
    stdout
        .write_all(b"Confluence base URL: ")
        .map_err(|_| SetupFailureReason::RuntimeFailure)?;
    stdout
        .flush()
        .map_err(|_| SetupFailureReason::RuntimeFailure)?;

    let mut base_url = String::new();
    io::stdin()
        .read_line(&mut base_url)
        .map_err(|_| SetupFailureReason::RuntimeFailure)?;
    let base_url = trim_line_ending(base_url);
    let token = rpassword::prompt_password("Confluence token: ")
        .map_err(|_| SetupFailureReason::HiddenInputUnavailable)?;

    let env = EnvMap::from_current_process();
    validate_setup_dependencies(&env).await?;
    let mut connection_env = env.clone();
    connection_env
        .0
        .insert("CONFLUEX_CONFLUENCE_BASE_URL".to_owned(), base_url);
    connection_env
        .0
        .insert("CONFLUEX_CONFLUENCE_TOKEN".to_owned(), token.clone());

    let connection =
        check_current_user_access(&connection_env, TransportPolicy { insecure: false }).await;
    let base_url = match connection {
        CurrentUserAccessResult::Ok { base_url } => base_url,
        CurrentUserAccessResult::Failed { reason } => return Err(setup_reason(reason)),
    };

    let config_path = write_user_config(
        &SetupUserConfig {
            confluence_base_url: base_url,
            confluence_token: token,
        },
        &env,
    )
    .await
    .map_err(|_| SetupFailureReason::RuntimeFailure)?;

    Ok(CliOutcome {
        exit: ExitCode::Success,
        stdout: format!("setup_result=passed\nconfig_path={config_path}\n"),
        stderr: String::new(),
    })
}

async fn validate_setup_dependencies(env: &EnvMap) -> Result<(), SetupFailureReason> {
    let node_version =
        std::env::var("CONFLUEX_NODE_VERSION_FOR_SETUP").unwrap_or_else(|_| "20.11.0".to_owned());
    if matches!(
        check_node_version(&node_version),
        NodeVersionCheck::Failed { .. }
    ) {
        return Err(SetupFailureReason::UnsupportedNodeRuntime);
    }

    let DependencyState { state, .. } =
        executable_dependency_probe("markdown_converter", "uvx", env).await;
    if state == "absent" {
        return Err(SetupFailureReason::MissingMarkdownConverter);
    }
    Ok(())
}

fn setup_reason(reason: RemoteOperationFailureReason) -> SetupFailureReason {
    match reason {
        RemoteOperationFailureReason::MissingBaseUrl
        | RemoteOperationFailureReason::InvalidBaseUrl => SetupFailureReason::InvalidBaseUrl,
        RemoteOperationFailureReason::MissingToken => SetupFailureReason::MissingToken,
        RemoteOperationFailureReason::AuthRejected => SetupFailureReason::AuthRejected,
        RemoteOperationFailureReason::PageInaccessible => SetupFailureReason::PageInaccessible,
        RemoteOperationFailureReason::TransportDns => SetupFailureReason::TransportDns,
        RemoteOperationFailureReason::TransportTls => SetupFailureReason::TransportTls,
        RemoteOperationFailureReason::TransportTimeout => SetupFailureReason::TransportTimeout,
        RemoteOperationFailureReason::TransportConnectionReset => {
            SetupFailureReason::TransportConnectionReset
        }
        RemoteOperationFailureReason::TransportProxy => SetupFailureReason::TransportProxy,
    }
}

fn setup_failure(reason: SetupFailureReason) -> CliOutcome {
    match reason {
        SetupFailureReason::RuntimeFailure => CliOutcome {
            exit: ExitCode::RuntimeFailure,
            stdout: String::new(),
            stderr: "ERROR: runtime_failure setup\n".to_owned(),
        },
        reason => CliOutcome {
            exit: ExitCode::RuntimeFailure,
            stdout: String::new(),
            stderr: format!("ERROR: setup_failed {}\n", reason.as_str()),
        },
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SetupFailureReason {
    UnsupportedNodeRuntime,
    MissingMarkdownConverter,
    InvalidBaseUrl,
    MissingToken,
    AuthRejected,
    PageInaccessible,
    TransportDns,
    TransportTls,
    TransportTimeout,
    TransportConnectionReset,
    TransportProxy,
    HiddenInputUnavailable,
    RuntimeFailure,
}

impl SetupFailureReason {
    fn as_str(self) -> &'static str {
        match self {
            Self::UnsupportedNodeRuntime => "unsupported_node_runtime",
            Self::MissingMarkdownConverter => "missing_markdown_converter",
            Self::InvalidBaseUrl => "invalid_base_url",
            Self::MissingToken => "missing_token",
            Self::AuthRejected => "auth_rejected",
            Self::PageInaccessible => "page_inaccessible",
            Self::TransportDns => "transport_dns",
            Self::TransportTls => "transport_tls",
            Self::TransportTimeout => "transport_timeout",
            Self::TransportConnectionReset => "transport_connection_reset",
            Self::TransportProxy => "transport_proxy",
            Self::HiddenInputUnavailable => "hidden_input_unavailable",
            Self::RuntimeFailure => "runtime_failure",
        }
    }
}

fn trim_line_ending(mut value: String) -> String {
    while value.ends_with(['\n', '\r']) {
        value.pop();
    }
    value
}

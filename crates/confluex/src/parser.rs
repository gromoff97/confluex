use camino::Utf8PathBuf;
use confluex::{
    cli::{CommandRequest, ExportRequest, SetupRequest},
    runtime::{CliOutcome, ExitCode},
};

pub fn parse_command_request(args: &[String]) -> Result<CommandRequest, CliOutcome> {
    let Some(command) = args.first() else {
        return Ok(CommandRequest::Help);
    };
    match command.as_str() {
        "setup" => parse_setup(&args[1..]),
        "export" => parse_export(&args[1..]),
        _ => Err(diagnostic(format!(
            "ERROR: unknown_command {}\n",
            diagnostic_token(command)
        ))),
    }
}

fn parse_setup(args: &[String]) -> Result<CommandRequest, CliOutcome> {
    if let Some(token) = args.first() {
        if token.starts_with('-') {
            return Err(diagnostic(format!(
                "ERROR: unsupported_option {}\n",
                diagnostic_token(token)
            )));
        }
        return Err(diagnostic(format!(
            "ERROR: unsupported_positional_operand {}\n",
            diagnostic_token(token)
        )));
    }
    Ok(CommandRequest::Setup(SetupRequest {
        config_path: None,
        insecure: false,
    }))
}

fn parse_export(args: &[String]) -> Result<CommandRequest, CliOutcome> {
    let mut request = ExportRequest {
        page_id: None,
        output_root: None,
        config_path: None,
        include_children: false,
        plan_only: false,
        zip: false,
        resume: false,
        no_fail_fast: false,
        debug: false,
        insecure: false,
        max_pages: None,
        max_download_mib: None,
        sleep_ms: None,
        max_find_candidates: None,
        link_depth: None,
    };

    let mut index = 0;
    while index < args.len() {
        let token = &args[index];
        match token.as_str() {
            "--include-children" => request.include_children = true,
            "--plan-only" => request.plan_only = true,
            "--zip" => request.zip = true,
            "--resume" => request.resume = true,
            "--no-fail-fast" => request.no_fail_fast = true,
            "--debug" => request.debug = true,
            "--insecure" => request.insecure = true,
            "--page-id" => {
                let value = option_value(args, index, token)?;
                request.page_id = Some(value.to_owned());
                index += 1;
            }
            "--out" => {
                let value = option_value(args, index, token)?;
                request.output_root = Some(Utf8PathBuf::from(value));
                index += 1;
            }
            "--config" => {
                let value = option_value(args, index, token)?;
                request.config_path = Some(Utf8PathBuf::from(value));
                index += 1;
            }
            "--max-pages" => {
                request.max_pages =
                    Some(parse_u64_option(option_value(args, index, token)?, token)?);
                index += 1;
            }
            "--max-download-mib" => {
                request.max_download_mib =
                    Some(parse_u64_option(option_value(args, index, token)?, token)?);
                index += 1;
            }
            "--sleep-ms" => {
                request.sleep_ms =
                    Some(parse_u64_option(option_value(args, index, token)?, token)?);
                index += 1;
            }
            "--max-find-candidates" => {
                request.max_find_candidates =
                    Some(parse_u64_option(option_value(args, index, token)?, token)?);
                index += 1;
            }
            "--link-depth" => {
                request.link_depth =
                    Some(parse_u64_option(option_value(args, index, token)?, token)?);
                index += 1;
            }
            _ if token.starts_with('-') => {
                return Err(diagnostic(format!(
                    "ERROR: unsupported_option {}\n",
                    diagnostic_token(token)
                )));
            }
            _ => {
                return Err(diagnostic(format!(
                    "ERROR: unsupported_positional_operand {}\n",
                    diagnostic_token(token)
                )));
            }
        }
        index += 1;
    }

    Ok(CommandRequest::Export(request))
}

fn option_value<'a>(
    args: &'a [String],
    index: usize,
    option_token: &str,
) -> Result<&'a str, CliOutcome> {
    let Some(value) = args.get(index + 1) else {
        return Err(diagnostic(format!(
            "ERROR: missing_option_value {}\n",
            diagnostic_token(option_token)
        )));
    };
    if value.starts_with('-') {
        return Err(diagnostic(format!(
            "ERROR: missing_option_value {}\n",
            diagnostic_token(option_token)
        )));
    }
    Ok(value)
}

fn parse_u64_option(value: &str, option_token: &str) -> Result<u64, CliOutcome> {
    value.parse::<u64>().map_err(|_| {
        diagnostic(format!(
            "ERROR: invalid_option_value {}\n",
            diagnostic_token(option_token)
        ))
    })
}

fn diagnostic(stderr: String) -> CliOutcome {
    CliOutcome {
        exit: ExitCode::RuntimeFailure,
        stdout: String::new(),
        stderr,
    }
}

fn diagnostic_token(value: &str) -> String {
    let mut token = String::new();
    for byte in value.as_bytes() {
        match byte {
            0x21..=0x24 | 0x26..=0x7e => token.push(char::from(*byte)),
            _ => token.push_str(&format!("%{byte:02X}")),
        }
    }
    token
}

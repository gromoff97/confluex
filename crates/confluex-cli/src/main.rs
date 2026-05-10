mod parser;

use confluex_core::{
    cli::CommandRequest,
    export::run_export,
    runtime::{CliOutcome, ExitCode},
    setup::run_setup,
};
use parser::parse_command_request;

#[tokio::main]
async fn main() {
    let raw_args = std::env::args().skip(1).collect::<Vec<_>>();
    if let Some(outcome) = help_outcome(&raw_args) {
        finish(outcome);
    }

    let request = match parse_command_request(&raw_args) {
        Ok(request) => request,
        Err(outcome) => finish(outcome),
    };
    let outcome = match request {
        CommandRequest::Help => CliOutcome {
            exit: ExitCode::Success,
            stdout: TOP_LEVEL_HELP.to_owned(),
            stderr: String::new(),
        },
        CommandRequest::Setup(_) => run_setup().await,
        CommandRequest::Export(request) => run_export(request).await,
    };

    finish(outcome);
}

fn finish(outcome: CliOutcome) -> ! {
    print!("{}", outcome.stdout);
    eprint!("{}", outcome.stderr);
    std::process::exit(outcome.exit.code());
}

fn help_outcome(args: &[String]) -> Option<CliOutcome> {
    let stdout = if args.is_empty() || (args.len() == 1 && args[0] == "--help") {
        TOP_LEVEL_HELP
    } else if args.len() == 2 && args[0] == "setup" && args[1] == "--help" {
        SETUP_HELP
    } else if args.len() == 2 && args[0] == "export" && args[1] == "--help" {
        EXPORT_HELP
    } else {
        return None;
    };
    Some(CliOutcome {
        exit: ExitCode::Success,
        stdout: stdout.to_owned(),
        stderr: String::new(),
    })
}

const TOP_LEVEL_HELP: &str = "\
Usage
  confluex <command> [options]
Commands
  setup  interactive user configuration workflow
  export  Confluence export workflow
";

const SETUP_HELP: &str = "\
Usage
  confluex setup
Purpose
  interactive user configuration workflow
Required options
  none
Optional options
  none
Examples
  confluex setup
";

const EXPORT_HELP: &str = "\
Usage
  confluex export --page-id <id> [options]
Purpose
  Confluence export workflow
Required options
  --page-id <id>  Select the target root page.
Optional options
  --out <path>  Select the output root.
  --plan-only  Inspect export scope and reports without materializing page payloads.
  --debug  Write sanitized diagnostic artifacts inside the output root.
  --resume  Resume from an existing output root.
  --no-fail-fast  Continue after recoverable page-level failures.
  --zip  Create a ZIP archive beside the Markdown output root.
  --include-children  Include recursive child-page traversal.
  --config <file>  Load explicit JSON configuration.
  --insecure  Allow HTTP transport or disabled TLS verification for this invocation.
  --max-pages <n>  Stop after at most this many pages.
  --max-download-mib <n>  Stop after at most this many downloaded MiB.
  --sleep-ms <n>  Wait between remote requests.
  --max-find-candidates <n>  Bound title-link candidate resolution.
  --link-depth <n>  Bound linked-page traversal depth.
Examples
  confluex export --page-id <id>
  confluex export --page-id <id> --plan-only
Notes
  --plan-only cannot be combined with --zip or --resume.
  --resume requires --out <path>.
";

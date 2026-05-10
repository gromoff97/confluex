mod clap_app;

use clap::Parser;
use clap_app::{into_request, Cli};
use confluex_core::{
    cli::CommandRequest,
    export::run_export,
    runtime::{CliOutcome, ExitCode},
    setup::run_setup,
};

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    let request = into_request(cli);
    let outcome = match request {
        CommandRequest::Help => CliOutcome {
            exit: ExitCode::Usage,
            stdout: String::new(),
            stderr: "ERROR: rust help rendering is not wired yet\n".to_owned(),
        },
        CommandRequest::Setup(_) => run_setup().await,
        CommandRequest::Export(request) => run_export(request).await,
    };

    print!("{}", outcome.stdout);
    eprint!("{}", outcome.stderr);
    std::process::exit(outcome.exit.code());
}

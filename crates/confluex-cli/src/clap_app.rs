use camino::Utf8PathBuf;
use clap::{Args, Parser, Subcommand};
use confluex_core::cli::{CommandRequest, ExportRequest, SetupRequest};

#[derive(Debug, Parser)]
#[command(name = "confluex")]
#[command(about = "Token-authenticated Confluence export CLI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    Setup(SetupArgs),
    Export(ExportArgs),
}

#[derive(Debug, Args)]
pub struct SetupArgs {
    #[arg(long)]
    pub config: Option<Utf8PathBuf>,
    #[arg(long)]
    pub insecure: bool,
}

#[derive(Debug, Args)]
pub struct ExportArgs {
    #[arg(long)]
    pub page_id: Option<String>,
    #[arg(long)]
    pub out: Option<Utf8PathBuf>,
    #[arg(long)]
    pub config: Option<Utf8PathBuf>,
    #[arg(long)]
    pub include_children: bool,
    #[arg(long)]
    pub plan_only: bool,
    #[arg(long)]
    pub zip: bool,
    #[arg(long)]
    pub resume: bool,
    #[arg(long)]
    pub no_fail_fast: bool,
    #[arg(long)]
    pub debug: bool,
    #[arg(long)]
    pub insecure: bool,
    #[arg(long)]
    pub max_pages: Option<u64>,
    #[arg(long)]
    pub max_download_mib: Option<u64>,
    #[arg(long)]
    pub sleep_ms: Option<u64>,
    #[arg(long)]
    pub max_find_candidates: Option<u64>,
    #[arg(long)]
    pub link_depth: Option<u64>,
}

pub fn into_request(cli: Cli) -> CommandRequest {
    match cli.command {
        None => CommandRequest::Help,
        Some(Commands::Setup(args)) => CommandRequest::Setup(SetupRequest {
            config_path: args.config,
            insecure: args.insecure,
        }),
        Some(Commands::Export(args)) => CommandRequest::Export(ExportRequest {
            page_id: args.page_id,
            output_root: args.out,
            config_path: args.config,
            include_children: args.include_children,
            plan_only: args.plan_only,
            zip: args.zip,
            resume: args.resume,
            no_fail_fast: args.no_fail_fast,
            debug: args.debug,
            insecure: args.insecure,
            max_pages: args.max_pages,
            max_download_mib: args.max_download_mib,
            sleep_ms: args.sleep_ms,
            max_find_candidates: args.max_find_candidates,
            link_depth: args.link_depth,
        }),
    }
}

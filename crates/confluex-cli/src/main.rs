mod clap_app;

use clap::Parser;
use clap_app::{into_request, Cli};

fn main() {
    let cli = Cli::parse();
    let request = into_request(cli);
    eprintln!("rust request parsed: {request:?}");
    std::process::exit(64);
}

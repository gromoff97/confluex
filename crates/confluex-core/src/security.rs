//! Path safety, redaction, attachment quarantine, and formula neutralization.

pub fn redact_known_secrets(input: &str, secrets: &[String]) -> String {
    secrets
        .iter()
        .filter(|secret| !secret.is_empty())
        .fold(input.to_owned(), |text, secret| {
            text.replace(secret, "[redacted]")
        })
}

//! Report row types, TSV codec, and summary arithmetic.

pub fn tsv_data_field(value: Option<&str>) -> String {
    match value {
        None => "-".to_owned(),
        Some(text) => {
            let cleaned = text
                .chars()
                .map(|c| {
                    if c == '\t' || c == '\n' || c == '\r' || c.is_control() {
                        ' '
                    } else {
                        c
                    }
                })
                .collect::<String>();
            if cleaned == "-" || cleaned.starts_with('\\') {
                format!("\\{cleaned}")
            } else {
                cleaned
            }
        }
    }
}

pub fn tsv_formula_safe_field(value: Option<&str>) -> String {
    let field = tsv_data_field(value);
    if matches!(field.chars().next(), Some('=') | Some('+') | Some('-') | Some('@')) {
        format!("'{field}")
    } else {
        field
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiscoverySource {
    Root,
    Tree,
    Linked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FindingType {
    IncompleteTree,
    PartialListing,
    StorageUnavailable,
    StorageUninterpretable,
    CandidateVisibilityIncomplete,
    UnsupportedInternalPattern,
    MarkdownRemnant,
}

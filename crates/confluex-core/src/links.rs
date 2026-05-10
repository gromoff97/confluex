//! URL and Confluence target parsing.

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum LinkTarget {
    PageId(String),
    Title {
        space_key: Option<String>,
        title: String,
    },
    Raw(String),
}

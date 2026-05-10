//! Page identity, traversal ledger, and link-depth bookkeeping.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PageSource {
    Root,
    Tree,
    Linked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopeEntry {
    pub ordinal: u64,
    pub page_id: String,
    pub source: PageSource,
    pub depth: u32,
}

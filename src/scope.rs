//! Page identity, traversal ledger, and link-depth bookkeeping.

use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageSource {
    Root,
    Tree,
    Linked,
}

impl PageSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Root => "root",
            Self::Tree => "tree",
            Self::Linked => "linked",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopeEntry {
    pub ordinal: u64,
    pub page_id: String,
    pub source: PageSource,
    pub depth: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopeStopReason {
    None,
    MaxPagesLimitReached,
    MaxDownloadLimitReached,
}

impl ScopeStopReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::MaxPagesLimitReached => "max_pages_limit_reached",
            Self::MaxDownloadLimitReached => "max_download_limit_reached",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewScopeEntry {
    pub page_id: String,
    pub source: PageSource,
    pub depth: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScopeLedger {
    ordered_entries: Vec<ScopeEntry>,
    entries_by_page_id: BTreeMap<String, ScopeEntry>,
    stop_reason: Option<ScopeStopReason>,
}

impl ScopeLedger {
    pub fn add(&mut self, entry: NewScopeEntry) -> Result<ScopeEntry, ScopeError> {
        validate_entry(&entry)?;
        if let Some(existing) = self.entries_by_page_id.get(&entry.page_id) {
            return Ok(existing.clone());
        }

        let next = ScopeEntry {
            ordinal: self.ordered_entries.len() as u64,
            page_id: entry.page_id,
            source: entry.source,
            depth: entry.depth,
        };
        self.ordered_entries.push(next.clone());
        self.entries_by_page_id
            .insert(next.page_id.clone(), next.clone());
        Ok(next)
    }

    pub fn entries(&self) -> Vec<ScopeEntry> {
        self.ordered_entries.clone()
    }

    pub fn stop(&mut self, reason: ScopeStopReason) -> Result<(), ScopeError> {
        if reason == ScopeStopReason::None {
            return Err(ScopeError::InvalidStopReason);
        }
        if self.stop_reason.is_none() {
            self.stop_reason = Some(reason);
        }
        Ok(())
    }

    pub fn stop_reason(&self) -> ScopeStopReason {
        self.stop_reason.unwrap_or(ScopeStopReason::None)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ScopeError {
    InvalidPageId,
    InvalidStopReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StorageTraceResult {
    Ok { storage: String, bytes: u64 },
    Failed { bytes: u64 },
}

pub fn storage_trace_result(storage: Option<String>, bytes: Option<u64>) -> StorageTraceResult {
    let bytes = bytes.unwrap_or(0);
    match storage {
        Some(storage) => StorageTraceResult::Ok { storage, bytes },
        None => StorageTraceResult::Failed { bytes },
    }
}

fn validate_entry(entry: &NewScopeEntry) -> Result<(), ScopeError> {
    if !is_canonical_non_negative_integer(&entry.page_id) {
        return Err(ScopeError::InvalidPageId);
    }
    Ok(())
}

fn is_canonical_non_negative_integer(value: &str) -> bool {
    value == "0"
        || value
            .chars()
            .next()
            .is_some_and(|first| first.is_ascii_digit() && first != '0')
            && value.chars().all(|character| character.is_ascii_digit())
}

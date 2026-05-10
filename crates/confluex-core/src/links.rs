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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TargetReference {
    PageId(String),
    Title {
        title: String,
        space_key: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelativeUrlParts {
    pub path_part: String,
    pub query_part: String,
    pub fragment: String,
}

pub fn parse_canonical_page_id(value: &str) -> Option<&str> {
    is_canonical_non_negative_integer(value).then_some(value)
}

pub fn parse_confluence_relative_url(value: &str) -> Option<RelativeUrlParts> {
    if is_absolute_or_scheme_relative_url(value) {
        return None;
    }

    let (without_fragment, fragment) = match value.split_once('#') {
        Some((before, after)) => (before, after),
        None => (value, ""),
    };
    let (path_part, query_part) = match without_fragment.split_once('?') {
        Some((path, query)) => (path, query),
        None => (without_fragment, ""),
    };

    Some(RelativeUrlParts {
        path_part: path_part.to_owned(),
        query_part: query_part.to_owned(),
        fragment: fragment.to_owned(),
    })
}

pub fn target_reference_from_relative_url(value: &str) -> Option<TargetReference> {
    let parts = parse_confluence_relative_url(value)?;

    if let Some(page_id) =
        page_id_from_query(&parts.query_part).or_else(|| page_id_from_path(&parts.path_part))
    {
        return Some(TargetReference::PageId(page_id));
    }

    title_from_display_path(&parts.path_part).or_else(|| title_from_query(&parts.query_part))
}

pub fn report_raw_link_value(target: &TargetReference) -> String {
    match target {
        TargetReference::PageId(page_id) => {
            format!("page_id:{}", crate::reports::normalize_tsv_field(page_id))
        }
        TargetReference::Title { title, space_key } => crate::reports::structured_raw_link_value(
            crate::reports::StructuredRawLinkKind::Title,
            &[
                if space_key.is_some() { "1" } else { "0" }.to_owned(),
                space_key.clone().unwrap_or_default(),
                title.clone(),
            ],
        )
        .expect("title structured raw link value is valid"),
    }
}

pub fn is_absolute_or_scheme_relative_url(value: &str) -> bool {
    value.starts_with("//") || has_scheme_prefix(value)
}

fn page_id_from_query(query: &str) -> Option<String> {
    for part in query.split('&') {
        let (name, raw_value) = part.split_once('=').unwrap_or((part, ""));
        if name == "pageId" && is_canonical_non_negative_integer(raw_value) {
            return Some(raw_value.to_owned());
        }
    }
    None
}

fn page_id_from_path(path_part: &str) -> Option<String> {
    let segments = path_part
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    for window in segments.windows(2) {
        if window[0] == "pages" && is_canonical_non_negative_integer(window[1]) {
            return Some(window[1].to_owned());
        }
    }
    None
}

fn title_from_display_path(path_part: &str) -> Option<TargetReference> {
    let segments = path_part
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    for (index, segment) in segments.iter().enumerate() {
        if *segment != "display" || index + 2 != segments.len() - 1 {
            continue;
        }

        let space_key = decode_url_component(segments[index + 1], false)?
            .trim()
            .to_owned();
        let title = decode_url_component(segments[index + 2], true)?
            .trim()
            .to_owned();
        if space_key.is_empty() || title.is_empty() {
            return None;
        }
        return Some(TargetReference::Title {
            title,
            space_key: Some(space_key),
        });
    }
    None
}

fn title_from_query(query: &str) -> Option<TargetReference> {
    let title_value = first_query_value(query, "title")?;
    let title = decode_url_component(&title_value, true)?.trim().to_owned();
    let space_key_value = first_query_value(query, "spaceKey");
    let space_key = match space_key_value {
        Some(value) => {
            let decoded = decode_url_component(&value, false)?.trim().to_owned();
            if decoded.is_empty() {
                return None;
            }
            Some(decoded)
        }
        None => None,
    };

    if title.is_empty() {
        return None;
    }

    Some(TargetReference::Title { title, space_key })
}

fn first_query_value(query: &str, name: &str) -> Option<String> {
    for part in query.split('&') {
        let (part_name, raw_value) = part.split_once('=').unwrap_or((part, ""));
        if part_name == name {
            return Some(raw_value.to_owned());
        }
    }
    None
}

fn decode_url_component(value: &str, plus_as_space: bool) -> Option<String> {
    let input = if plus_as_space {
        value.replace('+', " ")
    } else {
        value.to_owned()
    };
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let high = *bytes.get(index + 1)?;
            let low = *bytes.get(index + 2)?;
            output.push((hex_value(high)? << 4) | hex_value(low)?);
            index += 3;
            continue;
        }
        output.push(bytes[index]);
        index += 1;
    }

    String::from_utf8(output).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn has_scheme_prefix(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() {
        return false;
    }

    for character in chars {
        if character == ':' {
            return true;
        }
        if !(character.is_ascii_alphanumeric() || matches!(character, '+' | '.' | '-')) {
            return false;
        }
    }
    false
}

fn is_canonical_non_negative_integer(value: &str) -> bool {
    value == "0"
        || value
            .strip_prefix(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
            .is_some_and(|rest| rest.chars().all(|character| character.is_ascii_digit()))
}

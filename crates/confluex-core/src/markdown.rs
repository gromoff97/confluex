//! Native Confluence storage to Markdown conversion.

use comrak::{markdown_to_commonmark, Options as ComrakOptions};
use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::reader::Reader;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownExportInput {
    pub storage: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownExportOutput {
    pub markdown: String,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Error)]
pub enum MarkdownExportError {
    #[error("storage XML conversion failed: {0}")]
    Storage(String),
}

#[allow(async_fn_in_trait)]
pub trait MarkdownExporter {
    async fn export(
        &self,
        input: MarkdownExportInput,
    ) -> Result<MarkdownExportOutput, MarkdownExportError>;
}

#[derive(Debug, Clone, Default)]
pub struct NativeMarkdownExporter;

impl MarkdownExporter for NativeMarkdownExporter {
    async fn export(
        &self,
        input: MarkdownExportInput,
    ) -> Result<MarkdownExportOutput, MarkdownExportError> {
        let html = storage_fragment_to_html(&input.storage)?;
        let markdown = normalize_markdown(&h2m::convert_gfm(&html));
        Ok(MarkdownExportOutput {
            markdown,
            diagnostics: Vec::new(),
        })
    }
}

fn storage_fragment_to_html(storage: &str) -> Result<String, MarkdownExportError> {
    let wrapped = format!("<confluex-fragment>{storage}</confluex-fragment>");
    let mut reader = Reader::from_str(&wrapped);
    let mut html = String::new();
    let mut ignored_depth = 0usize;

    loop {
        let decoder = reader.decoder();
        match reader.read_event() {
            Ok(Event::Eof) => break,
            Ok(Event::Start(event)) => {
                let tag = tag_name(&event)?;
                if tag == "confluex-fragment" {
                    continue;
                }
                if ignored_depth > 0 {
                    ignored_depth += 1;
                    continue;
                }
                match tag_policy(&tag) {
                    TagPolicy::Pass => push_start_tag(&mut html, &event, decoder)?,
                    TagPolicy::Break => html.push_str("<br>"),
                    TagPolicy::UnsupportedConfluence => {
                        push_unsupported_marker(&mut html, &event, decoder)?;
                        ignored_depth = 1;
                    }
                    TagPolicy::Unwrap => {}
                    TagPolicy::Ignore => ignored_depth = 1,
                }
            }
            Ok(Event::Empty(event)) => {
                let tag = tag_name(&event)?;
                if tag == "confluex-fragment" || ignored_depth > 0 {
                    continue;
                }
                match tag_policy(&tag) {
                    TagPolicy::Pass => push_empty_tag(&mut html, &event, decoder)?,
                    TagPolicy::Break => html.push_str("<br>"),
                    TagPolicy::UnsupportedConfluence => {
                        push_unsupported_marker(&mut html, &event, decoder)?
                    }
                    TagPolicy::Unwrap => push_confluence_reference(&mut html, &event, decoder)?,
                    TagPolicy::Ignore => {}
                }
            }
            Ok(Event::End(event)) => {
                let tag = std::str::from_utf8(event.name().as_ref())
                    .map_err(|error| MarkdownExportError::Storage(error.to_string()))?
                    .to_owned();
                if tag == "confluex-fragment" {
                    continue;
                }
                if ignored_depth > 0 {
                    ignored_depth -= 1;
                    continue;
                }
                if matches!(tag_policy(&tag), TagPolicy::Pass) {
                    html.push_str("</");
                    html.push_str(&html_tag_name(&tag));
                    html.push('>');
                }
            }
            Ok(Event::Text(event)) if ignored_depth == 0 => {
                push_html_escaped(&mut html, &event.decode().map_err(storage_error)?);
            }
            Ok(Event::CData(event)) if ignored_depth == 0 => {
                push_html_escaped(&mut html, &event.decode().map_err(storage_error)?);
            }
            Ok(Event::GeneralRef(event)) if ignored_depth == 0 => {
                push_xml_general_ref(&mut html, &event.decode().map_err(storage_error)?);
            }
            Ok(_) => {}
            Err(error) => return Err(MarkdownExportError::Storage(error.to_string())),
        }
    }

    Ok(html)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TagPolicy {
    Pass,
    Break,
    UnsupportedConfluence,
    Unwrap,
    Ignore,
}

fn tag_policy(tag: &str) -> TagPolicy {
    match tag {
        "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "ul" | "ol" | "li" | "strong" | "b"
        | "em" | "i" | "code" | "pre" | "blockquote" | "table" | "thead" | "tbody" | "tr"
        | "td" | "th" | "a" | "img" => TagPolicy::Pass,
        "br" | "hr" => TagPolicy::Break,
        "ac:structured-macro" | "ac:macro" | "ac:unknown-macro" => TagPolicy::UnsupportedConfluence,
        "script" | "style" => TagPolicy::Ignore,
        _ => TagPolicy::Unwrap,
    }
}

fn push_start_tag(
    html: &mut String,
    event: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<(), MarkdownExportError> {
    let tag = html_tag_name(&tag_name(event)?);
    html.push('<');
    html.push_str(&tag);
    push_allowed_attributes(html, event, decoder)?;
    html.push('>');
    Ok(())
}

fn push_empty_tag(
    html: &mut String,
    event: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<(), MarkdownExportError> {
    let tag = html_tag_name(&tag_name(event)?);
    html.push('<');
    html.push_str(&tag);
    push_allowed_attributes(html, event, decoder)?;
    html.push_str("/>");
    Ok(())
}

fn push_allowed_attributes(
    html: &mut String,
    event: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<(), MarkdownExportError> {
    for attribute in event.attributes() {
        let attribute = attribute.map_err(storage_error)?;
        let key = std::str::from_utf8(attribute.key.as_ref())
            .map_err(|error| MarkdownExportError::Storage(error.to_string()))?;
        if !matches!(key, "href" | "src" | "alt" | "title") {
            continue;
        }
        let value = attribute
            .decode_and_unescape_value(decoder)
            .map_err(storage_error)?;
        html.push(' ');
        html.push_str(key);
        html.push_str("=\"");
        push_html_attribute_escaped(html, &value);
        html.push('"');
    }
    Ok(())
}

fn push_unsupported_marker(
    html: &mut String,
    event: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<(), MarkdownExportError> {
    let name = attr_value(event, "ac:name", decoder)?
        .unwrap_or_else(|| tag_name(event).unwrap_or_default());
    html.push_str("<p>[unsupported: confluence_macro; name=\"");
    push_html_escaped(html, &name);
    html.push_str("\"]</p>");
    Ok(())
}

fn push_confluence_reference(
    html: &mut String,
    event: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<(), MarkdownExportError> {
    let value = attr_value(event, "ri:content-title", decoder)?
        .or(attr_value(event, "ri:value", decoder)?)
        .or(attr_value(event, "ri:content-id", decoder)?);
    if let Some(value) = value {
        push_html_escaped(html, &value);
    }
    Ok(())
}

fn attr_value(
    event: &BytesStart<'_>,
    target_key: &str,
    decoder: Decoder,
) -> Result<Option<String>, MarkdownExportError> {
    for attribute in event.attributes() {
        let attribute = attribute.map_err(storage_error)?;
        let key = std::str::from_utf8(attribute.key.as_ref())
            .map_err(|error| MarkdownExportError::Storage(error.to_string()))?;
        if key == target_key {
            return Ok(Some(
                attribute
                    .decode_and_unescape_value(decoder)
                    .map_err(storage_error)?
                    .into_owned(),
            ));
        }
    }
    Ok(None)
}

fn tag_name(event: &BytesStart<'_>) -> Result<String, MarkdownExportError> {
    Ok(std::str::from_utf8(event.name().as_ref())
        .map_err(|error| MarkdownExportError::Storage(error.to_string()))?
        .to_owned())
}

fn html_tag_name(tag: &str) -> String {
    match tag {
        "b" => "strong".to_owned(),
        "i" => "em".to_owned(),
        tag => tag.to_owned(),
    }
}

fn normalize_markdown(markdown: &str) -> String {
    let mut normalized = markdown_to_commonmark(markdown, &ComrakOptions::default());
    while normalized.ends_with("\n\n") {
        normalized.pop();
    }
    if !normalized.ends_with('\n') {
        normalized.push('\n');
    }
    normalized
}

fn push_html_escaped(output: &mut String, value: &str) {
    for character in value.chars() {
        match character {
            '&' => output.push_str("&amp;"),
            '<' => output.push_str("&lt;"),
            '>' => output.push_str("&gt;"),
            '"' => output.push_str("&quot;"),
            '\'' => output.push_str("&#39;"),
            character => output.push(character),
        }
    }
}

fn push_html_attribute_escaped(output: &mut String, value: &str) {
    push_html_escaped(output, value);
}

fn push_xml_general_ref(output: &mut String, value: &str) {
    match value {
        "amp" => output.push_str("&amp;"),
        "lt" => output.push_str("&lt;"),
        "gt" => output.push_str("&gt;"),
        "quot" => output.push_str("&quot;"),
        "apos" => output.push_str("&#39;"),
        value => {
            if let Some(character) = numeric_character_reference(value) {
                push_html_escaped(output, &character.to_string());
                return;
            }
            output.push_str("&amp;");
            push_html_escaped(output, value);
            output.push(';');
        }
    }
}

fn numeric_character_reference(value: &str) -> Option<char> {
    let number = value
        .strip_prefix("#x")
        .or_else(|| value.strip_prefix("#X"))
        .and_then(|digits| u32::from_str_radix(digits, 16).ok())
        .or_else(|| {
            value
                .strip_prefix('#')
                .and_then(|digits| digits.parse::<u32>().ok())
        })?;
    char::from_u32(number)
}

fn storage_error(error: impl std::fmt::Display) -> MarkdownExportError {
    MarkdownExportError::Storage(error.to_string())
}

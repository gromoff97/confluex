# CX Root: operational dump

**Purpose:** this page is a synthetic messy overview for Markdown export. It intentionally mixes tree pages, pages outside this tree, cross-space references, external URLs, invalid references, tables, macros, and attachments.

Русский ввод рядом with English text, XML-sensitive text \<tag attr="value"> & escaped quotes, version v01.002.0003, range 0-1-many, percent 99.95%, and stale marker SYNTHETIC-TASK-MARKER-ROOT.

* 1 [Navigation table with uneven cells](#cxroot-navigationtablewithunevencells)
* 2 [Dense bullet list](#cxroot-densebulletlist)
* 3 [Attachment previews](#cxroot-attachmentpreviews)
* 4 [Mixed numeric table](#cxroot-mixednumerictable)

> \[!IMPORTANT]
> Fixture root briefing
>
> Root info block maps the messy subtree to [CX Child](../page__<page-id:child_page>/page.md), [Messy Links Page](../page__<page-id:messy_links_page>/page.md), and cross-space context in [AUX Cross Space](../../space__415558/page__<page-id:cross_space_page>/page.md).

## Navigation table with uneven cells

| Area        | Main page                                        | Out-of-tree reference                                       | Broken or stale note                                                                                          |
| :---------- | :----------------------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Tables      | [Messy Table Page](../page__<page-id:messy_table_page>/page.md)      | [CX Linked](../page__<page-id:linked_page>/page.md)                        | missing root page id [unresolved: page; reason=insufficient_data; target_hint=page_id; value="999999999"] |
| Links       | [Messy Links Page](../page__<page-id:messy_links_page>/page.md)      | [AUX Cross Space](../../space__415558/page__<page-id:cross_space_page>/page.md) | \[\[Missing Root Archive 000]]                                                                                |
| Attachments | [Messy Attachment Page](../page__<page-id:messy_attachment_page>/page.md) | [CX Linked Scope Root](../page__<page-id:linked_scope_root>/page.md)             | literal invalid://root/no-handler outside code                                                                |

> \[!CAUTION]
> Known stale paths
>
> Do not trust missing root page id [unresolved: page; reason=insufficient_data; target_hint=page_id; value="999999999"] or \[\[Missing Root Archive 000]]; both exist to force unresolved-link handling.

> \[!NOTE]
> **Root panel summary**
>
> Panel content points to [Messy Table Page](../page__<page-id:messy_table_page>/page.md), [Messy Attachment Page](../page__<page-id:messy_attachment_page>/page.md), and duplicate title risk Shared Fixture Title [unresolved: page; reason=not_unique; target_hint=title; value="CX:Shared Fixture Title"].

## Dense bullet list

* Tree child: [CX Child](../page__<page-id:child_page>/page.md) with child traversal.
* Deep branch: [Messy Deep Level 1](../page__<page-id:messy_deep_level_1>/page.md) and a sibling [Messy Wide Child A](../page__<page-id:messy_wide_child_a>/page.md).
* Russian page: [Русская страница — черновик](../page__<page-id:messy_russian_page>/page.md).
* Punctuation title: [Messy: punctuation / spaces?](../page__<page-id:messy_punctuation_page>/page.md).
* Relative display URL: [AUX display link](../../space__415558/page__<page-id:cross_space_page>/page.md).
* External ignored URL: [external reference](https://example.invalid/confluence/export/reference).
* Attachment link: [root-note.txt](attachments/root-note.txt).
* Portable image filename: [overview-chart.png](attachments/overview-chart.png).

## Attachment previews

The next images are tiny synthetic files, but they exercise Confluence attachment rendering and Markdown attachment copying.

> \[!TIP]
> Attachment handling hint
>
> Prefer local file links for [root-note.txt](attachments/root-note.txt), keep image embeds intact, and compare the copied payload with [Messy Attachment Page](../page__<page-id:messy_attachment_page>/page.md).

![](attachments/overview-chart.png)

![](attachments/summary-photo.jpg)

## Mixed numeric table

|  ID | Value | Status      | Notes                                                              |
| --: | :---- | :---------- | :----------------------------------------------------------------- |
| 000 | 0     | empty edge  | page has many links but also zero-like numeric values              |
| 001 | 1     | single edge | `inline-code-root()` with \<escaped> content                       |
| 999 | many  | messy       | repeated section name, repeated section name, stale root reference |

> \[!WARNING]
> Root note macro links to [CX Linked Scope Root](../page__<page-id:linked_scope_root>/page.md) and mentions broken-title: Missing Root Archive 000.

```java

// Literal link-like text inside code should not be treated as a real page.
const stale = '/display/CX/DoNotParseFromRootCode';
const xml = '<root attr="escaped in code">value</root>';

```

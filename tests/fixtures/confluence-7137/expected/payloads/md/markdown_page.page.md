# CX Markdown Fixture

This legacy markdown fixture page is now also rich enough to avoid being a thin side page. It keeps its attachment and adds Markdown-sensitive structures.

Attachment: [markdown-note.txt](attachments/markdown-note.txt). Root link: [CX Root](/display/CX/CX+Root). Missing markdown title: [[Missing Markdown Fixture Target]].

| Markdown risk   | Storage source     | Expected review           |
|:----------------|:-------------------|:--------------------------|
| table           | storage table      | readable Markdown table   |
| code            | `inlineMarkdown()` | no accidental indentation |
| whitespace      | normal paragraph   | no trailing whitespace    |

- Bullet with **bold**.
- Bullet with *italic*.
- Bullet with escaped XML \<markdown-fixture\>.

```java

# markdown-like code that should stay code
* not a real list
[not a real link](/display/CX/DoNotParseMarkdownCode)

```

> [!NOTE]
> Panel links to [Messy Links Page](/display/CX/Messy+Links+Page).

## Audit appendix

The appendix is synthetic review clutter: owner admin, reviewer nobody, date 2026-05-04, window 00:00-23:59, priority P0/P1/P2, and markers 0, 1, many. It intentionally repeats labels that real teams copy between pages.

| Audit field   | Value   | Reference                                        | Noise                   |
|:--------------|:--------|:-------------------------------------------------|:------------------------|
| primary       | 0       | [Messy Links Page](/display/CX/Messy+Links+Page) | appendix-zero           |
| secondary     | 1       | [CX Linked](/display/CX/CX+Linked)               | appendix-one            |
| overflow      | many    | [AUX Cross Space](/display/AUX/AUX+Cross+Space)  | appendix-many           |
| stale         | missing | [[Missing Appendix Target]]                      | broken-appendix://value |

Appendix prose includes escaped XML \<appendix attr="value"\>, Cyrillic пример, inline `appendixCheck()`, and code literal `/display/CX/Missing Appendix Literal`.

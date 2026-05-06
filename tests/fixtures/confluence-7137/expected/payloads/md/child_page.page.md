# CX Child: mixed notes

This child is intentionally no longer a structural placeholder. It has text, tables, links, lists, escaped XML \<child attr="1">, and Russian text пример дочерней страницы.

OPERATIONAL DRIFT

## Child checklist

* **Tree parent:** [CX Root](../page__<page-id:root_page>/page.md).
* *Tree child:* [CX Grandchild](../page__<page-id:grandchild_page>/page.md).
* Out-of-tree context: [CX Linked](../page__<page-id:linked_page>/page.md).
* Cross-space context: [AUX Cross Space](../../space__415558/page__<page-id:cross_space_page>/page.md).
* Broken child title: \[\[Missing Child Operational Note]].

| Metric | 0                 | 1                                           | many                                                                                          |
| :----- | :---------------- | :------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| links  | none in this cell | [Messy Table Page](../page__<page-id:messy_table_page>/page.md) | [Messy Links Page](../page__<page-id:messy_links_page>/page.md), [Messy Attachment Page](../page__<page-id:messy_attachment_page>/page.md) |
| values | 000               | 001                                         | 002,003,004                                                                                   |

> \[!CAUTION]
> Broken child references
>
> This branch intentionally includes \[\[Missing Child Operational Note]] and stale appendix targets, so unresolved-link diagnostics must stay visible in Markdown.

> \[!TIP]
> Child traversal hint
>
> Walk this subtree through [CX Grandchild](../page__<page-id:grandchild_page>/page.md), then jump sideways to [Messy Links Page](../page__<page-id:messy_links_page>/page.md) and [Messy Attachment Page](../page__<page-id:messy_attachment_page>/page.md).

## Repeated operational section

Repeated operational section appears twice on purpose. The page includes a relative stale path missing child page id [unresolved: page; reason=insufficient_data; target_hint=page_id; value="111111111"] and an external ignored link [child reference](https://example.invalid/child/reference).

| Duplicate | Duplicate                   | Notes                                        |
| :-------- | :-------------------------- | :------------------------------------------- |
| `child()` | underlined and ~~obsolete~~ | synthetic task marker CHILD-MARKER-001       |
| Русский   | English                     | mixed language cell with & escaped ampersand |

> \[!IMPORTANT]
> Child info macro links sideways to [Messy Wide Child B](../page__<page-id:messy_wide_child_b>/page.md).

## Audit appendix

The appendix is synthetic review clutter: owner admin, reviewer nobody, date 2026-05-04, window 00:00-23:59, priority P0/P1/P2, and markers 0, 1, many. It intentionally repeats labels that real teams copy between pages.

| Audit field | Value   | Reference                                                   | Noise                   |
| :---------- | :------ | :---------------------------------------------------------- | :---------------------- |
| primary     | 0       | [Messy Links Page](../page__<page-id:messy_links_page>/page.md)                 | appendix-zero           |
| secondary   | 1       | [CX Linked](../page__<page-id:linked_page>/page.md)                        | appendix-one            |
| overflow    | many    | [AUX Cross Space](../../space__415558/page__<page-id:cross_space_page>/page.md) | appendix-many           |
| stale       | missing | \[\[Missing Appendix Target]]                               | broken-appendix://value |

Appendix prose includes escaped XML \<appendix attr="value">, Cyrillic пример, inline `appendixCheck()`, and code literal `/display/CX/Missing Appendix Literal`.

* [ ] Confirm child branch unresolved markers still surface in Markdown
* [x] Verify CX Grandchild stays inside the exported tree

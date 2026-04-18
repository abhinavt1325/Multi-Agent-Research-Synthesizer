from __future__ import annotations

import re
import textwrap
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Mapping, Sequence
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


REQUIRED_PAPER_FIELDS = (
    "title",
    "abstract",
    "authors",
    "year",
    "citation_count",
    "source",
    "paper_id",
)


def _normalize_paper_records(papers: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    normalized_records: list[dict[str, Any]] = []

    for index, paper in enumerate(papers, start=1):
        missing = [field for field in REQUIRED_PAPER_FIELDS if field not in paper]
        if missing:
            raise ValueError(f"Paper {index} is missing required fields: {', '.join(missing)}.")

        title = str(paper["title"]).strip()
        paper_id = str(paper["paper_id"]).strip()
        source = str(paper["source"]).strip()
        if not title or not paper_id or not source:
            raise ValueError(f"Paper {index} contains empty required values.")

        authors_value = paper["authors"]
        if not isinstance(authors_value, Sequence) or isinstance(authors_value, (str, bytes)):
            raise ValueError(f"Paper {index} authors must be a list of names.")

        authors = [str(author).strip() for author in authors_value if str(author).strip()]
        year = paper["year"]
        if year is not None:
            year = int(year)

        normalized_records.append(
            {
                "title": title,
                "abstract": str(paper["abstract"] or "").strip(),
                "authors": authors,
                "year": year,
                "citation_count": int(paper["citation_count"]),
                "source": source,
                "paper_id": paper_id,
            }
        )

    return normalized_records


def build_clipboard_text(topic: str, papers: Sequence[Mapping[str, Any]]) -> str:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    normalized_papers = _normalize_paper_records(papers)
    lines = [
        "Literature Hunter Results",
        f"Topic: {normalized_topic}",
        f"Retrieved papers: {len(normalized_papers)}",
        "",
    ]

    if not normalized_papers:
        lines.append("No papers were retrieved for this topic.")
        return "\n".join(lines)

    for index, paper in enumerate(normalized_papers, start=1):
        authors = ", ".join(paper["authors"]) if paper["authors"] else "Unknown authors"
        year = paper["year"] if paper["year"] is not None else "Unknown year"
        abstract = paper["abstract"] or "Abstract not available."

        lines.extend(
            [
                f"{index}. {paper['title']} ({year})",
                f"Authors: {authors}",
                f"Citations: {paper['citation_count']}",
                f"Source: {paper['source']}",
                f"Paper ID: {paper['paper_id']}",
                f"Abstract: {abstract}",
                "",
            ]
        )

    return "\n".join(lines).strip()


def build_export_filename(topic: str, extension: str) -> str:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    slug = re.sub(r"[^a-z0-9]+", "-", normalized_topic.lower()).strip("-")[:64] or "research-topic"
    generated_at = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"literature-hunter-{slug}-{generated_at}.{extension}"


def build_named_export_filename(prefix: str, topic: str, extension: str) -> str:
    normalized_prefix = prefix.strip().lower()
    if not normalized_prefix:
        raise ValueError("prefix must not be empty.")

    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    slug = re.sub(r"[^a-z0-9]+", "-", normalized_topic.lower()).strip("-")[:64] or "research-topic"
    generated_at = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"{normalized_prefix}-{slug}-{generated_at}.{extension}"


def _wrap_line(value: str, width: int = 92) -> list[str]:
    stripped = value.strip()
    if not stripped:
        return [""]

    return textwrap.wrap(
        stripped,
        width=width,
        break_long_words=False,
        break_on_hyphens=False,
    ) or [stripped]


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf_lines(topic: str, papers: Sequence[Mapping[str, Any]]) -> list[str]:
    normalized_papers = _normalize_paper_records(papers)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        "Literature Hunter Research Summary",
        f"Topic: {topic.strip()}",
        f"Generated: {generated_at}",
        f"Retrieved papers: {len(normalized_papers)}",
        "",
    ]

    if not normalized_papers:
        lines.append("No papers were retrieved for this topic.")
        return lines

    for index, paper in enumerate(normalized_papers, start=1):
        authors = ", ".join(paper["authors"]) if paper["authors"] else "Unknown authors"
        year = paper["year"] if paper["year"] is not None else "Unknown year"
        metadata_line = (
            f"Authors: {authors} | Year: {year} | Citations: {paper['citation_count']} | "
            f"Source: {paper['source']} | Paper ID: {paper['paper_id']}"
        )
        abstract_line = f"Abstract: {paper['abstract'] or 'Abstract not available.'}"

        lines.extend(_wrap_line(f"{index}. {paper['title']}"))
        lines.extend(_wrap_line(metadata_line))
        lines.extend(_wrap_line(abstract_line))
        lines.append("")

    return lines


def generate_research_summary_pdf(topic: str, papers: Sequence[Mapping[str, Any]]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    lines = _build_pdf_lines(normalized_topic, papers)
    lines_per_page = 46
    pages = [lines[index : index + lines_per_page] for index in range(0, len(lines), lines_per_page)] or [[]]

    objects: dict[int, bytes] = {}
    page_object_ids: list[int] = []
    font_object_id = 3

    for page_index, page_lines in enumerate(pages):
        page_object_id = 4 + (page_index * 2)
        content_object_id = page_object_id + 1
        page_object_ids.append(page_object_id)

        commands = ["BT", "/F1 11 Tf", "14 TL", "50 770 Td"]
        for line in page_lines:
            commands.append(f"({_escape_pdf_text(line)}) Tj")
            commands.append("T*")
        commands.append("ET")

        stream = "\n".join(commands).encode("latin-1", errors="replace")
        objects[content_object_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        objects[page_object_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
            f"/Contents {content_object_id} 0 R >>"
        ).encode("latin-1")

    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    page_refs = " ".join(f"{page_id} 0 R" for page_id in page_object_ids)
    objects[2] = f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{page_refs}] >>".encode("latin-1")
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for object_id in range(1, max(objects) + 1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        pdf.extend(objects[object_id])
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )

    return bytes(pdf)


def _docx_paragraph(text: str, style: str | None = None) -> str:
    style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return (
        "<w:p>"
        f"{style_xml}"
        "<w:r><w:t xml:space=\"preserve\">"
        f"{escape(text or '')}"
        "</w:t></w:r>"
        "</w:p>"
    )


def generate_paper_list_docx(topic: str, papers: Sequence[Mapping[str, Any]]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    normalized_papers = _normalize_paper_records(papers)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    paragraphs = [
        _docx_paragraph("Literature Hunter Paper List", "Heading1"),
        _docx_paragraph(f"Topic: {normalized_topic}"),
        _docx_paragraph(f"Generated: {generated_at}"),
        _docx_paragraph(f"Retrieved papers: {len(normalized_papers)}"),
    ]

    if not normalized_papers:
        paragraphs.append(_docx_paragraph("No papers were retrieved for this topic."))
    else:
        for index, paper in enumerate(normalized_papers, start=1):
            authors = ", ".join(paper["authors"]) if paper["authors"] else "Unknown authors"
            year = paper["year"] if paper["year"] is not None else "Unknown year"
            paragraphs.extend(
                [
                    _docx_paragraph(f"{index}. {paper['title']}", "Heading2"),
                    _docx_paragraph(f"Authors: {authors}"),
                    _docx_paragraph(f"Year: {year}"),
                    _docx_paragraph(f"Citations: {paper['citation_count']}"),
                    _docx_paragraph(f"Source: {paper['source']}"),
                    _docx_paragraph(f"Paper ID: {paper['paper_id']}"),
                    _docx_paragraph(f"Abstract: {paper['abstract'] or 'Abstract not available.'}"),
                ]
            )

    document_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        f"{''.join(paragraphs)}"
        "<w:sectPr>"
        "<w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
        "</w:body>"
        "</w:document>"
    )

    styles_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">"
        "<w:name w:val=\"Normal\"/><w:qFormat/>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\">"
        "<w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\">"
        "<w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"26\"/></w:rPr>"
        "</w:style>"
        "</w:styles>"
    )

    content_types_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
        "<Override PartName=\"/word/document.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
        "<Override PartName=\"/word/styles.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
        "</Types>"
    )

    package_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
        "Target=\"word/document.xml\"/>"
        "</Relationships>"
    )

    document_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" "
        "Target=\"styles.xml\"/>"
        "</Relationships>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", package_rels_xml)
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/styles.xml", styles_xml)
        archive.writestr("word/_rels/document.xml.rels", document_rels_xml)

    return buffer.getvalue()


PLANNER_SECTION_KEYS = (
    "subtopics",
    "search_keywords",
    "possible_methods",
    "likely_datasets",
)


def _normalize_planner_section(title: str, items: Sequence[Any]) -> tuple[str, list[str]]:
    normalized_title = title.strip()
    if not normalized_title:
        raise ValueError("section title must not be empty.")

    if not isinstance(items, Sequence) or isinstance(items, (str, bytes)):
        raise ValueError("planner section items must be a list of strings.")

    normalized_items: list[str] = []
    for item in items:
        cleaned = str(item).strip()
        if cleaned:
            normalized_items.append(cleaned)

    return normalized_title, normalized_items


def build_planner_clipboard_text(topic: str, title: str, items: Sequence[Any]) -> str:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    normalized_title, normalized_items = _normalize_planner_section(title, items)
    lines = [
        "Planner Agent Result",
        f"Topic: {normalized_topic}",
        f"Section: {normalized_title}",
        "",
    ]

    if not normalized_items:
        lines.append("No items were returned for this section.")
        return "\n".join(lines)

    for index, item in enumerate(normalized_items, start=1):
        lines.append(f"{index}. {item}")

    return "\n".join(lines)


def generate_planner_section_pdf(topic: str, title: str, items: Sequence[Any]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    normalized_title, normalized_items = _normalize_planner_section(title, items)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "Planner Agent Research Section",
        f"Topic: {normalized_topic}",
        f"Section: {normalized_title}",
        f"Generated: {generated_at}",
        "",
    ]

    if not normalized_items:
        lines.append("No items were returned for this section.")
    else:
        for index, item in enumerate(normalized_items, start=1):
            lines.extend(_wrap_line(f"{index}. {item}"))
            lines.append("")

    lines_per_page = 46
    pages = [lines[index : index + lines_per_page] for index in range(0, len(lines), lines_per_page)] or [[]]

    objects: dict[int, bytes] = {}
    page_object_ids: list[int] = []
    font_object_id = 3

    for page_index, page_lines in enumerate(pages):
        page_object_id = 4 + (page_index * 2)
        content_object_id = page_object_id + 1
        page_object_ids.append(page_object_id)

        commands = ["BT", "/F1 11 Tf", "14 TL", "50 770 Td"]
        for line in page_lines:
            commands.append(f"({_escape_pdf_text(line)}) Tj")
            commands.append("T*")
        commands.append("ET")

        stream = "\n".join(commands).encode("latin-1", errors="replace")
        objects[content_object_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        objects[page_object_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
            f"/Contents {content_object_id} 0 R >>"
        ).encode("latin-1")

    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    page_refs = " ".join(f"{page_id} 0 R" for page_id in page_object_ids)
    objects[2] = f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{page_refs}] >>".encode("latin-1")
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for object_id in range(1, max(objects) + 1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        pdf.extend(objects[object_id])
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )

    return bytes(pdf)


def generate_planner_section_docx(topic: str, title: str, items: Sequence[Any]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    normalized_title, normalized_items = _normalize_planner_section(title, items)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    paragraphs = [
        _docx_paragraph("Planner Agent Section", "Heading1"),
        _docx_paragraph(f"Topic: {normalized_topic}"),
        _docx_paragraph(f"Section: {normalized_title}"),
        _docx_paragraph(f"Generated: {generated_at}"),
    ]

    if not normalized_items:
        paragraphs.append(_docx_paragraph("No items were returned for this section."))
    else:
        for index, item in enumerate(normalized_items, start=1):
            paragraphs.append(_docx_paragraph(f"{index}. {item}", "Heading2"))

    document_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        f"{''.join(paragraphs)}"
        "<w:sectPr>"
        "<w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
        "</w:body>"
        "</w:document>"
    )

    styles_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">"
        "<w:name w:val=\"Normal\"/><w:qFormat/>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\">"
        "<w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\">"
        "<w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"26\"/></w:rPr>"
        "</w:style>"
        "</w:styles>"
    )

    content_types_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
        "<Override PartName=\"/word/document.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
        "<Override PartName=\"/word/styles.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
        "</Types>"
    )

    package_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
        "Target=\"word/document.xml\"/>"
        "</Relationships>"
    )

    document_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" "
        "Target=\"styles.xml\"/>"
        "</Relationships>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", package_rels_xml)
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/styles.xml", styles_xml)
        archive.writestr("word/_rels/document.xml.rels", document_rels_xml)

    return buffer.getvalue()


def generate_academic_pdf(topic: str, academic_text: str) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "AlgoVision Research Intelligence Report",
        f"Research Topic: {normalized_topic}",
        f"Generated: {generated_at}",
        "",
        "---",
        "",
    ]

    for paragraph in academic_text.split("\n"):
        if paragraph.strip():
            lines.extend(_wrap_line(paragraph.strip()))
        else:
            lines.append("")

    lines_per_page = 46
    pages = [lines[index : index + lines_per_page] for index in range(0, len(lines), lines_per_page)] or [[]]

    objects: dict[int, bytes] = {}
    page_object_ids: list[int] = []
    font_object_id = 3

    for page_index, page_lines in enumerate(pages):
        page_object_id = 4 + (page_index * 2)
        content_object_id = page_object_id + 1
        page_object_ids.append(page_object_id)

        commands = ["BT", "/F1 11 Tf", "14 TL", "50 770 Td"]
        for line in page_lines:
            commands.append(f"({_escape_pdf_text(line)}) Tj")
            commands.append("T*")
        commands.append("ET")

        stream = "\n".join(commands).encode("latin-1", errors="replace")
        objects[content_object_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        objects[page_object_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
            f"/Contents {content_object_id} 0 R >>"
        ).encode("latin-1")

    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    page_refs = " ".join(f"{page_id} 0 R" for page_id in page_object_ids)
    objects[2] = f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{page_refs}] >>".encode("latin-1")
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for object_id in range(1, max(objects) + 1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        pdf.extend(objects[object_id])
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )

    return bytes(pdf)


def generate_academic_docx(topic: str, academic_text: str) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    paragraphs = [
        _docx_paragraph("AlgoVision Research Intelligence Report", "Heading1"),
        _docx_paragraph(f"Research Topic: {normalized_topic}"),
        _docx_paragraph(f"Generated: {generated_at}"),
        _docx_paragraph("", "Normal"),
    ]

    for paragraph in academic_text.split("\n"):
        text = paragraph.strip()
        if not text:
            paragraphs.append(_docx_paragraph("", "Normal"))
        elif text.isupper() and len(text) < 100:
            paragraphs.append(_docx_paragraph(text, "Heading1"))
        else:
            paragraphs.append(_docx_paragraph(text, "Normal"))

    document_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        f"{''.join(paragraphs)}"
        "<w:sectPr>"
        "<w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
        "</w:body>"
        "</w:document>"
    )

    styles_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">"
        "<w:name w:val=\"Normal\"/><w:qFormat/>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\">"
        "<w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\">"
        "<w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"26\"/></w:rPr>"
        "</w:style>"
        "</w:styles>"
    )

    content_types_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
        "<Override PartName=\"/word/document.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
        "<Override PartName=\"/word/styles.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
        "</Types>"
    )

    package_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
        "Target=\"word/document.xml\"/>"
        "</Relationships>"
    )

    document_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" "
        "Target=\"styles.xml\"/>"
        "</Relationships>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", package_rels_xml)
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/styles.xml", styles_xml)
        archive.writestr("word/_rels/document.xml.rels", document_rels_xml)

    return buffer.getvalue()


def generate_full_planner_pdf(topic: str, sections: Mapping[str, Sequence[Any]]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "Research Intelligence Report",
        f"Research Topic: {normalized_topic}",
        f"Generated: {generated_at}",
        "",
        "---",
        "",
    ]

    # Map for known internal keys to friendly display titles
    display_mapping = {
        "subtopics": "Subtopics",
        "search_keywords": "Search Keywords",
        "possible_methods": "Possible Methods",
        "likely_datasets": "Likely Datasets",
        "summary": "Summary",
        "methods_used": "Methods Used",
        "datasets_mentioned": "Datasets Mentioned",
        "key_findings": "Key Findings",
        "common_evidence": "Common Evidence",
        "differing_methods": "Differing Methods",
        "differing_datasets": "Differing Datasets",
        "evidence_clusters": "Evidence Clusters",
        "consensus_trends": "Consensus Trends",
        "contradiction_found": "Contradiction Found",
        "conflicting_statements": "Conflicting Statements",
        "confidence_level": "Confidence Level",
        "explanation": "Explanation",
        "identified_gaps": "Identified Gaps",
        "underexplored_areas": "Underexplored Areas",
        "future_directions": "Future Directions",
        "novelty_opportunities": "Novelty Opportunities",
    }

    for key, items in sections.items():
        if not items and key not in ["summary", "explanation", "contradiction_found", "confidence_level"]:
            continue
            
        display_title = display_mapping.get(key, key.replace("_", " ").title())
        lines.append(display_title.upper())
        lines.append("-" * len(display_title))
        
        if not items:
            lines.append("No findings identified for this section.")
        else:
            for index, item in enumerate(items, start=1):
                prefix = f"{index}. " if len(items) > 1 else ""
                lines.extend(_wrap_line(f"{prefix}{item}"))
        
        lines.append("")
        lines.append("")


    lines_per_page = 46
    pages = [lines[index : index + lines_per_page] for index in range(0, len(lines), lines_per_page)] or [[]]

    objects: dict[int, bytes] = {}
    page_object_ids: list[int] = []
    font_object_id = 3

    for page_index, page_lines in enumerate(pages):
        page_object_id = 4 + (page_index * 2)
        content_object_id = page_object_id + 1
        page_object_ids.append(page_object_id)

        commands = ["BT", "/F1 11 Tf", "14 TL", "50 770 Td"]
        for line in page_lines:
            commands.append(f"({_escape_pdf_text(line)}) Tj")
            commands.append("T*")
        commands.append("ET")

        stream = "\n".join(commands).encode("latin-1", errors="replace")
        objects[content_object_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        objects[page_object_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
            f"/Contents {content_object_id} 0 R >>"
        ).encode("latin-1")

    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    page_refs = " ".join(f"{page_id} 0 R" for page_id in page_object_ids)
    objects[2] = f"<< /Type /Pages /Count {len(page_object_ids)} /Kids [{page_refs}] >>".encode("latin-1")
    objects[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for object_id in range(1, max(objects) + 1):
        offsets.append(len(pdf))
        pdf.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        pdf.extend(objects[object_id])
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )

    return bytes(pdf)


def generate_full_planner_docx(topic: str, sections: Mapping[str, Sequence[Any]]) -> bytes:
    normalized_topic = topic.strip()
    if not normalized_topic:
        raise ValueError("topic must not be empty.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    paragraphs = [
        _docx_paragraph("Research Intelligence Report", "Heading1"),
        _docx_paragraph(f"Research Topic: {normalized_topic}"),
        _docx_paragraph(f"Generated: {generated_at}"),
    ]

    # Map for known internal keys to friendly display titles
    display_mapping = {
        "subtopics": "Subtopics",
        "search_keywords": "Search Keywords",
        "possible_methods": "Possible Methods",
        "likely_datasets": "Likely Datasets",
        "summary": "Summary",
        "methods_used": "Methods Used",
        "datasets_mentioned": "Datasets Mentioned",
        "key_findings": "Key Findings",
        "common_evidence": "Common Evidence",
        "differing_methods": "Differing Methods",
        "differing_datasets": "Differing Datasets",
        "evidence_clusters": "Evidence Clusters",
        "consensus_trends": "Consensus Trends",
        "contradiction_found": "Contradiction Found",
        "conflicting_statements": "Conflicting Statements",
        "confidence_level": "Confidence Level",
        "explanation": "Explanation",
        "identified_gaps": "Identified Gaps",
        "underexplored_areas": "Underexplored Areas",
        "future_directions": "Future Directions",
        "novelty_opportunities": "Novelty Opportunities",
    }

    for key, items in sections.items():
        if not items and key not in ["summary", "explanation", "contradiction_found", "confidence_level"]:
            continue

        display_title = display_mapping.get(key, key.replace("_", " ").title())
        paragraphs.append(_docx_paragraph("", "Normal"))
        paragraphs.append(_docx_paragraph(display_title, "Heading1"))
        
        if not items:
            paragraphs.append(_docx_paragraph("No findings identified for this section."))
        else:
            for index, item in enumerate(items, start=1):
                prefix = f"{index}. " if len(items) > 1 else ""
                paragraphs.append(_docx_paragraph(f"{prefix}{item}", "Heading2"))


    document_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\" "
        "xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\" "
        "xmlns:o=\"urn:schemas-microsoft-com:office:office\" "
        "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" "
        "xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" "
        "xmlns:v=\"urn:schemas-microsoft-com:vml\" "
        "xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\" "
        "xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" "
        "xmlns:w10=\"urn:schemas-microsoft-com:office:word\" "
        "xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" "
        "xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\" "
        "xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\" "
        "xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\" "
        "xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\" "
        "xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\" "
        "mc:Ignorable=\"w14 wp14\">"
        "<w:body>"
        f"{''.join(paragraphs)}"
        "<w:sectPr>"
        "<w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
        "</w:body>"
        "</w:document>"
    )

    styles_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\">"
        "<w:name w:val=\"Normal\"/><w:qFormat/>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\">"
        "<w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"32\"/></w:rPr>"
        "</w:style>"
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading2\">"
        "<w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/><w:qFormat/>"
        "<w:rPr><w:b/><w:sz w:val=\"26\"/></w:rPr>"
        "</w:style>"
        "</w:styles>"
    )

    content_types_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
        "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
        "<Override PartName=\"/word/document.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
        "<Override PartName=\"/word/styles.xml\" "
        "ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>"
        "</Types>"
    )

    package_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" "
        "Target=\"word/document.xml\"/>"
        "</Relationships>"
    )

    document_rels_xml = (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
        "<Relationship Id=\"rId1\" "
        "Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" "
        "Target=\"styles.xml\"/>"
        "</Relationships>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, mode="w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", package_rels_xml)
        archive.writestr("word/document.xml", document_xml)
        archive.writestr("word/styles.xml", styles_xml)
        archive.writestr("word/_rels/document.xml.rels", document_rels_xml)

    return buffer.getvalue()

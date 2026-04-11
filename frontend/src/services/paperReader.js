const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function parseError(response) {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    }
  } catch {
    return `Request failed with status ${response.status}.`;
  }

  return `Request failed with status ${response.status}.`;
}

export async function runPaperReader({ paperText }) {
  const response = await fetch(`${API_BASE_URL}/paper-reader`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paper_text: paperText,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

async function handleDownload(response, fallbackName) {
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  const matchedName = contentDisposition?.match(/filename="(.+)"/i)?.[1];
  const filename = matchedName || fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportFile({ topic, sectionTitle, items, endpoint, fallbackName }) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      section_title: sectionTitle,
      items,
    }),
  });
  return handleDownload(response, fallbackName);
}

async function exportFullFile({ topic, sections, endpoint, fallbackName }) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      sections,
    }),
  });
  return handleDownload(response, fallbackName);
}


export function exportPaperReaderSectionAsPdf({ topic, sectionTitle, items }) {
  return exportFile({
    topic,
    sectionTitle,
    items,
    endpoint: "/paper-reader/export/pdf",
    fallbackName: "paper-reader-section.pdf",
  });
}

export function exportPaperReaderSectionAsDocx({ topic, sectionTitle, items }) {
  return exportFile({
    topic,
    sectionTitle,
    items,
    endpoint: "/paper-reader/export/docx",
    fallbackName: "paper-reader-section.docx",
  });
}

export function exportFullPaperReaderAsPdf({ topic, sections }) {
  return exportFullFile({
    topic,
    sections,
    endpoint: "/paper-reader/export-full/pdf",
    fallbackName: "paper-analysis.pdf",
  });
}

export function exportFullPaperReaderAsDocx({ topic, sections }) {
  return exportFullFile({
    topic,
    sections,
    endpoint: "/paper-reader/export-full/docx",
    fallbackName: "paper-analysis.docx",
  });
}


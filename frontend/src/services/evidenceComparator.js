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

export async function runEvidenceComparator({ summaries }) {
  const response = await fetch(`${API_BASE_URL}/evidence-comparator`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summaries,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
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

export function exportEvidenceSectionAsPdf({ topic, sectionTitle, items }) {
  return exportFile({
    topic,
    sectionTitle,
    items,
    endpoint: "/evidence-comparator/export/pdf",
    fallbackName: "evidence-comparator-section.pdf",
  });
}

export function exportEvidenceSectionAsDocx({ topic, sectionTitle, items }) {
  return exportFile({
    topic,
    sectionTitle,
    items,
    endpoint: "/evidence-comparator/export/docx",
    fallbackName: "evidence-comparator-section.docx",
  });
}

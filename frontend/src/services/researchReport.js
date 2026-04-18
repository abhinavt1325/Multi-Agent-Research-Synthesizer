const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

async function parseError(response) {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail);
    }
  } catch {
    // ignore
  }
  return `Request failed with status ${response.status}.`;
}

/**
 * Run the full Smart Researcher pipeline.
 * @param {{ topic: string }} params
 */
export async function runSmartResearcher({ topic }) {
  const response = await fetch(`${API_BASE_URL}/research-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

async function _downloadExport(url, body, fallbackName) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  const filename = contentDisposition?.match(/filename="(.+)"/i)?.[1] || fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Export the Smart Researcher report as PDF.
 * @param {{ topic: string, report_data: object }} params
 */
export function exportSmartResearcherAsPdf({ topic, report_data }) {
  return _downloadExport(
    `${API_BASE_URL}/research-report/export/pdf`,
    { topic, report_data },
    "academic-report.pdf",
  );
}

/**
 * Export the Smart Researcher report as DOCX.
 * @param {{ topic: string, report_data: object }} params
 */
export function exportSmartResearcherAsDocx({ topic, report_data }) {
  return _downloadExport(
    `${API_BASE_URL}/research-report/export/docx`,
    { topic, report_data },
    "academic-report.docx",
  );
}

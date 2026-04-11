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

export async function searchLiterature({ topic, limit = 10, user_email }) {
  const response = await fetch(`${API_BASE_URL}/literature-hunter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      research_question: topic,
      context: [],
      filters: { limit, user_email },
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

async function exportFile({ topic, papers, endpoint, fallbackName }) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      papers,
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

export function exportPaperAsPdf({ topic, paper }) {
  return exportFile({
    topic,
    papers: [paper],
    endpoint: "/literature-hunter/export/pdf",
    fallbackName: "literature-hunter.pdf",
  });
}

export function exportPaperAsDocx({ topic, paper }) {
  return exportFile({
    topic,
    papers: [paper],
    endpoint: "/literature-hunter/export/docx",
    fallbackName: "literature-hunter.docx",
  });
}

export async function savePaperToGraph({ user_email, topic, paper }) {
  const response = await fetch(`${API_BASE_URL}/literature-hunter/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_email,
      topic,
      paper,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

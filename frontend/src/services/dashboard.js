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

async function getJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export function fetchDashboardSummary() {
  return getJson("/dashboard-summary");
}

export function fetchRecentPapers() {
  return getJson("/recent-papers");
}

export function fetchGraphData() {
  return getJson("/graph-data");
}

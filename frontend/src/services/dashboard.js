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

export function fetchDashboardSummary(email = "") {
  const query = email ? `?user_email=${encodeURIComponent(email)}` : "";
  return getJson(`/dashboard-summary${query}`);
}

export function fetchRecentPapers(email = "") {
  const query = email ? `?user_email=${encodeURIComponent(email)}` : "";
  return getJson(`/recent-papers${query}`);
}

export function fetchGraphData(email = "") {
  const query = email ? `?user_email=${encodeURIComponent(email)}` : "";
  return getJson(`/graph-data${query}`);
}

export async function deletePaper(paperId, email = "") {
  const query = email ? `?user_email=${encodeURIComponent(email)}` : "";
  const response = await fetch(`${API_BASE_URL}/papers/${encodeURIComponent(paperId)}${query}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

export async function restoreLegacyData(email) {
  const response = await fetch(`${API_BASE_URL}/auth/restore-legacy-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.json();
}

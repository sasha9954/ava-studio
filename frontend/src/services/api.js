import { getApiBaseUrl } from "./apiClient.js";

export const API_BASE = getApiBaseUrl().replace(/\/api\/?$/, "");

export async function fetchJson(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ava_token") : "";
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.message || `API error ${response.status}`);
  return data;
}

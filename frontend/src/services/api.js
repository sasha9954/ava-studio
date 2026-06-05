import { buildApiUrl, getApiBaseUrl, getApiOrigin } from "./apiClient.js";

export const API_BASE = getApiBaseUrl().replace(/\/api\/?$/, "");
export const API_BASE_URL = getApiBaseUrl();
export const API_ORIGIN = getApiOrigin();
export { buildApiUrl };

export async function fetchJson(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ava_token") : "";
  const isFormData = options.body instanceof FormData;
  const requestBody = options.body && !isFormData && typeof options.body === "object"
    ? JSON.stringify(options.body)
    : options.body;
  const response = await fetch(buildApiUrl(path), {
    ...options,
    body: requestBody,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string"
      ? detail
      : (detail?.message || detail?.code || data?.message || `API error ${response.status}`);
    throw new Error(message);
  }
  return data;
}

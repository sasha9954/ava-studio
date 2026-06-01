export function getAccountScopedStorageKey(key = "") {
  const token = typeof window !== "undefined" ? localStorage.getItem("ava_token") : "";
  const suffix = token ? token.slice(-12) : "guest";
  return `ava:${suffix}:${String(key || "key")}`;
}

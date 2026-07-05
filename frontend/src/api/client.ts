import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const TOKEN_KEY = "ghar_token";

async function getToken(): Promise<string | null> {
  return (await storage.getItem<string>(TOKEN_KEY, "")) || null;
}

export async function setToken(token: string | null) {
  if (token) await storage.setItem(TOKEN_KEY, token);
  else await storage.removeItem(TOKEN_KEY);
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  auth?: boolean;
  query?: Record<string, any>;
};

export async function apiFetch<T = any>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  let url = `${BASE}/api${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  sendOtp: (phone: string) => apiFetch("/auth/send-otp", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone: string, otp: string) =>
    apiFetch<{ token: string; user: any; is_new: boolean }>("/auth/verify-otp", {
      method: "POST",
      body: { phone, otp },
      auth: false,
    }),
  completeProfile: (name: string, email: string, role: "owner" | "buyer") =>
    apiFetch<{ user: any }>("/auth/complete-profile", { method: "POST", body: { name, email, role } }),
  me: () => apiFetch<{ user: any }>("/auth/me"),

  listProperties: (filters: Record<string, any> = {}) =>
    apiFetch<any[]>("/properties", { query: filters, auth: false }),
  getProperty: (id: string) => apiFetch<any>(`/properties/${id}`, { auth: false }),
  createProperty: (payload: any) => apiFetch<any>("/properties", { method: "POST", body: payload }),
  myProperties: () => apiFetch<any[]>("/properties/mine"),
  updateProperty: (id: string, payload: any) =>
    apiFetch<any>(`/properties/${id}`, { method: "PUT", body: payload }),
  deleteProperty: (id: string) => apiFetch<any>(`/properties/${id}`, { method: "DELETE" }),

  addWishlist: (id: string) => apiFetch(`/wishlist/${id}`, { method: "POST" }),
  removeWishlist: (id: string) => apiFetch(`/wishlist/${id}`, { method: "DELETE" }),
  getWishlist: () => apiFetch<any[]>("/wishlist"),

  createVisit: (property_id: string, scheduled_date: string, message: string) =>
    apiFetch("/visits", { method: "POST", body: { property_id, scheduled_date, message } }),
  listVisits: () => apiFetch<any[]>("/visits"),
  updateVisit: (id: string, status: "accepted" | "rejected") =>
    apiFetch(`/visits/${id}`, { method: "PUT", query: { status } }),

  sendMessage: (property_id: string, to_user_id: string, text: string) =>
    apiFetch("/chats/messages", { method: "POST", body: { property_id, to_user_id, text } }),
  listThreads: () => apiFetch<any[]>("/chats/threads"),
  getThread: (property_id: string, other_user_id: string) =>
    apiFetch<any>("/chats/thread", { query: { property_id, other_user_id } }),

  generateDescription: (payload: any) =>
    apiFetch<{ description: string }>("/ai/generate-description", { method: "POST", body: payload }),

  chatBot: (session_id: string, message: string) =>
    apiFetch<{ reply: string }>("/ai/chat", { method: "POST", body: { session_id, message } }),
  chatBotHistory: (session_id: string) =>
    apiFetch<any[]>("/ai/chat/history", { query: { session_id } }),

  getBridge: () => apiFetch<{ display: string; dial: string; label: string }>("/config/bridge", { auth: false }),

  adminStats: () => apiFetch<any>("/admin/stats"),
  adminList: (status?: string) => apiFetch<any[]>("/admin/properties", { query: { status } }),
  adminApprove: (id: string) => apiFetch(`/admin/properties/${id}/approve`, { method: "PUT" }),
  adminReject: (id: string) => apiFetch(`/admin/properties/${id}/reject`, { method: "PUT" }),
  adminFeature: (id: string, featured: boolean) =>
    apiFetch(`/admin/properties/${id}/feature`, { method: "PUT", query: { featured } }),
};

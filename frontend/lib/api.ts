const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("loanrisk_token");
  }
  return null;
}

export function setAuthToken(token: string | null) {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("loanrisk_token", token);
    } else {
      localStorage.removeItem("loanrisk_token");
    }
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let errDetail = "";
    try {
      const errJson = await response.json();
      errDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      errDetail = await response.text().catch(() => "");
    }
    throw new Error(errDetail || `API request failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text || !text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    return text as unknown as T;
  }
}

// ── Phase 8 – Production inference ────────────────────────────────────────
import type { ProductionPredictRequest, ProductionPredictResponse } from "@/lib/types";

export async function predictLoanRisk(
  payload: ProductionPredictRequest
): Promise<ProductionPredictResponse> {
  try {
    return await apiFetch<ProductionPredictResponse>("/api/predict", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    // Translate API error messages into user-facing strings matching Phase 8 spec
    const msg = err instanceof Error ? err.message : String(err);

    // 422 Unprocessable Entity – validation failure
    if (msg.includes("422") || msg.toLowerCase().includes("validation")) {
      throw new Error("VALIDATION_ERROR");
    }
    // 500 Internal Server Error
    if (msg.includes("500") || msg.toLowerCase().includes("internal server")) {
      throw new Error("SERVER_ERROR");
    }
    // Network / CORS / fetch failure
    if (
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("networkerror") ||
      msg.toLowerCase().includes("network request failed")
    ) {
      throw new Error("NETWORK_ERROR");
    }
    // Re-throw generic API errors as SERVER_ERROR
    throw new Error("SERVER_ERROR");
  }
}

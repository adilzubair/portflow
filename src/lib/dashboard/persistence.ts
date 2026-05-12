import { DEFAULT_HOLDINGS, type Holding } from "@/lib/constants";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { createClient } from "@/lib/supabase/client";

export const DEFAULT_INR_TO_AED_RATE = 0.044;
export const DEFAULT_FX_UPDATED_AT: string | null = null;

export function getHoldingsStorageKey(userId: string) {
  return `portflow-holdings-${userId}`;
}

export function getRateStorageKey(userId: string) {
  return `portflow-inr-aed-rate-${userId}`;
}

export function getFxUpdatedAtStorageKey(userId: string) {
  return `portflow-inr-aed-rate-updated-at-${userId}`;
}

function parseStoredHoldings(raw: string | null): Holding[] | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Holding[];
    return normalizeHoldings(parsed).normalized;
  } catch {
    return null;
  }
}

function parseStoredRate(raw: string | null) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INR_TO_AED_RATE;
}

function parseStoredTimestamp(raw: string | null) {
  if (!raw) {
    return DEFAULT_FX_UPDATED_AT;
  }

  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : DEFAULT_FX_UPDATED_AT;
}

async function requestHoldingsApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } & T | null;

  if (!response.ok) {
    throw new Error(payload?.error || `Holdings API request failed (${response.status})`);
  }

  return (payload || {}) as T;
}

async function fetchRemoteHoldingsState() {
  const payload = await requestHoldingsApi<{ holdings?: Holding[] }>("/api/holdings");
  return payload.holdings || [];
}

export async function loadDashboardPersistenceState() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id || "default";
  const storedHoldings = parseStoredHoldings(localStorage.getItem(getHoldingsStorageKey(userId)));
  const inrToAedRate = parseStoredRate(localStorage.getItem(getRateStorageKey(userId)));
  const fxUpdatedAt = parseStoredTimestamp(localStorage.getItem(getFxUpdatedAtStorageKey(userId)));

  try {
    const remoteHoldings = userId === "default" ? null : await fetchRemoteHoldingsState();

    if (remoteHoldings && remoteHoldings.length > 0) {
      const { normalized, changed } = normalizeHoldings(remoteHoldings);
      persistLocalHoldings(userId, normalized);

      if (changed) {
        await upsertRemoteHoldingsState(userId, normalized);
      }

      return { userId, holdings: normalized, inrToAedRate, fxUpdatedAt };
    }

    if (storedHoldings) {
      persistLocalHoldings(userId, storedHoldings);
      if (userId !== "default") {
        await upsertRemoteHoldingsState(userId, storedHoldings);
      }
      return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
    }
  } catch {
    if (storedHoldings) {
      return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
    }
  }

  if (storedHoldings) {
    return { userId, holdings: storedHoldings, inrToAedRate, fxUpdatedAt };
  }

  return { userId, holdings: DEFAULT_HOLDINGS, inrToAedRate, fxUpdatedAt };
}

export function persistLocalHoldings(userId: string, holdings: Holding[]) {
  localStorage.setItem(getHoldingsStorageKey(userId), JSON.stringify(holdings));
}

export function persistDashboardRate(userId: string, inrToAedRate: number) {
  localStorage.setItem(getRateStorageKey(userId), String(inrToAedRate));
}

export function persistFxUpdatedAt(userId: string, fxUpdatedAt: string | null) {
  if (!fxUpdatedAt) {
    localStorage.removeItem(getFxUpdatedAtStorageKey(userId));
    return;
  }

  localStorage.setItem(getFxUpdatedAtStorageKey(userId), fxUpdatedAt);
}

export async function syncDashboardHoldingsFromRemote(userId: string) {
  if (userId === "default") {
    return null;
  }

  const remoteHoldings = await fetchRemoteHoldingsState();
  const { normalized, changed } = normalizeHoldings(remoteHoldings);

  if (changed) {
    await upsertRemoteHoldingsState(userId, normalized);
  }

  return normalized;
}

export async function upsertRemoteHoldingsState(userId: string, holdings: Holding[]) {
  if (userId === "default") {
    return;
  }

  await requestHoldingsApi("/api/holdings", {
    method: "PATCH",
    body: JSON.stringify({ holdings }),
  });
}

export async function replaceRemoteHoldingsState(userId: string, holdings: Holding[]) {
  if (userId === "default") {
    return;
  }

  await requestHoldingsApi("/api/holdings", {
    method: "PUT",
    body: JSON.stringify({ holdings }),
  });
}

export async function deleteRemoteHoldingState(userId: string, id: string) {
  if (userId === "default") {
    return;
  }

  await requestHoldingsApi(`/api/holdings?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

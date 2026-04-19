"use client";

export const AUTH_REQUIRED_EVENT = "xiri:auth-required";

const AUTH_ERROR_PATTERNS = [
    "403",
    "permission-denied",
    "PERMISSION_DENIED",
    "unauthenticated",
    "UNAUTHENTICATED",
    "Missing or insufficient permissions",
    "auth/network-request-failed",
    "auth/user-token-expired",
    "auth/requires-recent-login",
    "auth/invalid-user-token",
    "token expired",
];

const OFFLINE_ERROR_PATTERNS = [
    "client is offline",
    "the client is offline",
    "failed to get document because the client is offline",
    "failed to get document because the client is offline.",
    "unavailable",
    "network-request-failed",
];

export function isAuthRelatedError(error: unknown): boolean {
    if (!error) return false;

    const candidate = error as {
        code?: string;
        message?: string;
        status?: number;
        name?: string;
    };

    if (candidate.status === 401 || candidate.status === 403) {
        return true;
    }

    const haystack = [
        candidate.code,
        candidate.message,
        candidate.name,
        typeof error === "string" ? error : "",
    ]
        .filter(Boolean)
        .join(" | ");

    return AUTH_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export function reportAuthRequired(reason = "Session expired or authorization failed") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(AUTH_REQUIRED_EVENT, {
            detail: { reason, at: Date.now() },
        })
    );
}

export function isOfflineLikeError(error: unknown): boolean {
    if (!error) return false;

    const candidate = error as {
        code?: string;
        message?: string;
        status?: number;
        name?: string;
    };

    if (candidate.code === "unavailable") return true;

    const haystack = [
        candidate.code,
        candidate.message,
        candidate.name,
        typeof error === "string" ? error : "",
    ]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();

    return OFFLINE_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

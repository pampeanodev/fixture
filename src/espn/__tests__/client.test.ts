import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchScoreboard, AutoSyncNetworkError } from "../client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchScoreboard", () => {
  it("rethrows an AbortError unchanged so callers can tell a cancelled fetch from a network failure", async () => {
    const abortErr = new DOMException("signal is aborted without reason", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortErr));

    await expect(fetchScoreboard({ dates: "20260611" })).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof DOMException &&
        err.name === "AbortError" &&
        !(err instanceof AutoSyncNetworkError),
    );
  });

  it("wraps a genuine network error in AutoSyncNetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchScoreboard({ dates: "20260611" })).rejects.toBeInstanceOf(
      AutoSyncNetworkError,
    );
  });

  it("throws AutoSyncNetworkError carrying the HTTP status for a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response),
    );

    await expect(fetchScoreboard({ dates: "20260611" })).rejects.toMatchObject({
      name: "AutoSyncNetworkError",
      status: 503,
    });
  });
});

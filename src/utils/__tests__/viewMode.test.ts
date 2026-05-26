import { describe, it, expect, beforeEach } from "vitest";
import { loadViewMode, saveViewMode } from "../viewMode";

describe("viewMode", () => {
  beforeEach(() => { localStorage.clear(); });

  it("loadViewMode returns 'expanded' when localStorage is empty", () => {
    expect(loadViewMode()).toBe("expanded");
  });

  it("loadViewMode returns 'expanded' when stored value is invalid", () => {
    localStorage.setItem("viewMode", "garbage");
    expect(loadViewMode()).toBe("expanded");
  });

  it("loadViewMode returns the stored value when valid", () => {
    localStorage.setItem("viewMode", "compact");
    expect(loadViewMode()).toBe("compact");
  });

  it("saveViewMode writes to localStorage under 'viewMode'", () => {
    saveViewMode("compact");
    expect(localStorage.getItem("viewMode")).toBe("compact");
  });

  it("saveViewMode swallows localStorage errors", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota"); };
    expect(() => saveViewMode("compact")).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});

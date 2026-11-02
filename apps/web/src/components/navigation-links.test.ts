import { describe, expect, it } from "vitest";
import { getNavigationUrls } from "./navigation-links";

describe("getNavigationUrls", () => {
  it("builds coordinates directions URLs for Google, Apple, and OpenStreetMap", () => {
    const urls = getNavigationUrls({ latitude: 35.0116, longitude: 135.7681 });
    expect(urls).not.toBeNull();
    expect(urls?.google).toBe("https://www.google.com/maps/dir/?api=1&destination=35.0116,135.7681");
    expect(urls?.apple).toBe("https://maps.apple.com/?daddr=35.0116,135.7681");
    expect(urls?.osm).toBe("https://www.openstreetmap.org/directions?to=35.0116%2C135.7681");
  });

  it("builds query directions URLs when coordinates are absent but address is present", () => {
    const urls = getNavigationUrls({ address: "Eiffel Tower, Paris" });
    expect(urls).not.toBeNull();
    expect(urls?.google).toContain("destination=Eiffel%20Tower%2C%20Paris");
    expect(urls?.apple).toContain("daddr=Eiffel%20Tower%2C%20Paris");
  });

  it("returns null when no location information is provided", () => {
    const urls = getNavigationUrls({});
    expect(urls).toBeNull();
  });
});

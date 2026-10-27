import { describe, expect, it } from "vitest";
import { parseGoogleMapsLink } from "./geo";

describe("parseGoogleMapsLink", () => {
  it("reads the place pin coordinates from a Google Maps URL", () => {
    const parsed = parseGoogleMapsLink("https://www.google.com/maps/place/Kyoto/@35.0116,135.7681,15z/data=!4m2!3d35.0116!4d135.7681");
    expect(parsed).toMatchObject({ ok: true, latitude: 35.0116, longitude: 135.7681 });
  });

  it("reads the viewport coordinates from an @ path", () => {
    const parsed = parseGoogleMapsLink("https://www.google.com/maps/@35.0116,135.7681,15z");
    expect(parsed).toMatchObject({ ok: true, latitude: 35.0116, longitude: 135.7681 });
  });

  it("reads coordinates from query parameters", () => {
    const parsed = parseGoogleMapsLink("https://maps.google.com/?q=loc:35.0116,135.7681");
    expect(parsed).toMatchObject({ ok: true, latitude: 35.0116, longitude: 135.7681 });
  });

  it("accepts direct coordinates and creates a Maps link", () => {
    const parsed = parseGoogleMapsLink("35.0116, 135.7681");
    expect(parsed).toMatchObject({
      ok: true,
      latitude: 35.0116,
      longitude: 135.7681,
      link: "https://www.google.com/maps?q=35.0116,135.7681",
    });
  });

  it("rejects out-of-range coordinates", () => {
    const parsed = parseGoogleMapsLink("91, 135.7681");
    expect(parsed.ok).toBe(false);
  });

  it("explains that short links cannot be expanded offline", () => {
    const parsed = parseGoogleMapsLink("https://maps.app.goo.gl/example");
    expect(parsed).toMatchObject({ ok: false });
    if (!parsed.ok) expect(parsed.message).toContain("short link");
  });

  it("explains when a Maps link has no coordinates", () => {
    const parsed = parseGoogleMapsLink("https://www.google.com/maps/place/Kyoto");
    expect(parsed).toMatchObject({ ok: false });
    if (!parsed.ok) expect(parsed.message).toContain("does not include coordinates");
  });

  it("rejects unsafe protocols", () => {
    const parsed = parseGoogleMapsLink("javascript:alert(1)");
    expect(parsed.ok).toBe(false);
  });
});

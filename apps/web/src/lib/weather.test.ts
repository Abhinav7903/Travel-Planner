import { describe, expect, it } from "vitest";
import { getWeatherDescription, getWeatherIconName } from "./weather";

describe("weather utilities", () => {
  it("translates WMO weather codes to readable descriptions", () => {
    expect(getWeatherDescription(0)).toBe("Clear sky");
    expect(getWeatherDescription(3)).toBe("Overcast");
    expect(getWeatherDescription(61)).toBe("Slight rain");
    expect(getWeatherDescription(95)).toBe("Thunderstorm");
  });

  it("determines correct icon names for weather codes", () => {
    expect(getWeatherIconName(0)).toBe("sun");
    expect(getWeatherIconName(1)).toBe("cloud-sun");
    expect(getWeatherIconName(3)).toBe("cloud");
    expect(getWeatherIconName(61)).toBe("cloud-rain");
    expect(getWeatherIconName(71)).toBe("cloud-snow");
    expect(getWeatherIconName(95)).toBe("cloud-lightning");
  });
});

export type DailyWeather = {
  date: string;
  weatherCode: number;
  description: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
};

const weatherCodeMap: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function getWeatherDescription(code: number): string {
  return weatherCodeMap[code] ?? "Fair";
}

export function getWeatherIconName(code: number): "sun" | "cloud-sun" | "cloud" | "cloud-fog" | "cloud-drizzle" | "cloud-rain" | "cloud-snow" | "cloud-lightning" {
  if (code === 0) return "sun";
  if (code === 1 || code === 2) return "cloud-sun";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "cloud-fog";
  if (code >= 51 && code <= 57) return "cloud-drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "cloud-rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "cloud-snow";
  if (code >= 95) return "cloud-lightning";
  return "sun";
}

const memoryCache = new Map<string, { timestamp: number; data: Record<string, DailyWeather> }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function fetchWeatherForecast(latitude: number, longitude: number): Promise<Record<string, DailyWeather> | null> {
  const roundedLat = latitude.toFixed(2);
  const roundedLng = longitude.toFixed(2);
  const cacheKey = `${roundedLat},${roundedLng}`;

  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;

    type OpenMeteoResponse = {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
      };
    };

    const json = (await res.json()) as OpenMeteoResponse;
    if (!json.daily || !json.daily.time) return null;

    const result: Record<string, DailyWeather> = {};
    for (let i = 0; i < json.daily.time.length; i++) {
      const date = json.daily.time[i];
      if (!date) continue;
      const code = json.daily.weather_code?.[i] ?? 0;
      const max = Math.round(json.daily.temperature_2m_max?.[i] ?? 0);
      const min = Math.round(json.daily.temperature_2m_min?.[i] ?? 0);
      const rainProb = Math.round(json.daily.precipitation_probability_max?.[i] ?? 0);

      result[date] = {
        date,
        weatherCode: code,
        description: getWeatherDescription(code),
        tempMax: max,
        tempMin: min,
        precipitationProbability: rainProb,
      };
    }

    memoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch {
    return null;
  }
}

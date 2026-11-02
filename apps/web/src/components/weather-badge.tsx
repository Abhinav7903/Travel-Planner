"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { fetchWeatherForecast, type DailyWeather, getWeatherIconName } from "@/lib/weather";
import { cn } from "@/lib/utils";

const iconComponents: Record<ReturnType<typeof getWeatherIconName>, LucideIcon> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
};

export function WeatherBadge({
  latitude,
  longitude,
  date,
  className,
}: {
  latitude?: number | null;
  longitude?: number | null;
  date: string;
  className?: string;
}) {
  const [forecast, setForecast] = useState<DailyWeather | null>(null);

  useEffect(() => {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    if (latitude === 0 && longitude === 0) return;

    let cancelled = false;
    void (async () => {
      const data = await fetchWeatherForecast(latitude, longitude);
      if (cancelled || !data) return;
      if (data[date]) {
        setForecast(data[date]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, date]);

  if (!forecast) return null;

  const iconName = getWeatherIconName(forecast.weatherCode);
  const Icon = iconComponents[iconName] || Sun;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-xs",
        className,
      )}
      title={`${forecast.description} · High ${forecast.tempMax}°C, Low ${forecast.tempMin}°C${
        forecast.precipitationProbability > 0 ? ` · ${forecast.precipitationProbability}% precip` : ""
      }`}
    >
      <Icon size={13} className="shrink-0 text-forest" />
      <span>
        {forecast.tempMax}° / {forecast.tempMin}°
      </span>
      {forecast.precipitationProbability > 20 ? (
        <span className="flex items-center gap-0.5 text-ink-faint">
          <Droplets size={10} className="text-[#3b82f6]" />
          {forecast.precipitationProbability}%
        </span>
      ) : null}
      <span className="hidden sm:inline text-ink-faint">· {forecast.description}</span>
    </div>
  );
}

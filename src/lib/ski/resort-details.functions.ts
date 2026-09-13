import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Messaggio unico per i dati neve non disponibili (pausa stagionale/fallback). */
export const SNOW_UNAVAILABLE = "Dato non disponibile (pausa stagionale)";

export interface WeatherNow {
  temperatureC: number | null;
  condition: string;
  iconUrl: string | null;
  /** Neve caduta nelle ultime ore (cm), misura reale Open-Meteo. */
  snowfallCm: number | null;
  /** Precipitazioni in corso in mm. */
  precipitationMm: number | null;
  /** Vento in km/h. */
  windKph: number | null;
  /** Direzione del vento in gradi. */
  windDirection: number | null;
}

export interface WeatherDay {
  date: string;
  minC: number | null;
  maxC: number | null;
  condition: string;
  iconUrl: string | null;
  /** Neve prevista in cm (dati reali Open-Meteo). */
  snowfallCm: number | null;
  precipitationMm: number | null;
  windKph: number | null;
}

export interface ResortWeather {
  now: WeatherNow | null;
  forecast: WeatherDay[];
  /** Provenienza del dato neve mostrato in interfaccia. */
  source: "open-meteo" | null;
  error: string | null;
}

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Descrizione in italiano dei codici meteo WMO usati da Open-Meteo. */
const WMO: Record<number, string> = {
  0: "Sereno",
  1: "Prevalentemente sereno",
  2: "Parzialmente nuvoloso",
  3: "Coperto",
  45: "Nebbia",
  48: "Nebbia con brina",
  51: "Pioviggine debole",
  53: "Pioviggine",
  55: "Pioviggine intensa",
  56: "Pioviggine gelata",
  57: "Pioviggine gelata intensa",
  61: "Pioggia debole",
  63: "Pioggia",
  65: "Pioggia forte",
  66: "Pioggia gelata",
  67: "Pioggia gelata forte",
  71: "Neve debole",
  73: "Neve",
  75: "Neve abbondante",
  77: "Granuli di neve",
  80: "Rovesci deboli",
  81: "Rovesci",
  82: "Rovesci violenti",
  85: "Rovesci di neve",
  86: "Rovesci di neve intensi",
  95: "Temporale",
  96: "Temporale con grandine",
  99: "Temporale con grandine forte",
};

const condition = (code: number | null): string => (code === null ? "\u2014" : (WMO[code] ?? "\u2014"));

/** Cache meteo lato server (45 minuti). */
const weatherCache = new Map<string, { at: number; value: ResortWeather }>();
const WEATHER_TTL = 45 * 60 * 1000;

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    snowfall?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    snowfall_sum?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

/**
 * Meteo attuale + previsioni sulle coordinate reali del comprensorio, con dati
 * aperti Open-Meteo (nessuna chiave, nessun servizio Google). La neve è una
 * misura reale in cm: nessuna stima interna.
 */
export const resortWeather = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }): Promise<ResortWeather> => {
    const key = `${data.lat.toFixed(2)},${data.lng.toFixed(2)}`;
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.at < WEATHER_TTL) return cached.value;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lng}` +
      `&current=temperature_2m,precipitation,snowfall,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=3`;

    let json: OpenMeteoResponse | null = null;
    try {
      const res = await fetch(url);
      if (res.ok) json = (await res.json()) as OpenMeteoResponse;
      else console.error(`Open-Meteo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      console.error("Open-Meteo errore di rete", err);
    }

    if (!json?.current && !json?.daily) {
      if (cached) return cached.value;
      return {
        now: null,
        forecast: [],
        source: null,
        error: "Meteo temporaneamente non disponibile: riprova tra poco.",
      };
    }

    const c = json.current;
    const now: WeatherNow | null = c
      ? {
          temperatureC: num(c.temperature_2m),
          condition: condition(num(c.weather_code)),
          iconUrl: null,
          snowfallCm: num(c.snowfall),
          precipitationMm: num(c.precipitation),
          windKph: num(c.wind_speed_10m),
          windDirection: num(c.wind_direction_10m),
        }
      : null;

    const d = json.daily;
    const forecast: WeatherDay[] = (d?.time ?? []).map((date, i) => ({
      date,
      minC: num(d?.temperature_2m_min?.[i]),
      maxC: num(d?.temperature_2m_max?.[i]),
      condition: condition(num(d?.weather_code?.[i])),
      iconUrl: null,
      snowfallCm: num(d?.snowfall_sum?.[i]),
      precipitationMm: num(d?.precipitation_sum?.[i]),
      windKph: num(d?.wind_speed_10m_max?.[i]),
    }));

    const value: ResortWeather = {
      now,
      forecast: forecast.filter((f) => f.date),
      source: "open-meteo",
      error: null,
    };
    weatherCache.set(key, { at: Date.now(), value });
    return value;
  });


export interface Webcam {
  id: string;
  title: string;
  playerUrl: string;
  previewUrl: string | null;
}

/**
 * Webcam live vicine al comprensorio.
 * Con la chiave Windy usiamo l'API Webcams (player embeddato); senza chiave
 * mostriamo la mappa webcam di Windy incorporata (nessun link esterno rotto).
 */
export const resortWebcams = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coordsSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["WINDY_WEBCAMS_API_KEY"];
    const mapEmbed = `https://embed.windy.com/embed2.html?lat=${data.lat}&lon=${data.lng}&zoom=11&level=surface&overlay=webcams&menu=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C`;

    if (!key) return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };

    try {
      const res = await fetch(
        `https://api.windy.com/webcams/api/v3/webcams?nearby=${data.lat},${data.lng},30&limit=6&include=images,player&lang=it`,
        { headers: { "x-windy-api-key": key } },
      );
      if (!res.ok) {
        console.error(`Windy ${res.status}: ${await res.text()}`);
        return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };
      }
      const json = (await res.json()) as {
        webcams?: Array<{
          webcamId: number;
          title?: string;
          player?: { live?: { embed?: string }; day?: { embed?: string } };
          images?: { current?: { preview?: string } };
        }>;
      };
      const webcams: Webcam[] = (json.webcams ?? [])
        .map((w) => ({
          id: String(w.webcamId),
          title: w.title ?? "Webcam",
          playerUrl:
            w.player?.live?.embed ??
            w.player?.day?.embed ??
            `https://webcams.windy.com/webcams/public/embed/player/${w.webcamId}/live`,
          previewUrl: w.images?.current?.preview ?? null,
        }))
        .filter((w) => Boolean(w.playerUrl));
      return { webcams, mapEmbed, error: null as string | null };
    } catch (err) {
      console.error("Windy webcams error", err);
      return { webcams: [] as Webcam[], mapEmbed, error: null as string | null };
    }
  });

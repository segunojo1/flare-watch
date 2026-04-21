"use client";

import dynamic from "next/dynamic";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchLiveTelemetry,
  type FlarePoint,
  type TelemetryMeta,
} from "@/services/flare.service";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const mapSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mapSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const offshorePattern = /offshore|fpso|terminal|platform|deepwater/i;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const formatHeat = (value: number) => `${value.toFixed(1)} mscf`;

const formatUtc = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
};

type FilterMode = "onshore" | "offshore";

type SignalCard = {
  label: string;
  value: string;
  detail: string;
  accent: string;
};

const LiveMap = () => {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("onshore");
  const [meta, setMeta] = useState<TelemetryMeta | null>(null);
  const [flares, setFlares] = useState<FlarePoint[]>([]);
  const [selectedFlare, setSelectedFlare] = useState<FlarePoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState({ width: 720, height: 520 });

  const loadTelemetry = useCallback(async (signal?: AbortSignal) => {
    try {
      const payload = await fetchLiveTelemetry(signal);
      setMeta(payload.meta);
      setFlares(payload.telemetry);
      setSelectedFlare((current) =>
        current
          ? (payload.telemetry.find((flare) => flare.id === current.id) ??
            payload.telemetry[0] ??
            null)
          : (payload.telemetry[0] ?? null),
      );
      setError(null);
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return;
      }

      setError("Unable to load live telemetry. Please retry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    void loadTelemetry(abortController.signal);

    const interval = window.setInterval(() => {
      void loadTelemetry();
    }, REFRESH_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [loadTelemetry]);

  useEffect(() => {
    const element = globeContainerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setGlobeSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.max(420, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const filteredFlares = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    return flares.filter((flare) => {
      const searchTarget =
        `${flare.attribution.block} ${flare.attribution.operator}`.toLowerCase();
      const isOffshore = offshorePattern.test(
        `${flare.attribution.block} ${flare.attribution.operator}`,
      );
      const isModeMatch = filterMode === "offshore" ? isOffshore : !isOffshore;
      const isQueryMatch =
        trimmedQuery.length === 0 || searchTarget.includes(trimmedQuery);

      return isModeMatch && isQueryMatch;
    });
  }, [flares, filterMode, query]);

  const topFiveFlares = useMemo(
    () =>
      [...filteredFlares]
        .sort((a, b) => b.radiant_heat_mscf - a.radiant_heat_mscf)
        .slice(0, 5),
    [filteredFlares],
  );

  const totalHeat = useMemo(
    () =>
      filteredFlares.reduce((sum, flare) => sum + flare.radiant_heat_mscf, 0),
    [filteredFlares],
  );

  const uniqueBlocks = useMemo(
    () => new Set(filteredFlares.map((flare) => flare.attribution.block)).size,
    [filteredFlares],
  );

  const sidebarSignals = useMemo<SignalCard[]>(() => {
    const atmosphericValue =
      filteredFlares.length === 0
        ? "CALM"
        : filteredFlares.length < 25
          ? "LOW"
          : filteredFlares.length < 60
            ? "MODERATE"
            : "ACTIVE";

    const heatTone =
      totalHeat < 500
        ? "FOCUSED"
        : totalHeat < 1500
          ? "ELEVATED"
          : "INTENSE";

    return [
      {
        label: "Atmospheric flow",
        value: atmosphericValue,
        detail: `${filteredFlares.length} active points in view`,
        accent: "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FFB089]",
      },
      {
        label: "Flaring volume",
        value: formatHeat(totalHeat),
        detail: `Heat profile: ${heatTone}`,
        accent: "border-[#2A5B8A] bg-[#0D1C2C] text-[#9DC7FF]",
      },
      {
        label: "Infrastructure",
        value: `${uniqueBlocks} blocks`,
        detail: filterMode === "offshore" ? "Offshore watch" : "Onshore watch",
        accent: "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]",
      },
    ];
  }, [filterMode, filteredFlares.length, totalHeat, uniqueBlocks]);

  return (
    <section className={`${mapSans.className} w-full px-3 pb-6 md:px-8`}>
      <div className="grid min-h-[calc(100vh-180px)] grid-cols-1 gap-4 border border-[#2D2D2D] bg-[#0A0A0A] lg:grid-cols-[220px_1fr_320px]">
        <aside className="border-b border-[#232323] p-4 lg:border-b-0 lg:border-r lg:border-[#232323]">
          <p className="text-[20px]/[28px] font-bold text-[#FF6B00]">
            SENTINEL-LIVE
          </p>
          <p className="text-[10px]/[15px] tracking-[1px] text-[#737373]">
            {meta
              ? `Latest capture: ${formatUtc(meta.timestamp)} UTC`
              : "Waiting for telemetry"}
          </p>

          <div className="mt-8 space-y-2 text-[11px]/[16.5px]">
            <p className="border-l-2 border-[#FF6B00] bg-[#FF6B00]/10 px-3 py-2 font-semibold text-[#FF6B00]">
              THERMAL ANOMALIES
            </p>
            <p className="px-3 py-2 text-[#737373]">SYSTEM SIGNALS</p>
          </div>

          <div className="mt-4 space-y-3">
            {sidebarSignals.map((signal) => (
              <div
                key={signal.label}
                className={`border px-3 py-3 ${signal.accent}`}
              >
                <p className="text-[10px]/[15px] uppercase tracking-[1.5px] opacity-75">
                  {signal.label}
                </p>
                <p className="mt-1 text-[18px]/[22px] font-bold">
                  {signal.value}
                </p>
                <p className="mt-1 text-[10px]/[15px] tracking-[1px] opacity-75">
                  {signal.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 text-[10px]/[15px] tracking-[1px] text-[#525252]">
            <p>DATASET: {meta?.dataset ?? "--"}</p>
            <p>SATELLITE: {meta?.satellite ?? "--"}</p>
            <p>REGION: {meta?.region ?? "--"}</p>
            <p>VIEW MODE: {filterMode.toUpperCase()}</p>
          </div>
        </aside>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_20%,rgba(255,107,0,0.25),transparent_45%),radial-gradient(circle_at_50%_80%,rgba(8,41,86,0.7),transparent_58%)]" />

          <div className="absolute left-4 top-4 z-20 border-l-2 border-[#FF6B00] bg-[#0A0A0A]/85 px-4 py-3 backdrop-blur">
            <p className="text-[10px]/[15px] tracking-[2px] text-[#A3A3A3]">
              REAL-TIME DETECTION
            </p>
            <p className={`${mapSerif.className} text-[33px]/[40px] italic`}>
              Gas flared now:
              <span className="ml-2 font-bold text-[#FF6B00]">
                {formatHeat(totalHeat)}
              </span>
            </p>
          </div>

          <div ref={globeContainerRef} className="h-130 w-full lg:h-full">
            <Globe
              width={globeSize.width}
              height={globeSize.height}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              backgroundColor="rgba(0,0,0,0)"
              htmlElementsData={filteredFlares}
              htmlLat="lat"
              htmlLng="lng"
              htmlElement={(flare: object) => {
                const typedFlare = flare as FlarePoint;
                const marker = document.createElement("button");
                const markerSize = clamp(
                  typedFlare.radiant_heat_mscf / 8,
                  10,
                  28,
                );

                marker.type = "button";
                marker.style.width = `${markerSize}px`;
                marker.style.height = `${markerSize}px`;
                marker.style.borderRadius = "999px";
                marker.style.border = "0";
                marker.style.cursor = "pointer";
                marker.style.background =
                  "radial-gradient(circle, rgba(255,107,0,0.92) 0%, rgba(255,107,0,0.18) 65%, rgba(255,107,0,0) 100%)";
                marker.style.boxShadow = "0 0 16px rgba(255,107,0,0.78)";
                marker.style.pointerEvents = "auto";
                marker.title = `${typedFlare.attribution.block} | ${formatHeat(typedFlare.radiant_heat_mscf)}`;
                marker.onclick = () => setSelectedFlare(typedFlare);

                return marker;
              }}
            />
          </div>

          {isLoading ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
              <p className="text-sm text-[#E5E5E5]">
                Syncing live telemetry...
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-3 border border-[#5A4136] bg-[#111111] p-3">
              <p className="text-[11px]/[16px] text-[#FFB089]">{error}</p>
              <Button
                className="h-8 rounded-none bg-[#FF6B00] px-3 py-1 text-[10px] font-bold text-black hover:bg-[#FF6B00]/90"
                onClick={() => void loadTelemetry()}
              >
                RETRY
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="border-t border-[#232323] p-4 lg:border-l lg:border-t-0 lg:border-[#232323]">
          <p className="text-[12px]/[18px] tracking-[2px] text-[#F5F5F5]">
            FLARE DETAILS
          </p>

          <div className="mt-4 border border-[#2D2D2D] bg-[#E8E8E8] p-4 text-black">
            <div className="flex items-start justify-between">
              <p className={`${mapSerif.className} text-[32px]/[36px] italic`}>
                {selectedFlare?.attribution.block ?? "Select a flare"}
              </p>
              <span className="text-[#FF6B00]">▲</span>
            </div>

            <p className="mt-2 text-[10px]/[15px] tracking-[1px] text-[#737373]">
              SITE ID: {selectedFlare?.id ?? "N/A"}
            </p>

            <div className="mt-5 space-y-3 text-[11px]/[16px]">
              <div className="flex items-center justify-between border-b border-[#D3D3D3] pb-2">
                <p className="text-[#7A7A7A]">OPERATOR</p>
                <p className="font-semibold">
                  {selectedFlare?.attribution.operator ?? "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#D3D3D3] pb-2">
                <p className="text-[#7A7A7A]">FLARED NOW</p>
                <p className="font-semibold">
                  {selectedFlare
                    ? formatHeat(selectedFlare.radiant_heat_mscf)
                    : "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#D3D3D3] pb-2">
                <p className="text-[#7A7A7A]">TREND</p>
                <p className="font-semibold">
                  {selectedFlare?.attribution.trend ?? "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[#7A7A7A]">LAT / LNG</p>
                <p className="font-semibold">
                  {selectedFlare
                    ? `${selectedFlare.lat.toFixed(3)}, ${selectedFlare.lng.toFixed(3)}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-[12px]/[18px] tracking-[2px] text-[#F5F5F5]">
            DATA FILTERS
          </p>

          <label className="mt-4 flex items-center border border-[#2D2D2D] px-3 py-2">
            <Search size={14} className="text-[#525252]" />
            <input
              className="ml-2 w-full bg-transparent text-[11px]/[16px] text-[#E5E5E5] outline-none placeholder:text-[#525252]"
              placeholder="Search sites or operators"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]/[16px] font-semibold">
            <Button
              className={`rounded-none border px-3 py-2 text-xs ${
                filterMode === "onshore"
                  ? "border-[#FF6B00] bg-[#FF6B00]/20 text-[#FF6B00]"
                  : "border-[#2D2D2D] bg-transparent text-[#737373]"
              }`}
              onClick={() => setFilterMode("onshore")}
            >
              ONSHORE
            </Button>
            <Button
              className={`rounded-none border px-3 py-2 text-xs ${
                filterMode === "offshore"
                  ? "border-[#FF6B00] bg-[#FF6B00]/20 text-[#FF6B00]"
                  : "border-[#2D2D2D] bg-transparent text-[#737373]"
              }`}
              onClick={() => setFilterMode("offshore")}
            >
              OFFSHORE
            </Button>
          </div>

          <div className="mt-6 border-t border-[#232323] pt-4">
            <p className="text-[10px]/[15px] tracking-[1.5px] text-[#737373]">
              TOP 5 FLARES ({filterMode})
            </p>

            <div className="mt-4 space-y-4">
              {topFiveFlares.map((flare) => (
                <button
                  key={flare.id}
                  type="button"
                  onClick={() => setSelectedFlare(flare)}
                  className="w-full border-b border-[#1F1F1F] pb-3 text-left"
                >
                  <p
                    className={`${mapSerif.className} text-[28px]/[32px] italic text-white`}
                  >
                    {flare.attribution.block}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-[10px]/[15px] text-[#737373]">
                      {flare.attribution.operator}
                    </p>
                    <p className="text-[12px]/[18px] font-bold text-[#FF6B00]">
                      {formatHeat(flare.radiant_heat_mscf)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-[10px]/[15px] tracking-[1px] text-[#525252]">
            {filteredFlares.length} total sites detected in this view
          </p>
        </aside>
      </div>
    </section>
  );
};

export default LiveMap;

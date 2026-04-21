"use client";

import dynamic from "next/dynamic";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchLiveTelemetry,
  fetchFlareOverview,
  type FlareOverviewResponse,
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

const riskOrder: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const getRiskAccent = (riskLevel: string) => {
  switch (riskLevel.toUpperCase()) {
    case "CRITICAL":
      return "border-[#D64545] bg-[#2C1515] text-[#FF9999]";
    case "HIGH":
      return "border-[#FF6B00] bg-[#23160A] text-[#FFB089]";
    case "MODERATE":
      return "border-[#9C6B2F] bg-[#21170D] text-[#F2C27B]";
    default:
      return "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]";
  }
};

const getRiskBadgeClass = (riskLevel: string) => {
  switch (riskLevel.toUpperCase()) {
    case "CRITICAL":
      return "border-[#D64545] bg-[#2C1515] text-[#FF9999]";
    case "HIGH":
      return "border-[#FF6B00] bg-[#23160A] text-[#FFB089]";
    case "MODERATE":
      return "border-[#9C6B2F] bg-[#21170D] text-[#F2C27B]";
    default:
      return "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]";
  }
};

const getConfidenceBadgeClass = (confidence: string) => {
  switch (confidence.toLowerCase()) {
    case "high":
      return "border-[#2D8659] bg-[#0D1F16] text-[#8EF0B0]";
    case "nominal":
      return "border-[#2A5B8A] bg-[#0D1C2C] text-[#9DC7FF]";
    default:
      return "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]";
  }
};

const AI_HOVER_DELAY_MS = 450;

const LiveMap = () => {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("onshore");
  const [meta, setMeta] = useState<TelemetryMeta | null>(null);
  const [flares, setFlares] = useState<FlarePoint[]>([]);
  const [selectedFlare, setSelectedFlare] = useState<FlarePoint | null>(null);
  const [hoveredFlare, setHoveredFlare] = useState<FlarePoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [aiOverview, setAiOverview] = useState<FlareOverviewResponse | null>(
    null,
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const aiCacheRef = useRef(new Map<string, FlareOverviewResponse>());
  const aiTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (!hoveredFlare) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const isMarkerHovered = Boolean(
        target && (target as HTMLElement).closest('[data-flare-marker="true"]'),
      );

      if (!isMarkerHovered) {
        setHoveredFlare(null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setHoveredFlare(null);
      }
    };

    window.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hoveredFlare]);

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

  const requestAiOverview = useCallback(
    async (flare: FlarePoint, signal?: AbortSignal) => {
      const cached = aiCacheRef.current.get(flare.id);

      if (cached) {
        setAiOverview(cached);
        setAiError(null);
        return;
      }

      setAiLoading(true);
      setAiError(null);

      try {
        const overview = await fetchFlareOverview(
          {
            flare,
            snapshot: {
              satellite: meta?.satellite,
              timestamp: meta?.timestamp,
              totalSites: filteredFlares.length,
              totalHeat,
              filterMode,
            },
          },
          signal,
        );

        aiCacheRef.current.set(flare.id, overview);
        setAiOverview(overview);
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setAiError("AI overview unavailable right now.");
        setAiOverview(null);
      } finally {
        setAiLoading(false);
      }
    },
    [
      filterMode,
      filteredFlares.length,
      meta?.satellite,
      meta?.timestamp,
      totalHeat,
    ],
  );

  useEffect(() => {
    if (aiTimerRef.current) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }

    const activeFlare = hoveredFlare;

    if (!activeFlare) {
      setAiOverview(null);
      setAiError(null);
      return;
    }

    const controller = new AbortController();

    aiTimerRef.current = window.setTimeout(() => {
      void requestAiOverview(activeFlare, controller.signal);
    }, AI_HOVER_DELAY_MS);

    return () => {
      controller.abort();

      if (aiTimerRef.current) {
        window.clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
  }, [hoveredFlare, requestAiOverview]);

  const snapshotValue = useMemo(
    () =>
      filteredFlares.reduce(
        (sum, flare) => sum + flare.metrics.est_value_usd,
        0,
      ),
    [filteredFlares],
  );

  const snapshotCo2 = useMemo(
    () =>
      filteredFlares.reduce((sum, flare) => sum + flare.metrics.co2_tons, 0),
    [filteredFlares],
  );

  const averagePlumeRadius = useMemo(() => {
    if (filteredFlares.length === 0) {
      return 0;
    }

    return (
      filteredFlares.reduce(
        (sum, flare) => sum + flare.impact_analysis.plume_radius_km,
        0,
      ) / filteredFlares.length
    );
  }, [filteredFlares]);

  const dominantRisk = useMemo(() => {
    if (filteredFlares.length === 0) {
      return "LOW";
    }

    return [...filteredFlares].sort((a, b) => {
      const aRank = riskOrder[a.impact_analysis.risk_level.toUpperCase()] ?? 0;
      const bRank = riskOrder[b.impact_analysis.risk_level.toUpperCase()] ?? 0;
      return bRank - aRank;
    })[0]?.impact_analysis.risk_level;
  }, [filteredFlares]);

  const mostAtRiskFlare = useMemo(() => {
    if (filteredFlares.length === 0) {
      return null;
    }

    return [...filteredFlares].sort((a, b) => {
      const aRank = riskOrder[a.impact_analysis.risk_level.toUpperCase()] ?? 0;
      const bRank = riskOrder[b.impact_analysis.risk_level.toUpperCase()] ?? 0;

      if (bRank !== aRank) {
        return bRank - aRank;
      }

      return (
        b.impact_analysis.plume_radius_km - a.impact_analysis.plume_radius_km
      );
    })[0];
  }, [filteredFlares]);

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
      totalHeat < 500 ? "FOCUSED" : totalHeat < 1500 ? "ELEVATED" : "INTENSE";

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
        label: "Value snapshot",
        value: `$${snapshotValue.toFixed(1)}`,
        detail: `${snapshotCo2.toFixed(2)} tons CO2e · ${uniqueBlocks} blocks`,
        accent: "border-[#2D8659] bg-[#0D1F16] text-[#8EF0B0]",
      },
      {
        label: "Impact radius",
        value: `${averagePlumeRadius.toFixed(1)} km`,
        detail: (
          mostAtRiskFlare?.impact_analysis.risk_level ??
          (filterMode === "offshore" ? "Offshore watch" : "Onshore watch")
        ).toString(),
        accent: getRiskAccent(dominantRisk),
      },
    ];
  }, [
    averagePlumeRadius,
    dominantRisk,
    filterMode,
    filteredFlares.length,
    mostAtRiskFlare,
    snapshotCo2,
    snapshotValue,
    totalHeat,
  ]);

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
                className={`border px-3 py-3 transition-all duration-200 cursor-default hover:scale-105 ${signal.accent}`}
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

          <div
            ref={globeContainerRef}
            className="h-130 w-full lg:h-full"
            onMouseLeave={() => setHoveredFlare(null)}
          >
            <Globe
              width={globeSize.width}
              height={globeSize.height}
              globeImageUrl="//unpkg.com/three-globe@2.45.2/example/img/earth-blue-marble.jpg"
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
                marker.style.border = "2px solid rgba(255,107,0,0.6)";
                marker.style.cursor = "pointer";
                marker.style.background =
                  "radial-gradient(circle, rgba(255,107,0,0.92) 0%, rgba(255,107,0,0.18) 65%, rgba(255,107,0,0) 100%)";
                marker.style.boxShadow = "0 0 16px rgba(255,107,0,0.78)";
                marker.style.pointerEvents = "auto";
                marker.style.transition =
                  "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";
                marker.style.position = "relative";
                marker.dataset.flareMarker = "true";

                // Hover effects
                marker.onmouseenter = (e) => {
                  marker.style.transform = "scale(1.3)";
                  marker.style.boxShadow =
                    "0 0 24px rgba(255,107,0,1), inset 0 0 12px rgba(255,107,0,0.4)";
                  marker.style.borderColor = "rgba(255,107,0,0.9)";
                  setHoveredFlare(typedFlare);
                  setTooltipPos({
                    x: (e as MouseEvent).clientX,
                    y: (e as MouseEvent).clientY,
                  });
                };

                marker.onmousemove = (e) => {
                  setTooltipPos({
                    x: (e as MouseEvent).clientX,
                    y: (e as MouseEvent).clientY,
                  });
                };

                marker.onmouseleave = () => {
                  marker.style.transform = "scale(1)";
                  marker.style.boxShadow = "0 0 16px rgba(255,107,0,0.78)";
                  marker.style.borderColor = "rgba(255,107,0,0.6)";
                  setHoveredFlare(null);
                };

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

          {hoveredFlare ? (
            <div
              className="pointer-events-none fixed z-40 animate-in fade-in duration-200"
              style={{
                left: `${tooltipPos.x + 12}px`,
                top: `${tooltipPos.y + 12}px`,
              }}
            >
              <div className="rounded-lg border border-[#FF6B00]/50 bg-[#0A0A0A]/95 backdrop-blur-sm p-3 shadow-lg shadow-[#FF6B00]/20">
                <p
                  className={`${mapSerif.className} text-[16px]/[20px] italic font-bold text-[#FF6B00]`}
                >
                  {hoveredFlare.attribution.block}
                </p>
                <div className="mt-2 space-y-2 text-[11px]/[16px] text-[#E5E5E5]">
                  <p className="text-[#737373]">
                    {hoveredFlare.attribution.operator}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={getRiskBadgeClass(
                        hoveredFlare.impact_analysis.risk_level,
                      )}
                    >
                      {hoveredFlare.impact_analysis.risk_level}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getConfidenceBadgeClass(
                        hoveredFlare.intelligence.confidence,
                      )}
                    >
                      {hoveredFlare.intelligence.confidence}
                    </Badge>
                  </div>
                  <p className="font-semibold text-[#FFB089]">
                    {formatHeat(hoveredFlare.radiant_heat_mscf)} · $
                    {hoveredFlare.metrics.est_value_usd.toFixed(2)}
                  </p>
                  <p className="text-[#A3A3A3]">
                    Plume radius: {hoveredFlare.impact_analysis.plume_radius_km}{" "}
                    km
                  </p>
                  <p className="text-[10px]/[15px] text-[#525252] mt-1">
                    {hoveredFlare.lat.toFixed(3)}, {hoveredFlare.lng.toFixed(3)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {hoveredFlare ? (
            <div
              className="pointer-events-none fixed z-50 w-[320px] animate-in fade-in slide-in-from-right-1 duration-200"
              style={{
                left: `${tooltipPos.x + 220}px`,
                top: `${tooltipPos.y - 6}px`,
              }}
            >
              <Card className="border-[#1F1F1F] bg-[#0A0A0A]/95 text-white shadow-2xl shadow-black/50 backdrop-blur">
                <CardHeader className="px-4 pb-2 pt-3">
                  <CardTitle className="text-[11px]/[16px] uppercase tracking-[1.4px] text-[#FF6B00]">
                    AI Sentinel Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4 text-[11px]/[16px]">
                  {aiLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[#232323]" />
                      <div className="h-3 w-full animate-pulse rounded bg-[#232323]" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[#232323]" />
                    </div>
                  ) : aiOverview ? (
                    <>
                      <p className="break-words text-[#E5E5E5]">
                        {aiOverview.overview}
                      </p>
                      <p className="break-words text-[#A3A3A3]">
                        {aiOverview.why_it_matters}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className="max-w-full h-full! whitespace-normal border-[#FF6B00] bg-[#23160A] text-[#FFB089] break-words"
                        >
                          {aiOverview.risk_summary}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="max-w-full h-full! whitespace-normal border-[#2A5B8A] bg-[#0D1C2C] text-[#9DC7FF] break-words"
                        >
                          {aiOverview.economic_summary}
                        </Badge>
                      </div>
                      <p className="break-words text-[#8EF0B0]">
                        Action: {aiOverview.action}
                      </p>
                    </>
                  ) : (
                    <p className="text-[#737373]">
                      {aiError ?? "Analyzing this flare..."}
                    </p>
                  )}
                </CardContent>
              </Card>
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

          <div className="mt-4 border-2 border-[#FF6B00]/30 bg-gradient-to-br from-[#E8E8E8] to-[#E0E0E0] p-5 text-black transition-all duration-300">
            <div className="flex items-start justify-between">
              <p
                className={`${mapSerif.className} text-[32px]/[36px] italic font-bold`}
              >
                {selectedFlare?.attribution.block ?? "Select a flare"}
              </p>
              <span className="text-[#FF6B00] text-xl">▲</span>
            </div>

            <p className="mt-2 text-[10px]/[15px] tracking-[1px] text-[#737373]">
              SITE ID: {selectedFlare?.id ?? "N/A"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className={
                  selectedFlare
                    ? getRiskBadgeClass(
                        selectedFlare.impact_analysis.risk_level,
                      )
                    : "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]"
                }
              >
                {selectedFlare?.impact_analysis.risk_level ?? "RISK"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  selectedFlare
                    ? getConfidenceBadgeClass(
                        selectedFlare.intelligence.confidence,
                      )
                    : "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]"
                }
              >
                {selectedFlare?.intelligence.confidence ?? "CONFIDENCE"}
              </Badge>
            </div>

            <div className="mt-5 space-y-2 text-[11px]/[16px]">
              <div className="flex items-center justify-between border-b border-[#CECECE] pb-2.5 hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors">
                <p className="text-[#666666] font-medium">OPERATOR</p>
                <p className="font-semibold text-[#333333]">
                  {selectedFlare?.attribution.operator ?? "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#CECECE] pb-2.5 hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors">
                <p className="text-[#666666] font-medium">FLARED NOW</p>
                <p className="font-semibold text-[#FF6B00]">
                  {selectedFlare
                    ? formatHeat(selectedFlare.radiant_heat_mscf)
                    : "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#CECECE] pb-2.5 hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors">
                <p className="text-[#666666] font-medium">TREND</p>
                <p className="font-semibold text-[#333333]">
                  {selectedFlare?.attribution.trend ?? "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#CECECE] pb-2.5 hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors">
                <p className="text-[#666666] font-medium">EST VALUE</p>
                <p className="font-semibold text-[#333333]">
                  {selectedFlare
                    ? `$${selectedFlare.metrics.est_value_usd.toFixed(2)}`
                    : "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between border-b border-[#CECECE] pb-2.5 hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors">
                <p className="text-[#666666] font-medium">CO2 / PLUME</p>
                <p className="font-semibold text-[#333333] text-right">
                  {selectedFlare
                    ? `${selectedFlare.metrics.co2_tons.toFixed(2)} t · ${selectedFlare.impact_analysis.plume_radius_km} km`
                    : "N/A"}
                </p>
              </div>
              <div className="flex items-center justify-between hover:bg-[#F5F5F5]/50 px-2 -mx-2 transition-colors py-2.5">
                <p className="text-[#666666] font-medium">DETECTION</p>
                <p className="font-semibold text-[#333333] text-right">
                  {selectedFlare
                    ? `${selectedFlare.intelligence.detection_time} · ${selectedFlare.lat.toFixed(3)}, ${selectedFlare.lng.toFixed(3)}`
                    : "N/A"}
                </p>
              </div>
            </div>

            {selectedFlare ? (
              <div className="mt-4 rounded-lg border border-[#D3D3D3] bg-[#F3F3F3] p-3">
                <p className="text-[10px]/[15px] uppercase tracking-[1.4px] text-[#7A7A7A]">
                  Impact Notes
                </p>
                <div className="mt-2 space-y-1 text-[11px]/[16px] text-[#333333]">
                  <p>
                    Plume radius:{" "}
                    {selectedFlare.impact_analysis.plume_radius_km} km
                  </p>
                  <p>
                    Health:{" "}
                    {selectedFlare.impact_analysis.health_warnings.join(" · ")}
                  </p>
                  <p>
                    Threatened:{" "}
                    {selectedFlare.impact_analysis.threatened_areas.join(" · ")}
                  </p>
                </div>
              </div>
            ) : null}

            {selectedFlare ? (
              <Button
                asChild
                className="mt-3 w-full rounded-none bg-[#FF6B00] text-black hover:bg-[#FF6B00]/90"
              >
                <Link href={`/live-map/spot/${selectedFlare.id}`}>
                  View prediction
                </Link>
              </Button>
            ) : null}
          </div>

          <p className="mt-6 text-[12px]/[18px] tracking-[2px] text-[#F5F5F5]">
            DATA FILTERS
          </p>

          <label className="mt-4 flex items-center border-2 border-[#2D2D2D] bg-[#0A0A0A] px-3 py-2.5 transition-all duration-200 hover:border-[#FF6B00]/50 focus-within:border-[#FF6B00] focus-within:shadow-lg focus-within:shadow-[#FF6B00]/20">
            <Search size={16} className="text-[#525252]" />
            <input
              className="ml-3 w-full bg-transparent text-[11px]/[16px] text-[#E5E5E5] outline-none placeholder:text-[#525252] transition-colors"
              placeholder="Search sites or operators"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]/[16px] font-semibold">
            <button
              onClick={() => setFilterMode("onshore")}
              className={`rounded-lg border-2 px-3 py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                filterMode === "onshore"
                  ? "border-[#FF6B00] bg-[#FF6B00]/20 text-[#FF6B00] shadow-lg shadow-[#FF6B00]/30"
                  : "border-[#2D2D2D] bg-[#0A0A0A] text-[#737373] hover:border-[#3E3E3E] hover:text-[#A3A3A3]"
              }`}
            >
              ONSHORE
            </button>
            <button
              onClick={() => setFilterMode("offshore")}
              className={`rounded-lg border-2 px-3 py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                filterMode === "offshore"
                  ? "border-[#FF6B00] bg-[#FF6B00]/20 text-[#FF6B00] shadow-lg shadow-[#FF6B00]/30"
                  : "border-[#2D2D2D] bg-[#0A0A0A] text-[#737373] hover:border-[#3E3E3E] hover:text-[#A3A3A3]"
              }`}
            >
              OFFSHORE
            </button>
          </div>

          <div className="mt-6 border-t border-[#232323] pt-4">
            <p className="text-[10px]/[15px] tracking-[1.5px] text-[#737373]">
              TOP 5 FLARES ({filterMode})
            </p>

            <div className="mt-4 space-y-3">
              {topFiveFlares.map((flare) => (
                <button
                  key={flare.id}
                  type="button"
                  onClick={() => setSelectedFlare(flare)}
                  className={`w-full border-l-4 px-3 py-3 text-left transition-all duration-200 ${
                    selectedFlare?.id === flare.id
                      ? "border-l-[#FF6B00] bg-[#FF6B00]/10"
                      : "border-l-[#2D2D2D] hover:border-l-[#FF6B00]/60 hover:bg-[#0F0F0F]"
                  }`}
                >
                  <p
                    className={`${mapSerif.className} text-[24px]/[28px] italic font-bold text-white`}
                  >
                    {flare.attribution.block}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
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

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Activity,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchFlareOverview,
  fetchLiveTelemetry,
  type FlareOverviewResponse,
  type FlarePoint,
  type TelemetryMeta,
} from "@/services/flare.service";

const pageSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const pageSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const formatHeat = (value: number) => `${value.toFixed(1)} mscf`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

const parseTrend = (trend: string) => {
  const parsed = Number.parseFloat(trend.replace(/%/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getForecastLabel = (score: number) => {
  if (score >= 75) return "Critical watch";
  if (score >= 55) return "Worsening";
  if (score >= 35) return "Watch";
  return "Stable";
};

const getForecastTone = (label: string) => {
  switch (label) {
    case "Critical watch":
      return "border-[#D64545] bg-[#2C1515] text-[#FF9999]";
    case "Worsening":
      return "border-[#FF6B00] bg-[#23160A] text-[#FFB089]";
    case "Watch":
      return "border-[#9C6B2F] bg-[#21170D] text-[#F2C27B]";
    default:
      return "border-[#2D8659] bg-[#0D1F16] text-[#8EF0B0]";
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

const SpotPredictionPage = () => {
  const params = useParams<{ id: string }>();
  const flareId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [meta, setMeta] = useState<TelemetryMeta | null>(null);
  const [flare, setFlare] = useState<FlarePoint | null>(null);
  const [aiOverview, setAiOverview] = useState<FlareOverviewResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadSpot = useCallback(async () => {
    try {
      const payload = await fetchLiveTelemetry();
      setMeta(payload.meta);

      const foundFlare =
        payload.telemetry.find((item) => item.id === flareId) ?? null;
      setFlare(foundFlare);

      if (!foundFlare) {
        setError(
          "Could not find that flare in the current telemetry snapshot.",
        );
      } else {
        setError(null);
      }
    } catch {
      setError("Unable to load flare data right now.");
    } finally {
      setIsLoading(false);
    }
  }, [flareId]);

  const requestAiOverview = useCallback(
    async (activeFlare: FlarePoint) => {
      setAiLoading(true);
      setAiError(null);

      try {
        const overview = await fetchFlareOverview({
          flare: activeFlare,
          snapshot: {
            satellite: meta?.satellite,
            timestamp: meta?.timestamp,
          },
        });

        setAiOverview(overview);
      } catch {
        setAiError("AI overview unavailable right now.");
        setAiOverview(null);
      } finally {
        setAiLoading(false);
      }
    },
    [meta?.satellite, meta?.timestamp],
  );

  useEffect(() => {
    void loadSpot();
  }, [loadSpot]);

  useEffect(() => {
    if (!flare) {
      setAiOverview(null);
      return;
    }

    void requestAiOverview(flare);
  }, [flare, requestAiOverview]);

  const forecast = useMemo(() => {
    if (!flare) {
      return null;
    }

    const trendValue = parseTrend(flare.attribution.trend);
    const warningCount = flare.impact_analysis.health_warnings.length;
    const threatenedCount = flare.impact_analysis.threatened_areas.length;
    const confidence = flare.intelligence.confidence.toLowerCase();

    const escalationProbability = clamp(
      Math.round(
        22 +
          flare.radiant_heat_mscf * 0.35 +
          flare.impact_analysis.plume_radius_km * 1.7 +
          warningCount * 7 +
          threatenedCount * 5 +
          Math.max(0, trendValue) * 3 -
          (confidence === "high" ? 12 : confidence === "nominal" ? 6 : 0),
      ),
      5,
      95,
    );

    const priorityScore = clamp(
      Math.round(
        (flare.impact_analysis.risk_level.toUpperCase() === "CRITICAL"
          ? 32
          : flare.impact_analysis.risk_level.toUpperCase() === "HIGH"
            ? 24
            : flare.impact_analysis.risk_level.toUpperCase() === "MODERATE"
              ? 16
              : 8) +
          flare.radiant_heat_mscf * 0.28 +
          flare.impact_analysis.plume_radius_km * 2.2 +
          warningCount * 6 +
          threatenedCount * 4 +
          Math.abs(trendValue) * 1.5,
      ),
      0,
      100,
    );

    const projectedLoss7d =
      flare.metrics.est_value_usd * 7 * (1 + escalationProbability / 180);
    const projectedLoss30d =
      flare.metrics.est_value_usd * 30 * (1 + escalationProbability / 140);

    return {
      escalationProbability,
      priorityScore,
      projectedLoss7d,
      projectedLoss30d,
      label: getForecastLabel(escalationProbability),
    };
  }, [flare]);

  if (isLoading) {
    return (
      <div
        className={`${pageSans.className} min-h-screen bg-[#0A0A0A] px-6 py-10 text-white`}
      >
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-6 w-40 rounded bg-[#232323]" />
          <div className="h-16 w-3/5 rounded bg-[#1A1A1A]" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-xl bg-[#121212]" />
            <div className="h-48 rounded-xl bg-[#121212]" />
          </div>
        </div>
      </div>
    );
  }

  if (!flare) {
    return (
      <div
        className={`${pageSans.className} min-h-screen bg-[#0A0A0A] px-6 py-10 text-white`}
      >
        <div className="mx-auto max-w-4xl">
          <Button
            asChild
            variant="outline"
            className="mb-6 border-[#2D2D2D] bg-[#0A0A0A] text-white hover:bg-[#121212]"
          >
            <Link href="/live-map">
              <ArrowLeft className="size-4" />
              Back to map
            </Link>
          </Button>
          <div className="rounded-2xl border border-[#2D2D2D] bg-[#121212] p-8">
            <p className="text-[12px]/[18px] uppercase tracking-[2px] text-[#737373]">
              Spot not found
            </p>
            <h1
              className={`${pageSerif.className} mt-3 text-[42px]/[46px] italic`}
            >
              This flare is not in the current snapshot
            </h1>
            <p className="mt-4 max-w-2xl text-[#A3A3A3]">
              The telemetry snapshot may have refreshed. Go back to the map and
              click a current flare point to open its prediction page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const forecastTone = getForecastTone(forecast?.label ?? "Stable");

  return (
    <div
      className={`${pageSans.className} min-h-screen bg-[#0A0A0A] px-4 py-6 text-white md:px-8`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Button
            asChild
            variant="outline"
            className="border-[#2D2D2D] bg-[#0A0A0A] text-white hover:bg-[#121212]"
          >
            <Link href="/live-map">
              <ArrowLeft className="size-4" />
              Back to map
            </Link>
          </Button>
          <Badge
            variant="outline"
            className="border-[#FF6B00] bg-[#23160A] text-[#FFB089]"
          >
            Spot prediction
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[#2D2D2D] bg-[linear-gradient(180deg,#191919_0%,#0A0A0A_100%)] p-6 md:p-8">
              <p className="text-[11px]/[16px] uppercase tracking-[2px] text-[#A3A3A3]">
                Per-flare forecast
              </p>
              <h1
                className={`${pageSerif.className} mt-3 text-[44px]/[48px] italic md:text-[58px]/[60px]`}
              >
                {flare.attribution.block}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={getRiskBadgeClass(
                    flare.impact_analysis.risk_level,
                  )}
                >
                  {flare.impact_analysis.risk_level} risk
                </Badge>
                <Badge
                  variant="outline"
                  className={getConfidenceBadgeClass(
                    flare.intelligence.confidence,
                  )}
                >
                  {flare.intelligence.confidence} confidence
                </Badge>
                <Badge
                  variant="outline"
                  className="border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]"
                >
                  {meta?.satellite ?? "Live telemetry"}
                </Badge>
              </div>
              <p className="mt-5 max-w-3xl text-[14px]/[22px] text-[#A3A3A3]">
                {flare.attribution.operator} is currently reporting{" "}
                {formatHeat(flare.radiant_heat_mscf)} with an estimated value of{" "}
                {formatCurrency(flare.metrics.est_value_usd)} and{" "}
                {formatNumber(flare.metrics.co2_tons)} tons CO2.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-[11px]/[16px] uppercase tracking-[1.4px] text-[#737373]">
                    <Activity className="size-4 text-[#FF6B00]" />
                    Escalation
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-[34px]/[36px] font-bold text-[#FFB089]">
                    {forecast?.escalationProbability ?? 0}%
                  </p>
                  <p className="mt-1 text-[11px]/[16px] text-[#737373]">
                    Chance this site worsens in the next 24h.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-[11px]/[16px] uppercase tracking-[1.4px] text-[#737373]">
                    <ShieldAlert className="size-4 text-[#9DC7FF]" />
                    Priority
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-[34px]/[36px] font-bold text-[#9DC7FF]">
                    {forecast?.priorityScore ?? 0}/100
                  </p>
                  <p className="mt-1 text-[11px]/[16px] text-[#737373]">
                    How urgently this flare should be reviewed.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-[11px]/[16px] uppercase tracking-[1.4px] text-[#737373]">
                    <Sparkles className="size-4 text-[#8EF0B0]" />
                    7d loss
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-[30px]/[36px] font-bold text-[#8EF0B0]">
                    {formatCurrency(forecast?.projectedLoss7d ?? 0)}
                  </p>
                  <p className="mt-1 text-[11px]/[16px] text-[#737373]">
                    Projected waste if current behavior holds.
                  </p>
                </CardContent>
              </Card>

              <Card className={`border ${forecastTone} text-white`}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="flex items-center gap-2 text-[11px]/[16px] uppercase tracking-[1.4px] opacity-75">
                    <Clock3 className="size-4" />
                    Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-[28px]/[34px] font-bold">
                    {forecast?.label ?? "Stable"}
                  </p>
                  <p className="mt-1 text-[11px]/[16px] opacity-75">
                    Prediction label based on risk, plume, heat, and trend.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
              <CardHeader>
                <CardTitle className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#FF6B00]">
                  AI Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-[14px]/[22px] text-[#E5E5E5]">
                {aiLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[#232323]" />
                    <div className="h-4 w-full animate-pulse rounded bg-[#232323]" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#232323]" />
                  </div>
                ) : aiOverview ? (
                  <>
                    <p>{aiOverview.overview}</p>
                    <p className="text-[#A3A3A3]">
                      {aiOverview.why_it_matters}
                    </p>
                    <p className="text-[#8EF0B0]">
                      Action: {aiOverview.action}
                    </p>
                  </>
                ) : (
                  <p className="text-[#737373]">
                    {aiError ?? "AI summary not available."}
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
              <CardHeader>
                <CardTitle className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#FFB089]">
                  Live impact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px]/[20px] text-[#E5E5E5]">
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">Detection time</span>
                  <span>{flare.intelligence.detection_time}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">Plume radius</span>
                  <span>{flare.impact_analysis.plume_radius_km} km</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">CO2</span>
                  <span>{formatNumber(flare.metrics.co2_tons)} tons</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">Trend</span>
                  <span>{flare.attribution.trend}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#737373]">Coordinates</span>
                  <span>
                    {flare.lat.toFixed(3)}, {flare.lng.toFixed(3)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
              <CardHeader>
                <CardTitle className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#FFB089]">
                  Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-[13px]/[20px] text-[#E5E5E5]">
                <div>
                  <p className="text-[11px]/[16px] uppercase tracking-[1.2px] text-[#737373]">
                    Health
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {flare.impact_analysis.health_warnings.map((warning) => (
                      <Badge
                        key={warning}
                        variant="outline"
                        className="max-w-full whitespace-normal border-[#D64545] bg-[#2C1515] text-[#FF9999] break-words"
                      >
                        {warning}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px]/[16px] uppercase tracking-[1.2px] text-[#737373]">
                    Threatened areas
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {flare.impact_analysis.threatened_areas.map((area) => (
                      <Badge
                        key={area}
                        variant="outline"
                        className="max-w-full whitespace-normal border-[#2A5B8A] bg-[#0D1C2C] text-[#9DC7FF] break-words"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#2D2D2D] bg-[#0F0F0F] text-white">
              <CardHeader>
                <CardTitle className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#8EF0B0]">
                  Projected loss
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px]/[20px] text-[#E5E5E5]">
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">7 days</span>
                  <span>{formatCurrency(forecast?.projectedLoss7d ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#232323] pb-2">
                  <span className="text-[#737373]">30 days</span>
                  <span>{formatCurrency(forecast?.projectedLoss30d ?? 0)}</span>
                </div>
                <p className="text-[11px]/[16px] text-[#737373]">
                  This is a local modelled estimate using the current flare
                  metrics and trend, not a historical forecast.
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                asChild
                className="flex-1 rounded-none bg-[#FF6B00] text-black hover:bg-[#FF6B00]/90"
              >
                <Link href="/live-map">Back to map</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="flex-1 rounded-none border-[#2D2D2D] bg-[#0A0A0A] text-white hover:bg-[#121212]"
              >
                <Link href={`/live-map#${flare.id}`}>Open spot on map</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SpotPredictionPage;

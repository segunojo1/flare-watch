"use client";

import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  fetchLiveTelemetry,
  type FlarePoint,
  type TelemetryMeta,
} from "@/services/flare.service";

const mapSans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mapSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

// Base constants for calculations
const MSCF_TO_TONS_METHANE = 0.422; // 1 MSCF gas ≈ 0.422 tons of methane equivalent
const GAS_PRICE_PER_MSCF = 4.5; // USD per thousand standard cubic feet
const LOSS_PER_DAY = 1.05e9 / 365; // Annual loss of $1.05B distributed daily
const CO2_PER_TON_METHANE = 28; // CO2 equivalence factor (GWP over 100 years)

const riskRank: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
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

const Calculator = () => {
  const [meta, setMeta] = useState<TelemetryMeta | null>(null);
  const [flares, setFlares] = useState<FlarePoint[]>([]);
  const [captureRate, setCaptureRate] = useState(65); // 0-100% capture efficiency
  const [utilizationRate, setUtilizationRate] = useState(75); // 0-100% utilization of captured gas
  const [isLoading, setIsLoading] = useState(true);

  const loadTelemetry = useCallback(async (signal?: AbortSignal) => {
    try {
      const payload = await fetchLiveTelemetry(signal);
      setMeta(payload.meta);
      setFlares(payload.telemetry);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Failed to load telemetry:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    void loadTelemetry(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [loadTelemetry]);

  const totalFlaringVolume = useMemo(
    () => flares.reduce((sum, flare) => sum + flare.radiant_heat_mscf, 0),
    [flares],
  );

  const liveSnapshotValue = useMemo(
    () => flares.reduce((sum, flare) => sum + flare.metrics.est_value_usd, 0),
    [flares],
  );

  const liveSnapshotCo2 = useMemo(
    () => flares.reduce((sum, flare) => sum + flare.metrics.co2_tons, 0),
    [flares],
  );

  const worstRiskFlare = useMemo(() => {
    if (flares.length === 0) {
      return null;
    }

    return [...flares].sort((a, b) => {
      const aRank = riskRank[a.impact_analysis.risk_level.toUpperCase()] ?? 0;
      const bRank = riskRank[b.impact_analysis.risk_level.toUpperCase()] ?? 0;

      if (bRank !== aRank) {
        return bRank - aRank;
      }

      return (
        b.impact_analysis.plume_radius_km - a.impact_analysis.plume_radius_km
      );
    })[0];
  }, [flares]);

  const averagePlumeRadius = useMemo(() => {
    if (flares.length === 0) {
      return 0;
    }

    return (
      flares.reduce(
        (sum, flare) => sum + flare.impact_analysis.plume_radius_km,
        0,
      ) / flares.length
    );
  }, [flares]);

  // Scenario calculations
  const scenario = useMemo(() => {
    const dailyFlaring = totalFlaringVolume;
    const capturedVolume = (dailyFlaring * captureRate) / 100;
    const utilizedVolume = (capturedVolume * utilizationRate) / 100;

    const methaneTons = dailyFlaring * MSCF_TO_TONS_METHANE;
    const capturedMethaneTons = capturedVolume * MSCF_TO_TONS_METHANE;
    const utilizableMethaneTons = utilizedVolume * MSCF_TO_TONS_METHANE;

    const dailyLoss = dailyFlaring * GAS_PRICE_PER_MSCF;
    const recoveredValue = utilizedVolume * GAS_PRICE_PER_MSCF;
    const averageDailyLoss = LOSS_PER_DAY;

    const co2Equivalent = methaneTons * CO2_PER_TON_METHANE;
    const co2Prevented = capturedMethaneTons * CO2_PER_TON_METHANE;

    return {
      dailyFlaring,
      capturedVolume,
      utilizedVolume,
      methaneTons,
      capturedMethaneTons,
      utilizableMethaneTons,
      dailyLoss,
      recoveredValue,
      averageDailyLoss,
      co2Equivalent,
      co2Prevented,
    };
  }, [totalFlaringVolume, captureRate, utilizationRate]);

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number) => {
    return `$${formatNumber(num)} USD`;
  };

  return (
    <div
      className={`${mapSans.className} min-h-screen w-full bg-[#0A0A0A] px-3 pb-12 md:px-8`}
    >
      <div className="mx-auto max-w-7xl py-8">
        {/* Hero Section */}
        <div className="mb-12 border border-[#2D2D2D] bg-linear-to-b from-[#1A1A1A] to-[#0A0A0A] p-8">
          <p className="text-[12px]/[18px] uppercase tracking-[2px] text-[#A3A3A3]">
            ECONOMIC RECOVERY SCENARIO
          </p>
          <h1
            className={`${mapSerif.className} mt-3 text-[48px]/[56px] italic text-white`}
          >
            What if we captured this gas?
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-[#2D8659] bg-[#0D1F16] text-[#8EF0B0]"
            >
              Snapshot value: ${formatNumber(liveSnapshotValue)}
            </Badge>
            <Badge
              variant="outline"
              className="border-[#2A5B8A] bg-[#0D1C2C] text-[#9DC7FF]"
            >
              Snapshot CO2: {liveSnapshotCo2.toFixed(2)} t
            </Badge>
            <Badge
              variant="outline"
              className={
                worstRiskFlare
                  ? getRiskBadgeClass(worstRiskFlare.impact_analysis.risk_level)
                  : "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]"
              }
            >
              {worstRiskFlare?.impact_analysis.risk_level ?? "LOW"} risk
            </Badge>
          </div>
          <p className="mt-4 max-w-2xl text-[14px]/[21px] text-[#737373]">
            Nigeria burns {formatNumber(scenario.methaneTons)} tons of methane
            daily in this snapshot. Adjust the capture and utilization rates
            below to model how much value and emissions could be recovered from
            the current flare field.
          </p>
          <p className="mt-2 text-[11px]/[16px] text-[#525252]">
            Source: {meta?.satellite ?? "NASA FIRMS"} ·{" "}
            {meta?.timestamp
              ? new Date(meta.timestamp).toLocaleString()
              : "live"}
          </p>
        </div>

        {/* Controls Section */}
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Capture Rate Slider */}
          <div className="border border-[#2D2D2D] bg-[#0A0A0A] p-6">
            <div className="flex items-center justify-between">
              <label className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#F5F5F5]">
                Capture Efficiency
              </label>
              <span className="text-[24px]/[32px] font-bold text-[#FF6B00]">
                {captureRate}%
              </span>
            </div>
            <div className="mt-6">
              <Slider
                value={[captureRate]}
                onValueChange={(value) => setCaptureRate(value[0])}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <p className="mt-4 text-[11px]/[16px] text-[#525252]">
              How much of the daily flaring volume can be technically captured
              and processed.
            </p>
          </div>

          {/* Utilization Rate Slider */}
          <div className="border border-[#2D2D2D] bg-[#0A0A0A] p-6">
            <div className="flex items-center justify-between">
              <label className="text-[12px]/[18px] uppercase tracking-[1.5px] text-[#F5F5F5]">
                Utilization Target
              </label>
              <span className="text-[24px]/[32px] font-bold text-[#FF6B00]">
                {utilizationRate}%
              </span>
            </div>
            <div className="mt-6">
              <Slider
                value={[utilizationRate]}
                onValueChange={(value) => setUtilizationRate(value[0])}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <p className="mt-4 text-[11px]/[16px] text-[#525252]">
              What percentage of captured gas is successfully converted to
              energy or products.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Current Daily Flaring */}
          <div className="border border-[#2D2D2D] bg-[#0A0A0A] p-6">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#737373]">
              Current Daily Flaring
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[32px]/[40px] italic font-bold`}
            >
              {formatNumber(scenario.dailyFlaring)}
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#525252]">
              MSCF (1000 cu ft)
            </p>
          </div>

          {/* Captured Volume */}
          <div className="border border-[#FF6B00] bg-[#FF6B00]/5 p-6">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#FFB089]">
              Capturable Volume
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[32px]/[40px] italic font-bold text-[#FF6B00]`}
            >
              {formatNumber(scenario.capturedVolume)}
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#FFB089]">
              MSCF @ {captureRate}%
            </p>
          </div>

          {/* Methane Equivalent */}
          <div className="border border-[#2A5B8A] bg-[#0D1C2C] p-6">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#9DC7FF]">
              Methane Equivalent (Daily)
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[32px]/[40px] italic font-bold text-[#9DC7FF]`}
            >
              {formatNumber(scenario.methaneTons)}
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#9DC7FF]">Tons CH₄</p>
          </div>

          {/* Economic Loss */}
          <div className="border border-[#D64545] bg-[#2C1515] p-6">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#FF9999]">
              Daily Economic Loss
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[28px]/[36px] italic font-bold text-[#FF9999]`}
            >
              {formatCurrency(scenario.dailyLoss)}
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#FF9999]">
              Gas at market price
            </p>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="border border-[#2D8659] bg-[#0D1F16] p-5">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#8EF0B0]">
              Live Snapshot Value
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[28px]/[36px] italic font-bold text-[#8EF0B0]`}
            >
              ${formatNumber(liveSnapshotValue)}
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#8EF0B0]/75">
              Sum of per-flare estimated value across the current filter.
            </p>
          </div>

          <div className="border border-[#2A5B8A] bg-[#0D1C2C] p-5">
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] text-[#9DC7FF]">
              Live Snapshot CO2
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[28px]/[36px] italic font-bold text-[#9DC7FF]`}
            >
              {liveSnapshotCo2.toFixed(2)} t
            </p>
            <p className="mt-2 text-[10px]/[15px] text-[#9DC7FF]/75">
              Estimated carbon footprint from the current filtered flare set.
            </p>
          </div>

          <div
            className={`border p-5 ${worstRiskFlare ? getRiskBadgeClass(worstRiskFlare.impact_analysis.risk_level) : "border-[#3E3E3E] bg-[#121212] text-[#E5E5E5]"}`}
          >
            <p className="text-[10px]/[15px] uppercase tracking-[1.5px] opacity-75">
              Highest Risk Site
            </p>
            <p
              className={`${mapSerif.className} mt-2 text-[28px]/[36px] italic font-bold`}
            >
              {worstRiskFlare?.attribution.block ?? "N/A"}
            </p>
            <p className="mt-2 text-[10px]/[15px] opacity-75">
              {worstRiskFlare
                ? `${worstRiskFlare.impact_analysis.risk_level} · ${worstRiskFlare.impact_analysis.plume_radius_km} km plume`
                : "No active flare"}
            </p>
          </div>
        </div>

        {/* Impact Scenarios */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Scenario A: Revenue Recovery */}
          <div className="border border-[#2D8659] bg-[#0D1F16] p-6">
            <p className="text-[11px]/[16px] uppercase tracking-[1.5px] text-[#52D77F]">
              Annual Revenue Recovery
            </p>
            <p
              className={`${mapSerif.className} mt-3 text-[36px]/[44px] italic font-bold text-[#52D77F]`}
            >
              {formatCurrency(scenario.recoveredValue * 365)}
            </p>
            <div className="mt-4 space-y-2 text-[11px]/[16px] text-[#52D77F]/75">
              <p>
                • Recovered: {formatNumber(scenario.utilizedVolume)} MSCF/day
              </p>
              <p>• Price: {GAS_PRICE_PER_MSCF.toFixed(2)}/MSCF</p>
            </div>
          </div>

          {/* Scenario B: CO2 Reduction */}
          <div className="border border-[#2A5B8A] bg-[#0D1C2C] p-6">
            <p className="text-[11px]/[16px] uppercase tracking-[1.5px] text-[#9DC7FF]">
              Annual CO₂-Eq Prevented
            </p>
            <p
              className={`${mapSerif.className} mt-3 text-[36px]/[44px] italic font-bold text-[#9DC7FF]`}
            >
              {formatNumber(scenario.co2Prevented * 365)}
            </p>
            <div className="mt-4 space-y-2 text-[11px]/[16px] text-[#9DC7FF]/75">
              <p>
                • Prevented: {((scenario.co2Prevented * 365) / 1e6).toFixed(1)}M
                tons CO₂e
              </p>
              <p>
                • Current Total: {formatNumber(scenario.co2Equivalent * 365)}
              </p>
            </div>
          </div>

          {/* Scenario C: Actual Loss Context */}
          <div className="border border-[#8A5B2A] bg-[#2C1810] p-6">
            <p className="text-[11px]/[16px] uppercase tracking-[1.5px] text-[#FFB89B]">
              Annual Production Loss
            </p>
            <p
              className={`${mapSerif.className} mt-3 text-[32px]/[40px] italic font-bold text-[#FFB89B]`}
            >
              {formatCurrency(scenario.dailyLoss * 365)}
            </p>
            <div className="mt-4 space-y-2 text-[11px]/[16px] text-[#FFB89B]/75">
              <p>• Industry standard baseline: $1.05B/year</p>
              <p>• This extrapolates live capture data</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 border border-[#232323] bg-[#0F0F0F] p-6">
          <p className="text-[11px]/[16px] text-[#525252]">
            💡 These calculations are based on live NASA FIRMS satellite data
            and industry benchmarks. Adjusting the sliders models different
            technological and operational scenarios. Capture efficiency factors
            in infrastructure constraints, while utilization rate models energy
            conversion efficiency.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Calculator;

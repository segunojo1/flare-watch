import axios from "axios";

const TELEMETRY_ENDPOINT =
  "https://flarewatcher.onrender.com/api/v1/telemetry/live";

export interface TelemetryMeta {
  satellite: string;
  timestamp: string;
  dataset?: string;
  region?: string;
}

export interface FlareAttribution {
  block: string;
  operator: string;
  trend: string;
}

export interface FlareMetrics {
  est_value_usd: number;
  co2_tons: number;
}

export interface FlareIntelligence {
  confidence: string;
  detection_time: string;
}

export interface FlareImpactAnalysis {
  plume_radius_km: number;
  risk_level: string;
  health_warnings: string[];
  threatened_areas: string[];
}

export interface FlarePoint {
  id: string;
  lat: number;
  lng: number;
  radiant_heat_mscf: number;
  attribution: FlareAttribution;
  metrics: FlareMetrics;
  intelligence: FlareIntelligence;
  impact_analysis: FlareImpactAnalysis;
}

export interface TelemetryResponse {
  meta: TelemetryMeta;
  telemetry: FlarePoint[];
}

export interface FlareOverviewRequest {
  flare: FlarePoint;
  snapshot?: {
    satellite?: string;
    timestamp?: string;
    totalSites?: number;
    totalHeat?: number;
    filterMode?: "onshore" | "offshore";
  };
}

export interface FlareOverviewResponse {
  overview: string;
  why_it_matters: string;
  action: string;
  risk_summary: string;
  economic_summary: string;
  health_summary: string;
}

const isValidTelemetryResponse = (
  payload: unknown,
): payload is TelemetryResponse => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<TelemetryResponse>;

  if (
    !candidate.meta ||
    !candidate.telemetry ||
    !Array.isArray(candidate.telemetry)
  ) {
    return false;
  }

  if (
    typeof candidate.meta.satellite !== "string" ||
    typeof candidate.meta.timestamp !== "string"
  ) {
    return false;
  }

  return candidate.telemetry.every((flare) => {
    if (!flare || typeof flare !== "object") {
      return false;
    }

    const typedFlare = flare as Partial<FlarePoint>;
    return (
      typeof typedFlare.id === "string" &&
      typeof typedFlare.lat === "number" &&
      typeof typedFlare.lng === "number" &&
      typeof typedFlare.radiant_heat_mscf === "number" &&
      !!typedFlare.attribution &&
      typeof typedFlare.attribution.block === "string" &&
      typeof typedFlare.attribution.operator === "string" &&
      typeof typedFlare.metrics === "object" &&
      !!typedFlare.metrics &&
      typeof typedFlare.metrics.est_value_usd === "number" &&
      typeof typedFlare.metrics.co2_tons === "number" &&
      typeof typedFlare.intelligence === "object" &&
      !!typedFlare.intelligence &&
      typeof typedFlare.intelligence.confidence === "string" &&
      typeof typedFlare.intelligence.detection_time === "string" &&
      typeof typedFlare.impact_analysis === "object" &&
      !!typedFlare.impact_analysis &&
      typeof typedFlare.impact_analysis.plume_radius_km === "number" &&
      typeof typedFlare.impact_analysis.risk_level === "string" &&
      Array.isArray(typedFlare.impact_analysis.health_warnings) &&
      Array.isArray(typedFlare.impact_analysis.threatened_areas)
    );
  });
};

export const fetchLiveTelemetry = async (
  signal?: AbortSignal,
): Promise<TelemetryResponse> => {
  const response = await axios.get<unknown>(TELEMETRY_ENDPOINT, {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  const json = response.data;

  if (!isValidTelemetryResponse(json)) {
    throw new Error("Telemetry response format is invalid");
  }

  return {
    ...json,
    telemetry: json.telemetry.map((flare) => ({
      ...flare,
      attribution: {
        block: flare.attribution.block,
        operator: flare.attribution.operator,
        trend: flare.attribution.trend ?? "N/A",
      },
      metrics: flare.metrics,
      intelligence: flare.intelligence,
      impact_analysis: flare.impact_analysis,
    })),
  };
};

export const fetchFlareOverview = async (
  payload: FlareOverviewRequest,
  signal?: AbortSignal,
): Promise<FlareOverviewResponse> => {
  const response = await axios.post<Partial<FlareOverviewResponse>>(
    "/api/ai/flare-overview",
    payload,
    {
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    },
  );

  const json = response.data;

  if (
    typeof json.overview !== "string" ||
    typeof json.why_it_matters !== "string" ||
    typeof json.action !== "string" ||
    typeof json.risk_summary !== "string" ||
    typeof json.economic_summary !== "string" ||
    typeof json.health_summary !== "string"
  ) {
    throw new Error("AI overview response format is invalid");
  }

  return json as FlareOverviewResponse;
};

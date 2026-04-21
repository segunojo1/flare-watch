const TELEMETRY_ENDPOINT = "https://flarewatcher.onrender.com/api/v1/telemetry/live"

export interface TelemetryMeta {
  satellite: string;
  dataset: string;
  timestamp: string;
  region: string;
}

export interface FlareAttribution {
  block: string;
  operator: string;
  trend: string;
}

export interface FlarePoint {
  id: string;
  lat: number;
  lng: number;
  radiant_heat_mscf: number;
  attribution: FlareAttribution;
}

export interface TelemetryResponse {
  meta: TelemetryMeta;
  telemetry: FlarePoint[];
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
      typeof typedFlare.attribution.operator === "string"
    );
  });
};

export const fetchLiveTelemetry = async (
  signal?: AbortSignal,
): Promise<TelemetryResponse> => {
  const response = await fetch(TELEMETRY_ENDPOINT, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Telemetry request failed with status ${response.status}`);
  }

  const json = (await response.json()) as unknown;

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
    })),
  };
};

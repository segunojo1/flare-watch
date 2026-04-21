import type {
  FlareOverviewRequest,
  FlareOverviewResponse,
} from "@/services/flare.service";
import axios from "axios";
export const runtime = "nodejs";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const buildFallbackOverview = (
  payload: FlareOverviewRequest,
): FlareOverviewResponse => {
  const flare = payload.flare;
  const riskLevel = flare.impact_analysis.risk_level;
  const plumeRadius = flare.impact_analysis.plume_radius_km;
  const warnings = flare.impact_analysis.health_warnings.join(", ");
  const value = flare.metrics.est_value_usd.toFixed(2);
  const co2 = flare.metrics.co2_tons.toFixed(2);

  return {
    overview: `${flare.attribution.block} is a ${riskLevel.toLowerCase()}-risk flare from ${flare.attribution.operator}. It is emitting ${flare.radiant_heat_mscf.toFixed(1)} MSCF with an estimated value of $${value}.`,
    why_it_matters: `The plume is about ${plumeRadius} km wide and the main local concerns are ${warnings || "air-quality and ecosystem exposure"}.`,
    action:
      "Use this site as a priority follow-up point in the sidebar and compare it against nearby flares in the same basin.",
    risk_summary: `${riskLevel} risk, plume radius ${plumeRadius} km, trend ${flare.attribution.trend}.`,
    economic_summary: `Estimated value: $${value}, CO2: ${co2} tons, operator: ${flare.attribution.operator}.`,
    health_summary: flare.impact_analysis.health_warnings.length
      ? flare.impact_analysis.health_warnings.join(" · ")
      : "No specific health warnings reported.",
  };
};

export async function POST(request: Request) {
  let payload: FlareOverviewRequest;

  try {
    payload = (await request.json()) as FlareOverviewRequest;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!payload?.flare?.id) {
    return Response.json({ error: "Missing flare payload" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(buildFallbackOverview(payload));
  }

  const prompt = [
    "You are summarizing gas flare telemetry for a dashboard.",
    "Keep the response short, concrete, and specific to the supplied flare.",
    "Return JSON with these keys only: overview, why_it_matters, action, risk_summary, economic_summary, health_summary.",
    "Use 1-2 sentences for overview and short phrases elsewhere.",
    "Do not mention policy or disclaimers.",
    "",
    `FLARE DATA: ${JSON.stringify(payload.flare)}`,
    `SNAPSHOT CONTEXT: ${JSON.stringify(payload.snapshot ?? {})}`,
  ].join("\n");

  try {
    const response = await axios.post<{
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    }>(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "You generate tight, UI-ready summaries for flare telemetry.",
                  prompt,
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              overview: { type: "STRING" },
              why_it_matters: { type: "STRING" },
              action: { type: "STRING" },
              risk_summary: { type: "STRING" },
              economic_summary: { type: "STRING" },
              health_summary: { type: "STRING" },
            },
            required: [
              "overview",
              "why_it_matters",
              "action",
              "risk_summary",
              "economic_summary",
              "health_summary",
            ],
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = response.data;

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawText) {
      return Response.json(buildFallbackOverview(payload));
    }

    const parsed = JSON.parse(rawText) as FlareOverviewResponse;

    return Response.json(parsed);
  } catch {
    return Response.json(buildFallbackOverview(payload));
  }
}

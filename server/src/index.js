import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { performance } from "node:perf_hooks";

import { generateImage, GeminiError } from "./gemini.js";
import {
  applyFreeformOverrides,
  buildCompositePrompt,
  buildGarmentReferencePrompt,
  buildMultiAnglePrompt,
  buildPrintApplicationPrompt,
  buildRetryCompositePrompt,
  generateFinalPrompt,
  planLookFromGarment,
} from "./pipeline.js";
import { createStorageClient } from "./storage.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3001);
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

const app = express();
app.use(express.json({ limit: "50mb" }));

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : "*" }));

const storage = await createStorageClient();

function ensureGeminiKey() {
  if (!GEMINI_API_KEY) {
    const err = new Error("Gemini API key not configured.");
    err.status = 500;
    throw err;
  }
}

function parseDataUrl(dataUrl) {
  const trimmed = (dataUrl || "").trim();
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    const err = new Error("Invalid data URL (expected base64-encoded image).");
    err.status = 400;
    throw err;
  }
  const mimeType = match[1].trim().toLowerCase() || "application/octet-stream";
  const buffer = Buffer.from(match[2], "base64");
  return { mimeType, buffer };
}

function dataUrlToInlineImage(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  return { mimeType: parsed.mimeType, data: new Uint8Array(parsed.buffer) };
}

async function urlToInlineImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    const err = new Error(`Failed to fetch image (${resp.status}).`);
    err.status = 400;
    throw err;
  }
  const mimeType = (resp.headers.get("content-type") || "application/octet-stream").toLowerCase();
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { mimeType, data: new Uint8Array(buffer) };
}

async function resolveImageInput(src) {
  const trimmed = (src || "").trim();
  if (!trimmed) {
    const err = new Error("Missing image source.");
    err.status = 400;
    throw err;
  }
  if (trimmed.startsWith("data:")) return dataUrlToInlineImage(trimmed);
  return urlToInlineImage(trimmed);
}

function sumTimings(timings) {
  return Object.values(timings).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/prints/generate", async (req, res, next) => {
  try {
    ensureGeminiKey();
    const {
      baseGarmentDataUrl,
      printDesignDataUrl,
      printColorHex,
      additionalPrompt,
      retryComment,
    } = req.body || {};

    if (!baseGarmentDataUrl) {
      return res.status(400).json({ error: "Missing base garment image." });
    }
    if (!printDesignDataUrl) {
      return res.status(400).json({ error: "Missing print/design image." });
    }

    const baseInline = dataUrlToInlineImage(baseGarmentDataUrl);
    const printInline = dataUrlToInlineImage(printDesignDataUrl);

    const prompt = buildPrintApplicationPrompt({
      additionalPrompt: additionalPrompt || "",
      ...(printColorHex ? { colorHex: printColorHex } : {}),
      ...(typeof retryComment === "string" ? { retryComment } : {}),
    });

    const t0 = performance.now();
    const out = await generateImage({
      apiKey: GEMINI_API_KEY,
      model: "gemini-3-pro-image-preview",
      promptText: prompt,
      images: [baseInline, printInline],
      timeoutMs: 180000,
    });
    const ms = Math.round(performance.now() - t0);

    const buffer = Buffer.from(out.imageBase64, "base64");
    const uploaded = await storage.uploadImage({
      buffer,
      mimeType: out.mimeType,
      prefix: "prints",
    });

    res.json({
      output: { url: uploaded.url, mimeType: out.mimeType },
      timingsMs: ms,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/looks/generate", async (req, res, next) => {
  try {
    ensureGeminiKey();
    const {
      garmentDataUrls,
      overrides,
      styleKeywords,
      accessories,
      footwear,
      availableBackgroundThemes,
      availableModelEthnicities,
    } = req.body || {};

    if (!Array.isArray(garmentDataUrls) || !garmentDataUrls.length) {
      return res.status(400).json({ error: "Missing garment images." });
    }

    const garmentImages = garmentDataUrls.map((src) => dataUrlToInlineImage(src));
    const userOverrides = {
      occasion: overrides?.occasion ?? null,
      color_scheme: overrides?.color_scheme ?? null,
      print_style: overrides?.print_style ?? null,
      background_theme: overrides?.background_theme ?? null,
      footwear: overrides?.footwear ?? null,
      model_ethnicity: overrides?.model_ethnicity ?? null,
      model_pose: overrides?.model_pose ?? null,
      model_styling_notes: overrides?.model_styling_notes ?? null,
    };

    const timings = {};
    const debug = {};
    let planError = null;

    let plan;
    const tPlan0 = performance.now();
    try {
      const planRes = await planLookFromGarment({
        apiKey: GEMINI_API_KEY,
        model: "gemini-3-flash-preview",
        garmentImages,
        availableBackgroundThemes: Array.isArray(availableBackgroundThemes) ? availableBackgroundThemes : [],
        availableModelEthnicities: Array.isArray(availableModelEthnicities) ? availableModelEthnicities : [],
        userOverrides,
        timeoutMs: 120000,
      });
      plan = planRes.plan;
      debug.plan_raw_text = planRes.rawText;
      debug.plan_raw_json = planRes.rawJson;
    } catch (err) {
      planError = err?.message || String(err);
      const ov = userOverrides;
      plan = {
        occasion: ov.occasion || "casual",
        color_scheme: ov.color_scheme || "neutral",
        print_style: "as-is",
        style_keywords: [],
        background_theme: ov.background_theme || ov.occasion || "casual",
        footwear: ov.footwear || "",
        accessories: [],
        negative_prompt:
          "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark",
        model_ethnicity: ov.model_ethnicity || "",
        model_pose: ov.model_pose || "",
        model_styling_notes: ov.model_styling_notes || "",
      };
    }
    timings.plan = Math.round(performance.now() - tPlan0);

    plan = applyFreeformOverrides(plan, {
      styleKeywords: Array.isArray(styleKeywords) ? styleKeywords : undefined,
      accessories: Array.isArray(accessories) ? accessories : undefined,
      footwear: footwear || null,
    });

    const tFinalPrompt0 = performance.now();
    const finalPromptRes = await generateFinalPrompt({
      apiKey: GEMINI_API_KEY,
      model: "gemini-3-flash-preview",
      plan,
      background: null,
      chosenModel: null,
      hasBackgroundReference: false,
      hasModelReference: false,
      timeoutMs: 120000,
    });
    timings.final_prompt = Math.round(performance.now() - tFinalPrompt0);
    debug.final_prompt = finalPromptRes.prompt;

    const garmentRefPrompt = buildGarmentReferencePrompt();
    const tGarment0 = performance.now();
    const garmentRef = await generateImage({
      apiKey: GEMINI_API_KEY,
      model: "gemini-3-pro-image-preview",
      promptText: garmentRefPrompt,
      images: garmentImages,
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    timings.garment_reference = Math.round(performance.now() - tGarment0);

    const garmentRefBuffer = Buffer.from(garmentRef.imageBase64, "base64");
    const garmentRefUpload = await storage.uploadImage({
      buffer: garmentRefBuffer,
      mimeType: garmentRef.mimeType,
      prefix: "garment-references",
    });

    const compositePrompt = buildCompositePrompt({
      plan,
      finalPrompt: finalPromptRes.prompt,
      hasModelReference: false,
      hasBackgroundReference: false,
    });
    debug.composite_prompt = compositePrompt;
    debug.negative_prompt = plan.negative_prompt;

    const tComposite0 = performance.now();
    const composite = await generateImage({
      apiKey: GEMINI_API_KEY,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: [{ mimeType: garmentRef.mimeType, data: new Uint8Array(garmentRefBuffer) }],
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    timings.composite = Math.round(performance.now() - tComposite0);

    const compositeBuffer = Buffer.from(composite.imageBase64, "base64");
    const compositeUpload = await storage.uploadImage({
      buffer: compositeBuffer,
      mimeType: composite.mimeType,
      prefix: "results",
    });

    timings.api_total = sumTimings(timings);

    const chosenSummary = {
      occasion: plan.occasion,
      color_scheme: plan.color_scheme,
      print_style: plan.print_style,
      style_keywords: plan.style_keywords,
      footwear: plan.footwear,
      accessories: plan.accessories,
      background_theme: plan.background_theme,
      model_ethnicity: plan.model_ethnicity,
      model_pose: plan.model_pose,
    };

    res.json({
      plan,
      finalPrompt: finalPromptRes.prompt,
      garmentRef: { url: garmentRefUpload.url, mimeType: garmentRef.mimeType },
      result: { url: compositeUpload.url, mimeType: composite.mimeType },
      timingsMs: timings,
      chosenSummary,
      debugSummary: {
        timings_ms: timings,
        plan_error: planError,
        ...debug,
      },
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/looks/retry", async (req, res, next) => {
  try {
    ensureGeminiKey();
    const {
      plan: basePlan,
      finalPrompt,
      retryComment,
      garmentRefUrl,
      overrides,
      styleKeywords,
      accessories,
      footwear,
    } = req.body || {};

    if (!basePlan || typeof basePlan !== "object") {
      return res.status(400).json({ error: "Missing plan." });
    }
    if (!finalPrompt) {
      return res.status(400).json({ error: "Missing final prompt." });
    }
    if (!garmentRefUrl) {
      return res.status(400).json({ error: "Missing garment reference image." });
    }

    let plan = { ...basePlan };
    const ov = overrides || {};
    if ((ov.occasion || "").trim()) plan.occasion = ov.occasion.trim();
    if ((ov.color_scheme || "").trim()) plan.color_scheme = ov.color_scheme.trim();
    if ((ov.background_theme || "").trim()) plan.background_theme = ov.background_theme.trim();
    if ((ov.footwear || "").trim()) plan.footwear = ov.footwear.trim();
    if ((ov.model_ethnicity || "").trim()) plan.model_ethnicity = ov.model_ethnicity.trim();
    if ((ov.model_pose || "").trim()) plan.model_pose = ov.model_pose.trim();
    if ((ov.model_styling_notes || "").trim()) plan.model_styling_notes = ov.model_styling_notes.trim();

    plan = applyFreeformOverrides(plan, {
      styleKeywords: Array.isArray(styleKeywords) ? styleKeywords : undefined,
      accessories: Array.isArray(accessories) ? accessories : undefined,
      footwear: footwear || null,
    });

    const compositePrompt = buildRetryCompositePrompt({
      plan,
      finalPrompt,
      hasModelReference: false,
      hasBackgroundReference: false,
      retryComment: retryComment || "",
    });

    const t0 = performance.now();
    const garmentRefInline = await resolveImageInput(garmentRefUrl);
    const composite = await generateImage({
      apiKey: GEMINI_API_KEY,
      model: "gemini-3-pro-image-preview",
      promptText: compositePrompt,
      images: [garmentRefInline],
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
      timeoutMs: 180000,
    });
    const ms = Math.round(performance.now() - t0);

    const compositeBuffer = Buffer.from(composite.imageBase64, "base64");
    const compositeUpload = await storage.uploadImage({
      buffer: compositeBuffer,
      mimeType: composite.mimeType,
      prefix: "results",
    });

    const chosenSummary = {
      occasion: plan.occasion,
      color_scheme: plan.color_scheme,
      print_style: plan.print_style,
      style_keywords: plan.style_keywords,
      footwear: plan.footwear,
      accessories: plan.accessories,
      background_theme: plan.background_theme,
      model_ethnicity: plan.model_ethnicity,
      model_pose: plan.model_pose,
    };

    res.json({
      plan,
      result: { url: compositeUpload.url, mimeType: composite.mimeType },
      timingsMs: { composite: ms, api_total: ms },
      chosenSummary,
      debugSummary: {
        timings_ms: { composite: ms, api_total: ms },
        retry_comment: retryComment || "",
        final_prompt: finalPrompt,
        composite_prompt: compositePrompt,
        negative_prompt: plan.negative_prompt,
      },
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/looks/angles", async (req, res, next) => {
  try {
    ensureGeminiKey();
    const {
      garmentDataUrls,
      garmentRefUrl,
      mainImageUrl,
      plan,
      finalPrompt,
      hasModelReference,
      hasBackgroundReference,
    } = req.body || {};

    if (!plan || typeof plan !== "object") {
      return res.status(400).json({ error: "Missing plan." });
    }
    if (!garmentRefUrl) {
      return res.status(400).json({ error: "Missing garment reference image." });
    }
    if (!mainImageUrl) {
      return res.status(400).json({ error: "Missing main image." });
    }

    const garmentRefInline = await resolveImageInput(garmentRefUrl);
    const mainInline = await resolveImageInput(mainImageUrl);
    const garmentAnglesInline = Array.isArray(garmentDataUrls)
      ? garmentDataUrls.map((src) => dataUrlToInlineImage(src))
      : [];

    const referenceImages = [garmentRefInline, ...garmentAnglesInline, mainInline];
    const promptBase = {
      plan,
      finalPrompt: finalPrompt || "",
      garmentAngleCount: garmentAnglesInline.length,
      hasModelReference: Boolean(hasModelReference),
      hasBackgroundReference: Boolean(hasBackgroundReference),
    };

    const sidePrompt = buildMultiAnglePrompt({ ...promptBase, angle: "side" });
    const backPrompt = buildMultiAnglePrompt({ ...promptBase, angle: "back" });

    const t0 = performance.now();
    const [sideRes, backRes] = await Promise.all([
      (async () => {
        const t = performance.now();
        const res = await generateImage({
          apiKey: GEMINI_API_KEY,
          model: "gemini-3-pro-image-preview",
          promptText: sidePrompt,
          images: referenceImages,
          aspectRatio: "3:4",
          width: 1080,
          height: 1440,
          timeoutMs: 180000,
        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
      (async () => {
        const t = performance.now();
        const res = await generateImage({
          apiKey: GEMINI_API_KEY,
          model: "gemini-3-pro-image-preview",
          promptText: backPrompt,
          images: referenceImages,
          aspectRatio: "3:4",
          width: 1080,
          height: 1440,
          timeoutMs: 180000,
        });
        return { res, ms: Math.round(performance.now() - t) };
      })(),
    ]);

    const sideBuffer = Buffer.from(sideRes.res.imageBase64, "base64");
    const backBuffer = Buffer.from(backRes.res.imageBase64, "base64");

    const [sideUpload, backUpload] = await Promise.all([
      storage.uploadImage({
        buffer: sideBuffer,
        mimeType: sideRes.res.mimeType,
        prefix: "angles",
      }),
      storage.uploadImage({
        buffer: backBuffer,
        mimeType: backRes.res.mimeType,
        prefix: "angles",
      }),
    ]);

    res.json({
      side: { url: sideUpload.url, mimeType: sideRes.res.mimeType, ms: sideRes.ms },
      back: { url: backUpload.url, mimeType: backRes.res.mimeType, ms: backRes.ms },
      timingsMs: {
        side: sideRes.ms,
        back: backRes.ms,
        total: Math.round(performance.now() - t0),
      },
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = err instanceof GeminiError ? err.message : err?.message || "Server error.";
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});

import { extractJsonObject, generateText, GeminiError } from "./gemini";

export type AssetMeta = {
  id: string;
  title: string;
  theme?: string | null;
  ethnicity?: string | null;
  tags: string[];
};

export type LookPlan = {
  occasion: string;
  color_scheme: string;
  print_style: string;
  style_keywords: string[];
  background_theme: string;
  accessories: string[];
  negative_prompt: string;
  model_ethnicity: string;
  model_styling_notes: string;
};

export type LookOverrides = {
  occasion?: string | null;
  color_scheme?: string | null;
  print_style?: string | null;
  background_theme?: string | null;
  model_ethnicity?: string | null;
  model_styling_notes?: string | null;
};

function coerceStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function coerceStrList(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      const s = coerceStr(item);
      if (s) out.push(s);
    }
    return out;
  }
  if (typeof v === "string") {
    return v
      .replace(/;/g, ",")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return [];
}

function overrideLines(overrides: LookOverrides): string[] {
  const pairs: Array<[string, string | null | undefined]> = [
    ["occasion", overrides.occasion],
    ["color_scheme", overrides.color_scheme],
    ["print_style", overrides.print_style],
    ["background_theme", overrides.background_theme],
    ["model_ethnicity", overrides.model_ethnicity],
    ["model_styling_notes", overrides.model_styling_notes],
  ];

  const lines: string[] = [];
  for (const [k, raw] of pairs) {
    const v = (raw || "").trim();
    if (v) lines.push(`- ${k}: ${v}`);
  }
  return lines;
}

export async function planLookFromGarment(opts: {
  apiKey: string;
  model: string;
  garmentImage: { mimeType: string; data: Uint8Array };
  availableBackgroundThemes: string[];
  availableModelEthnicities: string[];
  userOverrides: LookOverrides;
  timeoutMs?: number;
}): Promise<{ plan: LookPlan; rawText: string; rawJson: Record<string, unknown> }> {
  const bgHint = opts.availableBackgroundThemes.length
    ? opts.availableBackgroundThemes.slice(0, 20).join(", ")
    : "(none available)";
  const ethHint = opts.availableModelEthnicities.length
    ? opts.availableModelEthnicities.slice(0, 20).join(", ")
    : "(none available)";

  const ovLines = overrideLines(opts.userOverrides);
  const overridesBlock = ovLines.length ? ovLines.join("\n") : "- (none)";

  const prompt = `
You are a senior fashion ecommerce creative director for product photography.
The input is a GARMENT PHOTO (usually a single garment on a mannequin). There is no real person in the input.

Goal: propose a styling plan to generate a photorealistic, high-conversion ecommerce product image:
- A single model wearing EXACTLY the same garment from the GARMENT PHOTO.
- Be creative in the scene + styling while keeping it commercially usable and product-first.

Hard rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Keep the garment design accurate: do NOT invent or change neckline, sleeves, hem, print/pattern, logos/graphics, or fabric texture.
- Do not hallucinate specific garment details you cannot see; when uncertain, use "as-is".

If the user provided overrides, respect them:
${overridesBlock}

Background themes available (if you can match one, do so): ${bgHint}
Model ethnicities available (if you can match one, do so): ${ethHint}

Return JSON with exactly these keys:
{
  "occasion": string (examples: "beachwear", "party", "evening", "casual"),
  "color_scheme": string (short; for the overall scene palette; must NOT imply recoloring the garment),
  "print_style": string (short; describe the garment print if visible, otherwise "as-is"),
  "style_keywords": array of strings (3-8 items, short),
  "background_theme": string,
  "accessories": array of strings (0-6 items; realistic),
  "negative_prompt": string (short avoid clause),
  "model_ethnicity": string,
  "model_styling_notes": string (short; hair/makeup/jewelry guidance)
}`.trim();

  const result = await generateText({
    apiKey: opts.apiKey,
    model: opts.model,
    promptText: prompt,
    images: [opts.garmentImage],
    timeoutMs: opts.timeoutMs ?? 120_000,
    temperature: 0.2,
    maxOutputTokens: 512,
  });

  const rawJson = extractJsonObject(result.text);

  const occasion =
    coerceStr(opts.userOverrides.occasion) || coerceStr(rawJson.occasion) || "casual";
  const color_scheme =
    coerceStr(opts.userOverrides.color_scheme) || coerceStr(rawJson.color_scheme) || "neutral";
  const print_style =
    coerceStr(opts.userOverrides.print_style) || coerceStr(rawJson.print_style) || "as-is";
  const style_keywords = coerceStrList(rawJson.style_keywords);
  const background_theme =
    coerceStr(opts.userOverrides.background_theme) ||
    coerceStr(rawJson.background_theme) ||
    occasion;
  const accessories = coerceStrList(rawJson.accessories);
  const negative_prompt =
    coerceStr(rawJson.negative_prompt) ||
    "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark";
  const model_ethnicity =
    coerceStr(opts.userOverrides.model_ethnicity) || coerceStr(rawJson.model_ethnicity) || "";
  const model_styling_notes =
    coerceStr(opts.userOverrides.model_styling_notes) ||
    coerceStr(rawJson.model_styling_notes) ||
    "";

  return {
    plan: {
      occasion,
      color_scheme,
      print_style,
      style_keywords,
      background_theme,
      accessories,
      negative_prompt,
      model_ethnicity,
      model_styling_notes,
    },
    rawText: result.text,
    rawJson,
  };
}

export function chooseBackground(backgrounds: AssetMeta[], desiredTheme: string): AssetMeta | null {
  if (!backgrounds.length) return null;
  const desired = (desiredTheme || "").trim().toLowerCase();
  const themed = desired
    ? backgrounds.filter((b) => (b.theme || "").trim().toLowerCase() === desired)
    : [];
  const list = themed.length ? themed : backgrounds;
  return list[Math.floor(Math.random() * list.length)] || backgrounds[0] || null;
}

export function chooseModel(models: AssetMeta[], desiredEthnicity: string): AssetMeta | null {
  if (!models.length) return null;
  const desired = (desiredEthnicity || "").trim().toLowerCase();
  const matched = desired
    ? models.filter((m) => (m.ethnicity || "").trim().toLowerCase() === desired)
    : [];
  const list = matched.length ? matched : models;
  return list[Math.floor(Math.random() * list.length)] || models[0] || null;
}

export async function generateFinalPrompt(opts: {
  apiKey: string;
  model: string;
  plan: LookPlan;
  background: AssetMeta | null;
  chosenModel: AssetMeta | null;
  hasBackgroundReference: boolean;
  hasModelReference: boolean;
  timeoutMs?: number;
}): Promise<{ prompt: string; rawText: string }> {
  const background_desc = opts.background
    ? `${opts.background.title} (theme: ${opts.background.theme || "n/a"}, tags: ${opts.background.tags.join(", ")})`
    : "a relevant fashion background";
  const model_desc = opts.chosenModel
    ? `${opts.chosenModel.title} (ethnicity: ${opts.chosenModel.ethnicity || "n/a"}, tags: ${opts.chosenModel.tags.join(", ")})`
    : "a suitable female fashion model";

  const background_instruction = opts.hasBackgroundReference
    ? "Use the BACKGROUND PHOTO as the setting."
    : `No background reference is provided; invent a photorealistic setting matching: ${opts.plan.background_theme || opts.plan.occasion}.`;
  const model_instruction = opts.hasModelReference
    ? "Use the MODEL PHOTO as identity/pose reference."
    : `No model reference is provided; invent a suitable female fashion model.${opts.plan.model_ethnicity ? ` Prefer ethnicity: ${opts.plan.model_ethnicity}.` : ""}`;

  const prompt = `
You write prompts for a photorealistic fashion image model that generates ecommerce product photos.
Write ONE concise prompt to generate a high-quality, product-first ecommerce image.

Constraints:
- The output image must show a single female model wearing EXACTLY the garment from the GARMENT REFERENCE image (the garment may be photographed on a mannequin; ignore the mannequin).
- ${background_instruction} (match: ${background_desc}).
- ${model_instruction} (match: ${model_desc}).
- Frame the shot so the model is fully visible head-to-toe (no cropped head, no cropped feet).
- Keep anatomy correct, no extra limbs, no blur, no duplicated people.
- Do not add any new text/watermarks/logos (especially in the background). Preserve garment design from the reference (do not invent extra straps, patterns, or recolor it).

Styling plan:
- occasion: ${opts.plan.occasion}
- color_scheme: ${opts.plan.color_scheme}
- print_style: ${opts.plan.print_style}
- style_keywords: ${opts.plan.style_keywords.length ? opts.plan.style_keywords.join(", ") : "(none)"}
- accessories: ${opts.plan.accessories.length ? opts.plan.accessories.join(", ") : "(none)"}
- model_styling_notes: ${opts.plan.model_styling_notes || "(none)"}

Negative guidance to incorporate (as a short avoid clause): ${opts.plan.negative_prompt}

Return ONLY the prompt text (no quotes, no JSON).
  `.trim();

  try {
    const result = await generateText({
      apiKey: opts.apiKey,
      model: opts.model,
      promptText: prompt,
      images: null,
      timeoutMs: opts.timeoutMs ?? 120_000,
      temperature: 0.2,
      maxOutputTokens: 400,
    });
    return { prompt: result.text.trim(), rawText: result.text };
  } catch (err: any) {
    const avoid = opts.plan.negative_prompt || "blurry, low quality, extra limbs, text";
    const background_clause = opts.hasBackgroundReference
      ? "set in the BACKGROUND PHOTO"
      : `set in a photorealistic ${opts.plan.background_theme || opts.plan.occasion} background`;
    const model_clause = `one female model${opts.hasModelReference ? "" : opts.plan.model_ethnicity ? ` (prefer ${opts.plan.model_ethnicity})` : ""}`;
    const fallback = `Photorealistic ecommerce fashion photo, ${model_clause} wearing the garment from the GARMENT REFERENCE, ${opts.plan.occasion} style, ${opts.plan.color_scheme} color palette, garment print as in reference (${opts.plan.print_style}), accessories: ${opts.plan.accessories.length ? opts.plan.accessories.join(", ") : "none"}, ${background_clause}, natural lighting, realistic fabric drape, avoid: ${avoid}.`;
    return { prompt: fallback, rawText: String(err?.message || err) };
  }
}

export function buildGarmentReferencePrompt(): string {
  return [
    "You are generating a photorealistic ecommerce product reference image of a garment.",
    "The input image is a GARMENT PHOTO (often on a mannequin).",
    "Create a clean, high-resolution catalog cutout of the EXACT same garment on a plain light-neutral background.",
    "Hard rules:",
    "- Preserve the garment design exactly as in the input (color, print/pattern, logos/graphics, texture, seams, silhouette).",
    "- Do NOT add or remove design elements. Do NOT invent missing details. If unclear, keep it as-is.",
    "- Remove mannequin/body/stand and remove the original background.",
    "- Center the garment, keep it fully visible, keep proportions realistic.",
    "- No additional text, no watermark, no new logos.",
  ].join("\n");
}

export function buildCompositePrompt(opts: {
  plan: LookPlan;
  finalPrompt: string;
  hasModelReference: boolean;
  hasBackgroundReference: boolean;
}): string {
  const lines: string[] = [
    "You are generating a photorealistic ecommerce fashion product photo for an online store.",
    "The product is the hero: keep the garment accurate and undistorted.",
    "IMAGE 1 is the GARMENT REFERENCE (clean catalog cutout derived from the input garment photo). Use it as the single source of truth for garment design (color, print, texture, seams, silhouette).",
  ];

  if (opts.hasModelReference) {
    lines.push("IMAGE 2 is the MODEL PHOTO (use her identity, face, pose, and body proportions).");
  } else {
    lines.push(
      "No model reference is provided: create a suitable single female fashion model"
        + (opts.plan.model_ethnicity ? ` (prefer ${opts.plan.model_ethnicity})` : "")
        + ".",
    );
  }

  if (opts.hasBackgroundReference) {
    lines.push("The LAST image is the BACKGROUND PHOTO (use it as the scene).");
  } else {
    lines.push(
      `No background reference is provided: create a photorealistic background matching ${opts.plan.background_theme || opts.plan.occasion}.`,
    );
  }

  lines.push(
    "The final image must show ONE model wearing the EXACT garment from IMAGE 1.",
    "Frame the shot so the model is fully visible head-to-toe (no cropped head, no cropped feet).",
    "Keep the entire garment visible and unobstructed (do not hide it behind props or hair).",
    "Do not change the garment design (no recolor, no print changes, no new logos/graphics, no missing straps).",
    "No added text overlays, no watermarks, no brand logos in the background.",
    "Keep anatomy correct. No extra people. No duplicates.",
  );

  if (opts.plan.accessories.length) {
    lines.push(
      "Include these accessories (keep realistic and visible, but do not cover the garment): "
        + opts.plan.accessories.join(", "),
    );
  }
  if (opts.plan.style_keywords.length) {
    lines.push("Style keywords: " + opts.plan.style_keywords.join(", "));
  }
  if (opts.plan.model_styling_notes) {
    lines.push("Model styling notes: " + opts.plan.model_styling_notes);
  }

  lines.push(opts.finalPrompt);
  lines.push(`Avoid: ${opts.plan.negative_prompt}`);
  return lines.join("\n").trim();
}

export function applyFreeformOverrides(plan: LookPlan, opts: { styleKeywords?: string[]; accessories?: string[] }): LookPlan {
  return {
    ...plan,
    ...(opts.styleKeywords && opts.styleKeywords.length ? { style_keywords: opts.styleKeywords } : {}),
    ...(opts.accessories && opts.accessories.length ? { accessories: opts.accessories } : {}),
  };
}

export function computeTimingsMs(timings: Record<string, number>): {
  textLlmMs: number;
  imageGenMs: number;
  totalMs: number;
} {
  const textLlmMs = (timings.plan ?? 0) + (timings.final_prompt ?? 0);
  const imageGenMs = (timings.garment_reference ?? 0) + (timings.composite ?? 0);
  const totalMs = textLlmMs + imageGenMs;
  return { textLlmMs, imageGenMs, totalMs };
}


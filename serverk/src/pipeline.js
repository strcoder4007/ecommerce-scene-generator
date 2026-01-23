import { extractJsonObject, generateText, GeminiError } from "./gemini.js";

const MODEL_AGE_RULE =
  "Model age: young adult (18-23), not older than 23. The model must look clearly adult (do not depict a minor).";
const FULL_BODY_RULE =
  "HARD FRAMING: full-body head-to-toe. Include the entire head and both feet/shoes in frame (no cropping at any edge). Leave a small margin above head and below feet. Aspect ratio: 3:4 portrait. Output resolution: 1080x1440 px (3:4).";
const GARMENT_FIDELITY_RULE =
  "Garment fidelity: match the garment reference exactly (silhouette, neckline, sleeves, hem, print/pattern, logos/graphics, seams, fabric texture). Do not add extra fabric, extra layers, or new design elements.";
const BACKGROUND_LOCK_RULE =
  "Background fidelity: if a BACKGROUND PHOTO is provided, treat it as locked and match it closely (do not switch to a different background; do not add/remove major background objects).";
const GLOBAL_AVOID =
  "cropped head, cropped feet, cut off shoes, cut off top of head, out-of-frame limbs, close-up portrait, half-body, extreme wide shot, tiny product, distant subject, extra people, duplicated people, extra limbs, deformed hands, blur, low quality, text overlay, watermark, brand logos, extra fabric, added clothing layers, jacket, coat, cardigan, shawl, scarf, cape, gritty street style, dramatic high-fashion editorial, harsh hard shadows, moody low-key lighting, heavy film grain, CGI/cartoon look, child, teen, minor, underage, middle-aged, elderly";

function normalizeAvoidClause(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^avoid\s*:\s*/i, "").trim();
}

function coerceStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function coerceStrList(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) {
    const out = [];
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

function overrideLines(overrides) {
  const pairs = [
    ["occasion", overrides.occasion],
    ["color_scheme", overrides.color_scheme],
    ["print_style", overrides.print_style],
    ["background_theme", overrides.background_theme],
    ["footwear", overrides.footwear],
    ["model_ethnicity", overrides.model_ethnicity],
    ["model_pose", overrides.model_pose],
    ["model_styling_notes", overrides.model_styling_notes],
  ];

  const lines = [];
  for (const [k, raw] of pairs) {
    const v = (raw || "").trim();
    if (v) lines.push(`- ${k}: ${v}`);
  }
  return lines;
}

export async function planLookFromGarment(opts) {
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
The input is 1-4 GARMENT PHOTOS of the SAME garment (front/side/back angles are common). There is no real person in the input.

Goal: propose a styling plan to generate a photorealistic, high-conversion ecommerce product image:
- A single model wearing EXACTLY the same garment from the GARMENT PHOTO.
- Be creative in the scene + styling while keeping it commercially usable and product-first.

\tStyle guide to follow (non-negotiable):
\t- Product-first catalogue photography that still feels aspirational lifestyle (not pure studio).
\t- Vibe: warm, sunny, polished, approachable, slightly editorial. Think "vacation wardrobe lookbook".
\t- Not gritty street-style; not dramatic high-fashion; no harsh moody lighting.
\t\t- Prioritize full-body vertical framing; model head-to-toe in frame; garment clearly visible and readable (avoid tiny/distant subject).
\t\t- ${MODEL_AGE_RULE}
\t\t- Accessories: minimal but intentional/matching (0-3), realistic; do not cover the garment.
\t\t- Footwear: pick ONE realistic footwear choice that matches the occasion + styling (e.g., white sneakers, strappy heels, sandals). Keep it commercially usable and clearly visible in a full-body shot.
\t\t- Hair/makeup: natural glam, clean and commercial (defined brows, neutral lip), no extreme looks.
\t\t- Pose notes (for model_styling_notes): natural weight-shift (S-curve), slight torso twist, relaxed hands, subtle motion if needed to show drape.

\tHard rules:
\t- Output ONLY valid JSON (no markdown, no commentary).
\t- Keep the garment design accurate: do NOT invent or change neckline, sleeves, hem, print/pattern, logos/graphics, or fabric texture.
\t- Never add new garment elements (no extra fabric, no added layers, no jackets/shawls/scarves).
\t- Do not hallucinate specific garment details you cannot see; when uncertain, use "as-is".

If the user provided overrides, respect them:
${overridesBlock}

Background themes available (if you can match one, do so): ${bgHint}
Model ethnicities available (if you can match one, do so): ${ethHint}

Return JSON with exactly these keys:
{
  "occasion": string (examples: "beachwear", "party", "evening", "casual"),
  "color_scheme": string (short; for the overall scene palette; must NOT imply recoloring the garment),
  "print_style": string (short; describe the garment print if visible, otherwise "as-is"),
\t  "style_keywords": array of strings (3-8 items, short),
\t  "background_theme": string,
\t\t  "footwear": string (one footwear choice; can be empty if unsure),
\t\t  "accessories": array of strings (0-6 items; realistic),
\t\t  "negative_prompt": string (short avoid clause; include things like cropped head/feet, tiny/distant product, close-up portrait, extra limbs, blur, text/watermarks, extra fabric/layers, and any style-guide violations),
\t\t  "model_ethnicity": string,
\t\t  "model_pose": string (short; main-image pose direction such as "front hero", "3/4 turn", "walking step"; keep it ecommerce-friendly and full-body),
\t\t  "model_styling_notes": string (short; hair/makeup/jewelry guidance)
\t\t}`.trim();

  const result = await generateText({
    apiKey: opts.apiKey,
    model: opts.model,
    promptText: prompt,
    images: opts.garmentImages,
    timeoutMs: opts.timeoutMs ?? 120000,
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
    coerceStr(opts.userOverrides.background_theme)
    || coerceStr(rawJson.background_theme)
    || occasion;
  const footwear =
    coerceStr(opts.userOverrides.footwear)
    || coerceStr(rawJson.footwear)
    || "";
  const accessories = coerceStrList(rawJson.accessories);
  const negative_prompt =
    coerceStr(rawJson.negative_prompt)
    || "blurry, low quality, cropped head, cropped feet, incorrect garment, altered design, extra fabric, added layers, wrong print, extra limbs, deformed hands, extra people, text overlay, watermark";
  const model_ethnicity =
    coerceStr(opts.userOverrides.model_ethnicity) || coerceStr(rawJson.model_ethnicity) || "";
  const model_pose =
    coerceStr(opts.userOverrides.model_pose) || coerceStr(rawJson.model_pose) || "";
  const model_styling_notes =
    coerceStr(opts.userOverrides.model_styling_notes)
    || coerceStr(rawJson.model_styling_notes)
    || "";

  return {
    plan: {
      occasion,
      color_scheme,
      print_style,
      style_keywords,
      background_theme,
      footwear,
      accessories,
      negative_prompt,
      model_ethnicity,
      model_pose,
      model_styling_notes,
    },
    rawText: result.text,
    rawJson,
  };
}

export async function generateFinalPrompt(opts) {
  const background_desc = opts.background
    ? `${opts.background.title} (theme: ${opts.background.theme || "n/a"}, tags: ${opts.background.tags.join(", ")})`
    : "a relevant fashion background";
  const model_desc = opts.chosenModel
    ? `${opts.chosenModel.title} (ethnicity: ${opts.chosenModel.ethnicity || "n/a"}, tags: ${opts.chosenModel.tags.join(", ")})`
    : "a suitable female fashion model";

  const background_instruction = opts.hasBackgroundReference
    ? `${BACKGROUND_LOCK_RULE} Keep wording generic: say "in the provided background photo" (do not invent a new location).`
    : `No background reference is provided; invent a photorealistic setting matching: ${opts.plan.background_theme || opts.plan.occasion}.`;
  const model_instruction = opts.hasModelReference
    ? "Use the MODEL PHOTO as identity reference and keep the same person. Do not invent face/hair details in text; keep wording generic: \"match the provided model photo\"."
    : `No model reference is provided; invent a suitable female fashion model.${opts.plan.model_ethnicity ? ` Prefer ethnicity: ${opts.plan.model_ethnicity}.` : ""}`;

  const prompt = `
You write prompts for a photorealistic fashion image model that generates ecommerce product photos.
Write ONE concise prompt (4-5 sentences) to generate a high-quality, product-first ecommerce image.

Constraints:
- The output image must show a single female model wearing EXACTLY the garment from the GARMENT REFERENCE image (the garment may be photographed on a mannequin; ignore the mannequin).
- ${background_instruction} (match: ${background_desc}).
- ${model_instruction} (match: ${model_desc}).
- ${MODEL_AGE_RULE}
- ${FULL_BODY_RULE}
- Product scale: keep the model/garment medium-large in frame (avoid wide shots where the product looks tiny). Aim for the model to fill ~80-85% of the image height while still fully visible head-to-toe. Ensure fabric texture/print details are readable.
- Keep anatomy correct, no extra limbs, no blur, no duplicated people.
- Do not add any new text/watermarks/logos (especially in the background).
- ${GARMENT_FIDELITY_RULE}
- If a background reference is provided, do not describe a different background. If a model reference is provided, do not describe hair/face; defer to the reference images.

Style guide baseline to incorporate (must match this look):
- Product-first catalogue photography with aspirational lifestyle feel (not pure studio).
- Warm, sunny, polished, approachable, slightly editorial; "vacation wardrobe lookbook" vibe. Not gritty street-style; not dramatic high-fashion.
- Camera: vertical 3:4 full-body shot, 35-50mm look, eye-level, f/3.2-f/4 shallow separation, crisp focus.
- Lighting: natural daylight look with soft front-side light (10-45 deg) and gentle fill; medium contrast; warm midtones; realistic shadows.
- Pose: ${opts.plan.model_pose ? `follow this direction: ${opts.plan.model_pose}` : "natural weight shift (S-curve), legs uncrossed, slight torso twist/shoulder tilt to show silhouette + neckline, relaxed hands (light touch on fabric/hip/railing; no clenched fists), slight head tilt, soft smile; optional subtle step/sway to show drape."}
- Garment presentation: wrinkle-free/steamed look; fit and drape clearly visible; keep neckline/waistline/hemline readable.
- Composition: rule-of-thirds friendly, clean commercial framing with a little breathing room (while keeping full body + product large).
- Finish: warm skin tones, vivid-but-natural color, fabric micro-contrast/sharpness, natural skin texture (no plastic/CGI look).

Styling plan:
\t- occasion: ${opts.plan.occasion}
\t- color_scheme: ${opts.plan.color_scheme}
\t- print_style: ${opts.plan.print_style}
\t- style_keywords: ${opts.plan.style_keywords.length ? opts.plan.style_keywords.join(", ") : "(none)"}
\t- footwear: ${opts.plan.footwear || "(auto)"}
\t- accessories: ${opts.plan.accessories.length ? opts.plan.accessories.join(", ") : "(none)"}
\t- model_pose: ${opts.plan.model_pose || "(auto)"}
\t- model_styling_notes: ${opts.plan.model_styling_notes || "(none)"}

Negative guidance to incorporate (as a short avoid clause): ${opts.plan.negative_prompt}

Return ONLY the prompt text (no quotes, no JSON).
  `.trim();

  try {
    const result = await generateText({
      apiKey: opts.apiKey,
      model: opts.model,
      promptText: prompt,
      images: null,
      timeoutMs: opts.timeoutMs ?? 120000,
      temperature: 0.2,
      maxOutputTokens: 400,
    });
    return { prompt: result.text.trim(), rawText: result.text };
  } catch (err) {
    const avoid = opts.plan.negative_prompt || "blurry, low quality, extra limbs, text";
    const background_clause = opts.hasBackgroundReference
      ? "set in the BACKGROUND PHOTO"
      : `set in a photorealistic ${opts.plan.background_theme || opts.plan.occasion} background`;
    const model_clause = `one female model${opts.hasModelReference ? "" : opts.plan.model_ethnicity ? ` (prefer ${opts.plan.model_ethnicity})` : ""}`;
    const fallback = `Photorealistic ecommerce fashion photo (warm sunny vacation lookbook vibe), young adult female model (18-23; not older than 23; must look adult), full-body head-to-toe vertical 3:4 1080x1440px (include entire head and both feet/shoes; small margin; no cropping), ${model_clause} wearing EXACTLY the garment from the GARMENT REFERENCE (no extra fabric/layers; no design changes), model/garment medium-large in frame (avoid wide shot/tiny product; model fills ~80-85% height), ${opts.plan.occasion} style, ${opts.plan.color_scheme} palette, garment print as in reference (${opts.plan.print_style}), footwear: ${opts.plan.footwear || "auto"}, accessories: ${opts.plan.accessories.length ? opts.plan.accessories.join(", ") : "none"}, ${background_clause}, natural daylight with soft fill, 35-50mm look, crisp focus, medium contrast, visible fabric texture, avoid: ${avoid}, ${GLOBAL_AVOID}.`;
    return { prompt: fallback, rawText: String(err?.message || err) };
  }
}

export function buildGarmentReferencePrompt() {
  return [
    "You are generating a photorealistic ecommerce product reference image of a garment.",
    "The input images are 1-4 GARMENT PHOTOS of the SAME garment (front/side/back angles are common).",
    "Create a clean, high-resolution catalog cutout of the EXACT same garment on a plain light-neutral background.",
    "Use even, diffused studio lighting with accurate color and crisp edges (no harsh shadows).",
    "Hard rules:",
    "- Preserve the garment design exactly as in the input (color, print/pattern, logos/graphics, texture, seams, silhouette).",
    "- Do NOT add or remove design elements. Do NOT invent missing details. Do NOT add extra fabric/layers/straps. If unclear, keep it as-is.",
    "- Remove mannequin/body/stand and remove the original background.",
    "- Center the garment, keep it fully visible (no cropping), keep proportions realistic.",
    "- Make the garment medium-large in frame with minimal margins (product-first).",
    "- No additional text, no watermark, no new logos.",
  ].join("\n");
}

export function buildPrintApplicationPrompt(opts) {
  const extra = (opts.additionalPrompt || "").trim();
  const hasRetry = typeof opts.retryComment === "string";
  const retryComment = (opts.retryComment || "").trim();
  const colorHex = (opts.colorHex || "").trim();
  const hasColorHex = Boolean(colorHex);

  const lines = [];

  if (hasRetry) {
    lines.push(
      "RETRY PASS (prints): re-generate the printed garment result for the SAME inputs.",
      "Apply the user's retry comments as targeted improvements while keeping the base photo composition identical.",
      "Do not introduce new garment design elements or extra fabric; keep it photorealistic and commercially usable.",
    );
    if (retryComment) lines.push(`User retry comments: ${retryComment}`);
    lines.push("");
  }

  if (hasColorHex) {
    lines.push(
      "You are a senior apparel print designer + production retoucher for an ecommerce fashion company.",
      "This is an IMAGE EDIT task: keep the base photo realistic and unchanged except for the garment fabric color.",
      "IMAGE 1 is the BASE GARMENT PHOTO (a plain garment worn by a mannequin).",
      "IMAGE 2 is a SOLID COLOR SWATCH image that represents the exact target color.",
      "",
      `Solid color to apply (HEX): ${colorHex}`,
      "",
      "Photo quality requirements:",
      "- Output must preserve the exact composition of IMAGE 1 (same mannequin, pose, background, lighting, shadows, wrinkles, camera angle).",
      "- Do NOT crop or reframe. Keep the same aspect ratio and framing as IMAGE 1.",
      "- Only the garment fabric appearance should change.",
      "- Photorealistic, high resolution, crisp detail; no blur; no noise; do not add new text/watermarks.",
      "",
      "Task:",
      "- Output the SAME base photo as IMAGE 1, but recolor the garment fabric to the exact solid color above.",
      "- Keep the mannequin visible (do not remove it) and keep the background unchanged.",
      "",
      "Hard rules:",
      "- Preserve the garment silhouette and construction exactly (neckline, sleeves, hem, seams, closures, texture). Do not change fit, length, or shape.",
      "- Do NOT change anything outside the garment area (no changes to mannequin, background, lighting, shadows, camera, or edges).",
      "- Do NOT add extra fabric, extra layers, or new garment elements.",
      "- Apply the solid color ONLY to the garment fabric (not on mannequin/skin/background).",
      "- Color realism: preserve original shading/highlights and fabric texture; the color should look dyed/printed into the fabric (not a flat sticker).",
      "- Match the color as closely as possible to the HEX value (no random hue shifts, no gradients, no added patterns).",
      "- Return an IMAGE output (no text-only response).",
    );
  } else {
    lines.push(
      "You are a senior apparel print designer + production retoucher for an ecommerce fashion company.",
      "This is an IMAGE EDIT task: keep the base photo realistic and unchanged except for the garment fabric print.",
      "IMAGE 1 is the BASE GARMENT PHOTO (a plain white garment worn by a mannequin).",
      "IMAGE 2 is the PRINT/DESIGN artwork to apply to the garment fabric (may be a repeating pattern, a centered graphic, or a solid color swatch image).",
      "",
      "Photo quality requirements:",
      "- Output must preserve the exact composition of IMAGE 1 (same mannequin, pose, background, lighting, shadows, wrinkles, camera angle).",
      "- Do NOT crop or reframe. Keep the same aspect ratio and framing as IMAGE 1.",
      "- Only the garment fabric appearance should change.",
      "- Photorealistic, high resolution, crisp detail; no blur; no noise; do not add new text/watermarks.",
      "",
      "Task:",
      "- Output the SAME base photo as IMAGE 1, but with the print/design applied to the garment fabric.",
      "- Keep the mannequin visible (do not remove it) and keep the background unchanged.",
      "",
      "Critical layering (fix common failure):",
      "- The print must be ON the garment fabric (like ink), NOT behind the garment and NOT used as a background poster.",
      "- The print must be clipped strictly inside the garment fabric region; it must never appear outside the garment silhouette, never on the mannequin, and never in the background.",
      "- Use IMAGE 2 only as the source of the print pattern/graphic; do not paste IMAGE 2 as a separate layer behind the garment.",
      "",
      "Hard rules:",
      "- Preserve the garment silhouette and construction exactly (neckline, sleeves, hem, seams, closures, texture). Do not change fit, length, or shape.",
      "- Do NOT change anything outside the garment area (no changes to mannequin, hands, background, lighting, shadows, camera, or edges).",
      "- Do NOT add extra fabric, extra layers, or new garment elements.",
      "- Apply the print ONLY to the garment fabric (not on mannequin/skin/background).",
      "- Placement: if IMAGE 2 is a centered graphic/logo, place it centered on the front chest/torso area (not oversized). If IMAGE 2 is a repeating pattern, tile it across the garment fabric evenly.",
      "- Print realism: correct scale; follow seams/panels; wrap with folds and perspective; preserve the original garment shading/highlights and fabric texture (DTG/screen print look). Avoid distortion/warping.",
      "- If the print image is a solid color swatch, recolor the garment fabric to that color while preserving highlights/shadows and fabric texture.",
    );
  }
  if (extra) {
    lines.push("", "User notes (apply if compatible with the hard rules above):", extra);
  }
  lines.push(
    "",
    "Avoid: print behind garment, print used as background, any background change, mannequin changes, pose changes, cropping/reframing, altered garment shape, added fabric, added layers, print bleeding onto mannequin/background, warped print, wrong print scale, unintended patterns, low-res, blur, new text overlay, new watermark.",
  );
  return lines.join("\n").trim();
}

export function buildCompositePrompt(opts) {
  const avoid = [normalizeAvoidClause(opts.plan.negative_prompt), GLOBAL_AVOID].filter(Boolean).join(", ");

  const lines = [
    "You are generating a photorealistic ecommerce fashion product photo for an online store.",
    "The product is the hero: keep the garment accurate and undistorted.",
    "Style baseline: warm, sunny, polished, approachable, slightly editorial. Aspirational lifestyle (vacation wardrobe lookbook). Not gritty street-style; not dramatic high-fashion.",
    "Camera and lighting: vertical 3:4 full-body, 35-50mm look, eye-level, f/3.2-f/4 separation, natural daylight with soft front-side light and gentle fill; medium contrast; warm midtones; crisp focus with visible fabric texture.",
    opts.plan.model_pose
      ? `Pose direction (must follow): ${opts.plan.model_pose}`
      : "Pose direction: natural weight shift (S-curve), legs uncrossed, slight torso twist/shoulder tilt, relaxed hands lightly touching fabric/hip/railing (no clenched fists), slight head tilt, soft smile; optional subtle step/sway to show drape.",
    "Garment presentation: wrinkle-free/steamed look, clear fit and drape, keep neckline/waistline/hemline readable; keep hair/props from covering the garment.",
    "Composition: rule-of-thirds friendly, clean commercial framing with a little breathing room (while keeping full body + product large).",
    "IMAGE 1 is the GARMENT REFERENCE (clean catalog cutout derived from the input garment photo). Use it as the single source of truth for garment design (color, print, texture, seams, silhouette).",
  ];

  if (opts.hasModelReference) {
    lines.push("IMAGE 2 is the MODEL PHOTO. You MUST match her identity/face/hair, pose, and body proportions.");
  } else {
    lines.push(
      "No model reference is provided: create a suitable single female fashion model"
        + (opts.plan.model_ethnicity ? ` (prefer ${opts.plan.model_ethnicity})` : "")
        + ".",
    );
  }

  if (opts.hasBackgroundReference) {
    lines.push(
      `The LAST image is the BACKGROUND PHOTO. ${BACKGROUND_LOCK_RULE}`,
    );
  } else {
    lines.push(
      `No background reference is provided: create a photorealistic background matching ${opts.plan.background_theme || opts.plan.occasion}.`,
    );
  }

  lines.push(
    "The final image must show ONE model wearing the EXACT garment from IMAGE 1.",
    MODEL_AGE_RULE,
    FULL_BODY_RULE,
    "Product scale: keep the model/garment medium-large in frame (avoid wide shots). Aim for the model to fill ~80-85% of the image height while still fully visible head-to-toe. Ensure fabric texture/print details are readable.",
    "Keep the entire garment visible and unobstructed (do not hide it behind props or hair).",
    GARMENT_FIDELITY_RULE,
    "No added text overlays, no watermarks, no brand logos in the background.",
    "Keep anatomy correct. No extra people. No duplicates.",
  );

  if (opts.plan.accessories.length) {
    lines.push(
      "MUST include these accessories (keep realistic and visible, but do not cover the garment): "
        + opts.plan.accessories.join(", "),
    );
  }
  if (opts.plan.footwear) {
    lines.push("Footwear: " + opts.plan.footwear + " (ensure shoes are visible in the full-body frame).");
  }
  if (opts.plan.style_keywords.length) {
    lines.push("Style keywords: " + opts.plan.style_keywords.join(", "));
  }
  if (opts.plan.model_pose) {
    lines.push("Model pose: " + opts.plan.model_pose);
  }
  if (opts.plan.model_styling_notes) {
    lines.push("Model styling notes: " + opts.plan.model_styling_notes);
  }

  if ((opts.finalPrompt || "").trim()) {
    lines.push(
      "Draft text prompt to incorporate. If it conflicts with any image reference or rules above, ignore the conflicting parts:",
    );
    lines.push(opts.finalPrompt.trim());
  }

  lines.push(
    "FINAL CHECK (non-negotiable):",
    FULL_BODY_RULE,
    MODEL_AGE_RULE,
    "Garment must match IMAGE 1 exactly (no extra fabric, no added layers, no design changes).",
    opts.hasBackgroundReference ? BACKGROUND_LOCK_RULE : "Background must match the scene direction above.",
    "One person only; correct anatomy; no extra limbs; no duplicates.",
  );
  lines.push(`Avoid: ${avoid}`);
  return lines.join("\n").trim();
}

export function buildRetryCompositePrompt(opts) {
  const base = buildCompositePrompt({
    plan: opts.plan,
    finalPrompt: opts.finalPrompt,
    hasModelReference: opts.hasModelReference,
    hasBackgroundReference: opts.hasBackgroundReference,
  });

  const comment = (opts.retryComment || "").trim();
  const header = [
    "RETRY PASS (main image): This is a re-generation of the main image for the SAME garment.",
    "Keep the garment design identical and follow all hard framing + fidelity rules.",
    "Apply the user's retry comments as targeted improvements; do not introduce new clothing elements or extra fabric.",
    `Occasion: ${opts.plan.occasion || "(auto)"}`,
    `Color scheme: ${opts.plan.color_scheme || "(auto)"}`,
    `Background theme: ${opts.plan.background_theme || "(auto)"}`,
    `Model: ${opts.plan.model_ethnicity || "(auto)"}`,
    `Model pose: ${opts.plan.model_pose || "(auto)"}`,
    `Footwear: ${opts.plan.footwear || "(auto)"}`,
    `Accessories: ${opts.plan.accessories.length ? opts.plan.accessories.join(", ") : "(auto)"}`,
    `Style keywords: ${opts.plan.style_keywords.length ? opts.plan.style_keywords.join(", ") : "(auto)"}`,
    `Model styling notes: ${opts.plan.model_styling_notes || "(auto)"}`,
  ];
  if (comment) header.push(`User retry comments: ${comment}`);
  header.push("");

  return header.join("\n") + base;
}

export function buildMultiAnglePrompt(opts) {
  const avoid = [normalizeAvoidClause(opts.plan.negative_prompt), GLOBAL_AVOID].filter(Boolean).join(", ");

  const garmentAngles = Math.max(0, Math.min(4, Math.floor(opts.garmentAngleCount || 0)));
  const mainImageIndex = 2 + garmentAngles;
  const modelIndex = opts.hasModelReference ? mainImageIndex + 1 : null;
  const backgroundIndex = opts.hasBackgroundReference ? mainImageIndex + (opts.hasModelReference ? 2 : 1) : null;

  const lines = [
    "You are generating additional angles for an ecommerce fashion product photo.",
    "Goal: create an additional view of the SAME look as the MAIN RESULT image, while keeping the garment design accurate.",
    "Style baseline: warm, sunny, polished, approachable, slightly editorial. Aspirational lifestyle (vacation wardrobe lookbook). Not gritty street-style; not dramatic high-fashion.",
    "Camera and lighting: vertical 3:4 full-body, 35-50mm look, eye-level, f/3.2-f/4 separation, natural daylight with soft front-side light and gentle fill; medium contrast; warm midtones; crisp focus with visible fabric texture.",
    FULL_BODY_RULE,
    "Product scale: keep the model/garment medium-large in frame (avoid wide shots). Aim for the model to fill ~80-85% of the image height while still fully visible head-to-toe.",
    "Keep the entire garment visible and unobstructed (no hair/props covering key details).",
    MODEL_AGE_RULE,
    GARMENT_FIDELITY_RULE,
    "Keep anatomy correct. One person only.",
    "IMAGE 1 is the GARMENT REFERENCE CUTOUT (source of truth for garment design).",
  ];

  if (garmentAngles) {
    lines.push(
      `IMAGES 2-${1 + garmentAngles} are additional GARMENT PHOTOS of the SAME garment (different angles). Use them only to preserve back/side details; ignore mannequin/body/stand and ignore those photos' original backgrounds.`,
    );
  }

  lines.push(`IMAGE ${mainImageIndex} is the MAIN RESULT image (match the same model identity, hair/makeup, accessories, lighting, and scene).`);

  if (modelIndex) {
    lines.push(`IMAGE ${modelIndex} is the MODEL PHOTO (optional; use it for identity/face consistency).`);
  }
  if (backgroundIndex) {
    lines.push(`IMAGE ${backgroundIndex} is the BACKGROUND PHOTO (optional; use it for scene consistency).`);
  }

  if (opts.angle === "side") {
    lines.push(
      "Requested view: SIDE VIEW.",
      "Pose: natural ecommerce side/3-4 turn. Rotate the body ~60-80 deg from camera, subtle weight shift (S-curve), one foot slightly forward, relaxed arms (one hand lightly on hip or along thigh), shoulders relaxed, soft smile.",
      "Composition: show the garment silhouette and side seam clearly; do not obscure the garment with hair or arms.",
    );
  } else {
    lines.push(
      "Requested view: BACK VIEW.",
      "Pose: natural ecommerce back view. Model facing away from camera, slight head turn 15-30 deg (profile/3-4), arms relaxed slightly away from body to reveal the garment back, gentle weight shift, soft expression.",
      "Composition: show the garment back details clearly; move hair aside so the back of the garment is visible.",
    );
  }

  if (opts.plan.accessories.length) {
    lines.push(
      "Accessories (keep consistent with the main image and do not cover the garment): " + opts.plan.accessories.join(", "),
    );
  }
  if (opts.plan.footwear) {
    lines.push("Footwear (keep consistent with the main image): " + opts.plan.footwear);
  }
  if (opts.plan.style_keywords.length) {
    lines.push("Style keywords: " + opts.plan.style_keywords.join(", "));
  }
  if (opts.plan.model_styling_notes) {
    lines.push("Model styling notes: " + opts.plan.model_styling_notes);
  }

  if ((opts.finalPrompt || "").trim()) {
    lines.push("Baseline description to keep consistent (override only the pose/viewpoint as requested):");
    lines.push(opts.finalPrompt.trim());
  }

  lines.push(
    "FINAL CHECK (non-negotiable):",
    FULL_BODY_RULE,
    MODEL_AGE_RULE,
    "Garment must match IMAGE 1 and the MAIN RESULT (no extra fabric, no added layers, no design changes).",
    "Match the same background/scene as the MAIN RESULT (and BACKGROUND PHOTO if provided).",
    "One person only; correct anatomy; no extra limbs; no duplicates.",
  );
  lines.push(`Avoid: ${avoid}`);
  return lines.join("\n").trim();
}

export function applyFreeformOverrides(plan, opts) {
  return {
    ...plan,
    ...(opts.styleKeywords && opts.styleKeywords.length ? { style_keywords: opts.styleKeywords } : {}),
    ...(opts.accessories && opts.accessories.length ? { accessories: opts.accessories } : {}),
    ...(opts.footwear && opts.footwear.trim() ? { footwear: opts.footwear.trim() } : {}),
  };
}

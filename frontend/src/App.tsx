import { type FormEvent, useEffect, useMemo, useState } from "react";

type ApiError = { error: string };

type Asset = {
  id: string;
  title: string;
  theme?: string | null;
  ethnicity?: string | null;
  tags: string[];
  image_url: string;
  created_at: string;
};

type GenerateLookResponse =
  | {
      mime_type: string;
      image_base64: string;
      chosen: any;
      debug?: any;
    }
  | ApiError;

type PillOption = { value: string; label: string };

function mimeToExtension(mimeType: string | null): string {
  const mt = (mimeType || "").toLowerCase().trim();
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  return "png";
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
}

function joinUrl(base: string, maybeRelative: string): string {
  if (maybeRelative.startsWith("http://") || maybeRelative.startsWith("https://")) {
    return maybeRelative;
  }
  return `${base}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function InfoButton({ text }: { text: string }) {
  return (
    <button type="button" className="infoButton" aria-label={text}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M10 18.25C5.44467 18.25 1.75 14.5553 1.75 10C1.75 5.44467 5.44467 1.75 10 1.75C14.5553 1.75 18.25 5.44467 18.25 10C18.25 14.5553 14.5553 18.25 10 18.25Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M10 8.7V14.1"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M10 6.35H10.01"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="tooltip" role="tooltip">
        {text}
      </span>
    </button>
  );
}

function FieldLabel({
  htmlFor,
  label,
  info,
}: {
  htmlFor?: string;
  label: string;
  info: string;
}) {
  return (
    <div className="labelRow">
      <label htmlFor={htmlFor}>{label}</label>
      <InfoButton text={info} />
    </div>
  );
}

function PillRadioGroup({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: PillOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="pillGroup" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label key={opt.value} className="pill">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function combinePresetAndCustom({
  presetText,
  customText,
  joiner = ", ",
}: {
  presetText: string;
  customText: string;
  joiner?: string;
}): string {
  const p = presetText.trim();
  const c = customText.trim();
  if (!p) return c;
  if (!c) return p;
  return `${p}${joiner}${c}`;
}

export default function App() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);

  const [activeTab, setActiveTab] = useState<"generate" | "assets">("generate");

  const [backgrounds, setBackgrounds] = useState<Asset[]>([]);
  const [models, setModels] = useState<Asset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  async function refreshAssets() {
    setAssetsError(null);
    try {
      const [bgResp, modelResp] = await Promise.all([
        fetch(`${apiBaseUrl}/api/assets/backgrounds`),
        fetch(`${apiBaseUrl}/api/assets/models`),
      ]);
      const bgData = (await bgResp.json()) as Asset[] | ApiError;
      const modelData = (await modelResp.json()) as Asset[] | ApiError;
      if (!bgResp.ok) throw new Error("error" in bgData ? bgData.error : "Failed to load backgrounds");
      if (!modelResp.ok) throw new Error("error" in modelData ? modelData.error : "Failed to load models");
      setBackgrounds(bgData as Asset[]);
      setModels(modelData as Asset[]);
    } catch (err: any) {
      setAssetsError(err?.message || String(err));
    }
  }

  useEffect(() => {
    void refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate look state
  const [garmentPhoto, setGarmentPhoto] = useState<File | null>(null);
  const garmentPreviewUrl = useMemo(
    () => (garmentPhoto ? URL.createObjectURL(garmentPhoto) : null),
    [garmentPhoto],
  );

  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  const [occasionPreset, setOccasionPreset] = useState<string>("");
  const [occasionDetails, setOccasionDetails] = useState<string>("");
  const [colorScheme, setColorScheme] = useState("");
  const [backgroundThemePreset, setBackgroundThemePreset] = useState<string>("");
  const [backgroundThemeDetails, setBackgroundThemeDetails] = useState<string>("");
  const [modelPreset, setModelPreset] = useState<string>("");
  const [modelDetails, setModelDetails] = useState<string>("");
  const [modelStylingNotes, setModelStylingNotes] = useState("");
  const [stylePreset, setStylePreset] = useState<string>("");
  const [styleKeywordsDetails, setStyleKeywordsDetails] = useState<string>("");
  const [accessories, setAccessories] = useState("");
  const [includeDebug, setIncludeDebug] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [resultMimeType, setResultMimeType] = useState<string | null>(null);
  const [chosenSummary, setChosenSummary] = useState<any>(null);
  const [debugSummary, setDebugSummary] = useState<any>(null);

  async function onGenerateLook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerateError(null);
    setResultDataUrl(null);
    setResultMimeType(null);
    setChosenSummary(null);
    setDebugSummary(null);

    if (!garmentPhoto) {
      setGenerateError("Please select a garment photo.");
      return;
    }

    const form = new FormData();
    form.append("garment_photo", garmentPhoto);

    if (selectedBackgroundId) form.append("background_id", selectedBackgroundId);
    if (selectedModelId) form.append("model_id", selectedModelId);

    const occasionFinal =
      occasionPreset === "custom"
        ? occasionDetails.trim()
        : combinePresetAndCustom({
            presetText: occasionPreset,
            customText: occasionDetails,
            joiner: ", ",
          });
    if (colorScheme.trim()) form.append("color_scheme", colorScheme.trim());
    const stylePresetKeywords: Record<string, string> = {
      minimal: "minimal, clean, modern",
      streetwear: "streetwear, edgy, urban",
      luxe: "luxury, premium, editorial",
      boho: "boho, relaxed, earthy",
      vintage: "vintage, retro",
      sporty: "sporty, athleisure",
      romantic: "romantic, feminine",
      edgy: "edgy, bold, high-contrast",
    };
    const stylePresetText =
      stylePreset && stylePreset !== "custom" ? stylePresetKeywords[stylePreset] ?? stylePreset : "";
    const styleKeywordsFinal =
      stylePreset === "custom"
        ? styleKeywordsDetails.trim()
        : combinePresetAndCustom({
            presetText: stylePresetText,
            customText: styleKeywordsDetails,
            joiner: ", ",
          });
    const backgroundThemeFinal =
      backgroundThemePreset === "custom"
        ? backgroundThemeDetails.trim()
        : combinePresetAndCustom({
            presetText: backgroundThemePreset,
            customText: backgroundThemeDetails,
            joiner: ", ",
          });
    const modelEthnicityFinal =
      modelPreset === "custom"
        ? modelDetails.trim()
        : combinePresetAndCustom({
            presetText: modelPreset,
            customText: modelDetails,
            joiner: ", ",
          });

    if (occasionFinal) form.append("occasion", occasionFinal);
    if (backgroundThemeFinal) form.append("background_theme", backgroundThemeFinal);
    if (modelEthnicityFinal) form.append("model_ethnicity", modelEthnicityFinal);
    if (modelStylingNotes.trim()) form.append("model_styling_notes", modelStylingNotes.trim());
    if (styleKeywordsFinal) form.append("style_keywords", styleKeywordsFinal);
    if (accessories.trim()) form.append("accessories", accessories.trim());
    if (includeDebug) form.append("include_debug", "true");

    setIsGenerating(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/generate-look`, {
        method: "POST",
        body: form,
      });
      const data = (await resp.json()) as GenerateLookResponse;
      if (!resp.ok) {
        setGenerateError("error" in data ? data.error : `Request failed (${resp.status})`);
        return;
      }
      if ("error" in data) {
        setGenerateError(data.error);
        return;
      }
      setChosenSummary(data.chosen);
      setDebugSummary(data.debug ?? null);
      setResultMimeType(data.mime_type);
      setResultDataUrl(`data:${data.mime_type};base64,${data.image_base64}`);
    } catch (err: any) {
      setGenerateError(err?.message || String(err));
    } finally {
      setIsGenerating(false);
    }
  }

  // Asset upload state
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgTitle, setBgTitle] = useState("");
  const [bgTheme, setBgTheme] = useState("");
  const [bgTags, setBgTags] = useState("");
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const [bgUploading, setBgUploading] = useState(false);

  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelTitle, setModelTitle] = useState("");
  const [modelAssetEthnicity, setModelAssetEthnicity] = useState("");
  const [modelTags, setModelTags] = useState("");
  const [modelUploadError, setModelUploadError] = useState<string | null>(null);
  const [modelUploading, setModelUploading] = useState(false);

  async function uploadBackground(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBgUploadError(null);
    if (!bgFile) {
      setBgUploadError("Select an image.");
      return;
    }
    const form = new FormData();
    form.append("image", bgFile);
    if (bgTitle.trim()) form.append("title", bgTitle.trim());
    if (bgTheme.trim()) form.append("theme", bgTheme.trim());
    if (bgTags.trim()) form.append("tags", parseTags(bgTags).join(","));

    setBgUploading(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/assets/backgrounds`, {
        method: "POST",
        body: form,
      });
      const data = (await resp.json()) as Asset | ApiError;
      if (!resp.ok) throw new Error("error" in data ? data.error : `Upload failed (${resp.status})`);
      setBgFile(null);
      setBgTitle("");
      setBgTheme("");
      setBgTags("");
      await refreshAssets();
    } catch (err: any) {
      setBgUploadError(err?.message || String(err));
    } finally {
      setBgUploading(false);
    }
  }

  async function uploadModel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setModelUploadError(null);
    if (!modelFile) {
      setModelUploadError("Select an image.");
      return;
    }
    const form = new FormData();
    form.append("image", modelFile);
    if (modelTitle.trim()) form.append("title", modelTitle.trim());
    if (modelAssetEthnicity.trim()) form.append("ethnicity", modelAssetEthnicity.trim());
    if (modelTags.trim()) form.append("tags", parseTags(modelTags).join(","));

    setModelUploading(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/api/assets/models`, {
        method: "POST",
        body: form,
      });
      const data = (await resp.json()) as Asset | ApiError;
      if (!resp.ok) throw new Error("error" in data ? data.error : `Upload failed (${resp.status})`);
      setModelFile(null);
      setModelTitle("");
      setModelAssetEthnicity("");
      setModelTags("");
      await refreshAssets();
    } catch (err: any) {
      setModelUploadError(err?.message || String(err));
    } finally {
      setModelUploading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="title titleLarge">Fashion image Gen</h1>
          <p className="subtitle">
            Upload a garment image → auto-pick (or invent) model/background → generate a photorealistic look.
          </p>
        </div>
        <div className="badge">
          <span>API</span>
          <code>{apiBaseUrl}</code>
        </div>
      </div>

      <div className="tabRow">
        <div className="tabGroup" role="tablist" aria-label="Sections">
          <button
            type="button"
            onClick={() => setActiveTab("generate")}
            className={`tabButton ${activeTab === "generate" ? "tabButtonActive" : ""}`}
            role="tab"
            aria-selected={activeTab === "generate"}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`tabButton ${activeTab === "assets" ? "tabButtonActive" : ""}`}
            role="tab"
            aria-selected={activeTab === "assets"}
          >
            Assets
          </button>
        </div>
        <span className="muted">
          Backend must have <code>GEMINI_API_KEY</code> set.
        </span>
      </div>

      {activeTab === "generate" ? (
        <div className="grid">
          <div className="card">
            <form onSubmit={onGenerateLook}>
              <div>
                <FieldLabel
                  htmlFor="garmentPhoto"
                  label="Garment photo"
                  info="Upload the garment image you want to place on a model. The generator will preserve the garment silhouette and create a photorealistic ecommerce scene around it."
                />
                <input
                  id="garmentPhoto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGarmentPhoto(e.target.files?.[0] ?? null)}
                />
              </div>

              <div style={{ height: 12 }} />

              <div className="sectionTitle">Creative Direction</div>

              <div>
                <FieldLabel
                  label="Occasion (optional)"
                  info="Sets the vibe for styling and scene (lighting, accessories, background mood). Pick a preset and optionally add extra detail (e.g., “sunset beach”, “nightclub”, “wedding guest”)."
                />
                <PillRadioGroup
                  name="occasion"
                  value={occasionPreset}
                  onChange={setOccasionPreset}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "beachwear", label: "Beachwear" },
                    { value: "party wear", label: "Party wear" },
                    { value: "evening", label: "Evening" },
                    { value: "casual", label: "Casual" },
                    { value: "workwear", label: "Workwear" },
                    { value: "wedding guest", label: "Wedding" },
                    { value: "athleisure", label: "Athleisure" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
                <div style={{ height: 10 }} />
                <input
                  type="text"
                  value={occasionDetails}
                  onChange={(e) => setOccasionDetails(e.target.value)}
                  placeholder="Optional: add details or type a custom occasion"
                />
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <FieldLabel
                    label="Color scheme (optional)"
                    info="The overall color palette you want the model + background to lean into. This helps the generator choose complementary lighting and scene colors (e.g., “pastel”, “neutral”, “red & white”, “monochrome”)."
                  />
                  <input
                    type="text"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    placeholder="e.g. red & white, pastel, neutral, monochrome"
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Accessories (optional)"
                    info="Optional add-ons to make the scene feel complete (e.g., sunglasses, tote bag, heels). Keep it realistic and not too many items."
                  />
                  <input
                    type="text"
                    value={accessories}
                    onChange={(e) => setAccessories(e.target.value)}
                    placeholder="comma separated, e.g. straw hat, sandals"
                  />
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div>
                <FieldLabel
                  label="Style keywords (optional)"
                  info="A few words describing the aesthetic. This influences pose, lighting, props, and overall styling (e.g., minimal, luxury, streetwear). Choose a direction and optionally add extra keywords."
                />
                <PillRadioGroup
                  name="styleKeywords"
                  value={stylePreset}
                  onChange={setStylePreset}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "minimal", label: "Minimal" },
                    { value: "streetwear", label: "Streetwear" },
                    { value: "luxe", label: "Luxury" },
                    { value: "boho", label: "Boho" },
                    { value: "vintage", label: "Vintage" },
                    { value: "sporty", label: "Sporty" },
                    { value: "romantic", label: "Romantic" },
                    { value: "edgy", label: "Edgy" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
                <div style={{ height: 10 }} />
                <input
                  type="text"
                  value={styleKeywordsDetails}
                  onChange={(e) => setStyleKeywordsDetails(e.target.value)}
                  placeholder="Optional: add keywords (comma separated)"
                />
              </div>

              <div style={{ height: 12 }} />

              <div className="divider" />

              <div style={{ height: 12 }} />

              <div className="sectionTitle">Background</div>

              <div>
                <FieldLabel
                  label="Background theme (optional)"
                  info="Describes the environment you want (e.g., studio, beach, rooftop, garden). Pick a preset and optionally add extra detail. If you select an uploaded background thumbnail below, that image will be used as the scene reference."
                />
                <PillRadioGroup
                  name="backgroundTheme"
                  value={backgroundThemePreset}
                  onChange={setBackgroundThemePreset}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "studio", label: "Studio" },
                    { value: "beach", label: "Beach" },
                    { value: "city street", label: "City" },
                    { value: "garden", label: "Garden" },
                    { value: "minimal", label: "Minimal" },
                    { value: "luxury", label: "Luxury" },
                    { value: "nightclub", label: "Nightlife" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
                <div style={{ height: 10 }} />
                <input
                  type="text"
                  value={backgroundThemeDetails}
                  onChange={(e) => setBackgroundThemeDetails(e.target.value)}
                  placeholder="Optional: add details (lighting, location, props)"
                />
              </div>

              <div style={{ height: 12 }} />

              <div>
                <FieldLabel
                  label="Background image (optional)"
                  info="If you have uploaded backgrounds, click a thumbnail to force a specific scene. Leave on Auto to let the generator invent a matching background."
                />
                {backgrounds.length > 0 ? (
                  <div className="thumbStrip">
                    <button
                      type="button"
                      className={`thumb ${!selectedBackgroundId ? "thumbSelected" : ""}`}
                      onClick={() => setSelectedBackgroundId("")}
                      aria-pressed={!selectedBackgroundId}
                      title="Auto background"
                    >
                      <div className="thumbPlaceholder">Auto</div>
                      <div className="thumbTitle">Auto</div>
                      <div className="thumbSubtitle">Invent / pick best</div>
                    </button>
                    {backgrounds.map((b) => {
                      const isSelected = selectedBackgroundId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          className={`thumb ${isSelected ? "thumbSelected" : ""}`}
                          onClick={() => setSelectedBackgroundId(b.id)}
                          aria-pressed={isSelected}
                          title={b.title}
                        >
                          <img src={joinUrl(apiBaseUrl, b.image_url)} alt={b.title} loading="lazy" />
                          <div className="thumbTitle">{b.title}</div>
                          <div className="thumbSubtitle">{b.theme || "Background"}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="muted">No uploaded backgrounds detected — the generator will invent one.</div>
                )}
              </div>

              <div style={{ height: 12 }} />

              <div className="divider" />

              <div style={{ height: 12 }} />

              <div className="sectionTitle">Model</div>

              <div>
                <FieldLabel
                  label="Model (optional)"
                  info="Use this to bias the generated model (ethnicity / vibe) when you are not selecting a specific uploaded model. Pick a preset and/or add your own description."
                />
                <PillRadioGroup
                  name="modelPreference"
                  value={modelPreset}
                  onChange={setModelPreset}
                  options={[
                    { value: "", label: "Auto" },
                    { value: "South Asian", label: "South Asian" },
                    { value: "East Asian", label: "East Asian" },
                    { value: "Black", label: "Black" },
                    { value: "White / European", label: "White / European" },
                    { value: "Middle Eastern", label: "Middle Eastern" },
                    { value: "Latina", label: "Latina" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
                <div style={{ height: 10 }} />
                <input
                  type="text"
                  value={modelDetails}
                  onChange={(e) => setModelDetails(e.target.value)}
                  placeholder="Optional: add model description (ethnicity, vibe, etc.)"
                />
              </div>

              <div style={{ height: 12 }} />

              <div>
                <FieldLabel
                  label="Model image (optional)"
                  info="If you have uploaded model references, click a thumbnail to use that exact identity/face/pose. Leave Auto to generate a suitable model."
                />
                {models.length > 0 ? (
                  <div className="thumbStrip">
                    <button
                      type="button"
                      className={`thumb ${!selectedModelId ? "thumbSelected" : ""}`}
                      onClick={() => setSelectedModelId("")}
                      aria-pressed={!selectedModelId}
                      title="Auto model"
                    >
                      <div className="thumbPlaceholder">Auto</div>
                      <div className="thumbTitle">Auto</div>
                      <div className="thumbSubtitle">Invent / pick best</div>
                    </button>
                    {models.map((m) => {
                      const isSelected = selectedModelId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`thumb ${isSelected ? "thumbSelected" : ""}`}
                          onClick={() => setSelectedModelId(m.id)}
                          aria-pressed={isSelected}
                          title={m.title}
                        >
                          <img src={joinUrl(apiBaseUrl, m.image_url)} alt={m.title} loading="lazy" />
                          <div className="thumbTitle">{m.title}</div>
                          <div className="thumbSubtitle">{m.ethnicity || "Model"}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="muted">No uploaded models detected — the generator will invent one.</div>
                )}
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <FieldLabel
                    label="Model styling notes (optional)"
                    info="Extra guidance for hair/makeup/jewelry and overall styling. Use short, clear notes like “natural makeup, minimal jewelry, hair up”."
                  />
                  <input
                    type="text"
                    value={modelStylingNotes}
                    onChange={(e) => setModelStylingNotes(e.target.value)}
                    placeholder="e.g. minimal jewelry, natural makeup, hair up"
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Debug (optional)"
                    info="When enabled, the backend returns internal prompt/plan details to help iterate on results."
                  />
                  <select
                    value={includeDebug ? "yes" : "no"}
                    onChange={(e) => setIncludeDebug(e.target.value === "yes")}
                  >
                    <option value="no">Off</option>
                    <option value="yes">On (return prompts)</option>
                  </select>
                </div>
              </div>

              <div className="actions">
                <button type="submit" className="btnPrimary" disabled={isGenerating}>
                  {isGenerating ? "Generating..." : "Generate look"}
                </button>
                <button
                  type="button"
                  className="btnSecondary"
                  onClick={() => void refreshAssets()}
                  disabled={isGenerating}
                >
                  Refresh assets
                </button>
              </div>

              {assetsError ? <div className="error">{assetsError}</div> : null}
              {generateError ? <div className="error">{generateError}</div> : null}

              {garmentPreviewUrl ? (
                <div className="preview">
                  <div>
                    <label>Garment preview</label>
                    <img src={garmentPreviewUrl} alt="Garment preview" />
                  </div>
                  <div>
                    <label>Selection preview</label>
                    <div className="muted">
                      {(selectedBackgroundId ? "Using selected background." : "Auto background.")}{" "}
                      {(selectedModelId ? "Using selected model." : "Auto model.")}
                    </div>
                  </div>
                </div>
              ) : null}

              {chosenSummary ? (
                <div style={{ marginTop: 12 }}>
                  <label>Chosen plan</label>
                  <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(chosenSummary, null, 2)}
                  </pre>
                </div>
              ) : null}

              {debugSummary ? (
                <div style={{ marginTop: 12 }}>
                  <label>Debug</label>
                  <pre className="muted" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(debugSummary, null, 2)}
                  </pre>
                </div>
              ) : null}
            </form>
          </div>

          <div className="card result">
            <FieldLabel
              label="Generated result"
              info="Your generated ecommerce scene will appear here. For best results, start with Auto settings and only lock in a background/model when you need consistency."
            />
            {isGenerating ? (
              <div className="resultPlaceholder">
                <div className="skeleton" style={{ height: 420 }} />
                <div style={{ height: 10 }} />
                <div className="skeleton" style={{ height: 14, width: "62%" }} />
              </div>
            ) : resultDataUrl ? (
              <>
                <div className="resultActions">
                  <div className="resultActionsLeft">
                    <a
                      className="btn btnSecondary"
                      href={resultDataUrl}
                      download={`look-${Date.now()}.${mimeToExtension(resultMimeType)}`}
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      className="btnGhost"
                      onClick={() => {
                        setResultDataUrl(null);
                        setResultMimeType(null);
                        setChosenSummary(null);
                        setDebugSummary(null);
                        setGenerateError(null);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="muted">Tip: use “Debug” to inspect prompts.</div>
                </div>
                <img src={resultDataUrl} alt="Generated look" />
              </>
            ) : (
              <div className="resultPlaceholder resultEmpty">
                <div>
                  <div className="resultEmptyTitle">Ready when you are</div>
                  <div className="muted">Upload a garment photo, then click “Generate look”.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid">
          <div className="card">
            <h2 className="title" style={{ fontSize: 16, marginTop: 0 }}>
              Upload background
            </h2>
            <form onSubmit={uploadBackground}>
              <div>
                <FieldLabel
                  label="Image"
                  info="Upload a background reference image (e.g., studio wall, beach, garden). You can select it from the Generate tab via thumbnails."
                />
                <input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ height: 12 }} />
              <div className="row">
                <div>
                  <FieldLabel
                    label="Title (optional)"
                    info="A short name to recognize this background."
                  />
                  <input value={bgTitle} onChange={(e) => setBgTitle(e.target.value)} type="text" />
                </div>
                <div>
                  <FieldLabel
                    label="Theme (recommended)"
                    info="A theme tag (e.g., beach, party, studio). The generator can use this when auto-planning a look."
                  />
                  <input value={bgTheme} onChange={(e) => setBgTheme(e.target.value)} type="text" placeholder="beach, party, forest..." />
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div>
                <FieldLabel
                  label="Tags (optional)"
                  info="Extra tags to help categorize assets. Use commas."
                />
                <input value={bgTags} onChange={(e) => setBgTags(e.target.value)} type="text" placeholder="comma separated" />
              </div>
              <div className="actions">
                <button type="submit" className="btnPrimary" disabled={bgUploading}>
                  {bgUploading ? "Uploading..." : "Upload background"}
                </button>
              </div>
              {bgUploadError ? <div className="error">{bgUploadError}</div> : null}
            </form>
          </div>

          <div className="card">
            <h2 className="title" style={{ fontSize: 16, marginTop: 0 }}>
              Upload model
            </h2>
            <form onSubmit={uploadModel}>
              <div>
                <FieldLabel
                  label="Image"
                  info="Upload a model reference image to keep the same identity/face/pose across generations."
                />
                <input type="file" accept="image/*" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ height: 12 }} />
              <div className="row">
                <div>
                  <FieldLabel
                    label="Title (optional)"
                    info="A short name to recognize this model."
                  />
                  <input value={modelTitle} onChange={(e) => setModelTitle(e.target.value)} type="text" />
                </div>
                <div>
                  <FieldLabel
                    label="Ethnicity (recommended)"
                    info="Helps the generator auto-pick diversity when no explicit model is selected."
                  />
                  <input value={modelAssetEthnicity} onChange={(e) => setModelAssetEthnicity(e.target.value)} type="text" placeholder="Indian, Russian..." />
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div>
                <FieldLabel
                  label="Tags (optional)"
                  info="Extra tags to help categorize assets. Use commas."
                />
                <input value={modelTags} onChange={(e) => setModelTags(e.target.value)} type="text" placeholder="comma separated" />
              </div>
              <div className="actions">
                <button type="submit" className="btnPrimary" disabled={modelUploading}>
                  {modelUploading ? "Uploading..." : "Upload model"}
                </button>
              </div>
              {modelUploadError ? <div className="error">{modelUploadError}</div> : null}
            </form>
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 className="title" style={{ fontSize: 16, margin: 0 }}>
                  Current assets
                </h2>
                <div className="muted">
                  Backgrounds: {backgrounds.length} · Models: {models.length}
                </div>
              </div>
              <button type="button" className="btnSecondary" onClick={() => void refreshAssets()}>
                Refresh
              </button>
            </div>

            {assetsError ? <div className="error">{assetsError}</div> : null}

            <div style={{ height: 12 }} />

            <div className="grid">
              <div>
                <label>Backgrounds</label>
                <div className="preview">
                  {backgrounds.map((b) => (
                    <img
                      key={b.id}
                      src={joinUrl(apiBaseUrl, b.image_url)}
                      alt={b.title}
                      title={b.title}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label>Models</label>
                <div className="preview">
                  {models.map((m) => (
                    <img
                      key={m.id}
                      src={joinUrl(apiBaseUrl, m.image_url)}
                      alt={m.title}
                      title={m.title}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

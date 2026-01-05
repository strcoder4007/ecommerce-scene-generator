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

  const [occasion, setOccasion] = useState("");
  const [colorScheme, setColorScheme] = useState("");
  const [printStyle, setPrintStyle] = useState("");
  const [backgroundTheme, setBackgroundTheme] = useState("");
  const [modelEthnicity, setModelEthnicity] = useState("");
  const [modelStylingNotes, setModelStylingNotes] = useState("");
  const [styleKeywords, setStyleKeywords] = useState("");
  const [accessories, setAccessories] = useState("");
  const [includeDebug, setIncludeDebug] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);
  const [chosenSummary, setChosenSummary] = useState<any>(null);
  const [debugSummary, setDebugSummary] = useState<any>(null);

  async function onGenerateLook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerateError(null);
    setResultDataUrl(null);
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

    if (occasion.trim()) form.append("occasion", occasion.trim());
    if (colorScheme.trim()) form.append("color_scheme", colorScheme.trim());
    if (printStyle.trim()) form.append("print_style", printStyle.trim());
    if (backgroundTheme.trim()) form.append("background_theme", backgroundTheme.trim());
    if (modelEthnicity.trim()) form.append("model_ethnicity", modelEthnicity.trim());
    if (modelStylingNotes.trim()) form.append("model_styling_notes", modelStylingNotes.trim());
    if (styleKeywords.trim()) form.append("style_keywords", styleKeywords.trim());
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
          <h1 className="title">Ecommerce Scene Generator</h1>
          <p className="subtitle">
            Upload a garment image → auto-pick (or invent) model/background → generate a photorealistic look.
          </p>
        </div>
        <div className="muted">API: {apiBaseUrl}</div>
      </div>

      <div className="actions" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab("generate")}
          disabled={activeTab === "generate"}
        >
          Generate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("assets")}
          disabled={activeTab === "assets"}
        >
          Assets
        </button>
        <span className="muted">
          Backend must have <code>GEMINI_API_KEY</code> set.
        </span>
      </div>

      {activeTab === "generate" ? (
        <div className="grid">
          <div className="card">
            <form onSubmit={onGenerateLook}>
              <div>
                <label htmlFor="garmentPhoto">Garment photo</label>
                <input
                  id="garmentPhoto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGarmentPhoto(e.target.files?.[0] ?? null)}
                />
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <label>Occasion (optional)</label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="e.g. beachwear, party, evening"
                  />
                </div>
                <div>
                  <label>Color scheme (optional)</label>
                  <input
                    type="text"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    placeholder="e.g. red & white, pastel, neutral"
                  />
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <label>Print style (optional)</label>
                  <input
                    type="text"
                    value={printStyle}
                    onChange={(e) => setPrintStyle(e.target.value)}
                    placeholder="e.g. floral, stripes, solid"
                  />
                </div>
                <div>
                  <label>Style keywords (optional)</label>
                  <input
                    type="text"
                    value={styleKeywords}
                    onChange={(e) => setStyleKeywords(e.target.value)}
                    placeholder="comma separated, e.g. minimal, chic, summer"
                  />
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <label>Background theme (optional)</label>
                  <input
                    type="text"
                    value={backgroundTheme}
                    onChange={(e) => setBackgroundTheme(e.target.value)}
                    placeholder="e.g. beach, nightclub, garden"
                  />
                </div>
                <div>
                  <label>Model ethnicity (optional)</label>
                  <input
                    type="text"
                    value={modelEthnicity}
                    onChange={(e) => setModelEthnicity(e.target.value)}
                    placeholder="e.g. Indian, Russian"
                  />
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <label>Accessories (optional)</label>
                  <input
                    type="text"
                    value={accessories}
                    onChange={(e) => setAccessories(e.target.value)}
                    placeholder="comma separated, e.g. straw hat, sandals"
                  />
                </div>
                <div>
                  <label>Debug (optional)</label>
                  <select
                    value={includeDebug ? "yes" : "no"}
                    onChange={(e) => setIncludeDebug(e.target.value === "yes")}
                  >
                    <option value="no">Off</option>
                    <option value="yes">On (return prompts)</option>
                  </select>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="row">
                <div>
                  <label>Background (optional)</label>
                  <select
                    value={selectedBackgroundId}
                    onChange={(e) => setSelectedBackgroundId(e.target.value)}
                  >
                    <option value="">Auto</option>
                    {backgrounds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                        {b.theme ? ` (${b.theme})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Model (optional)</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                  >
                    <option value="">Auto</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                        {m.ethnicity ? ` (${m.ethnicity})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {backgrounds.length === 0 || models.length === 0 ? (
                <div className="muted" style={{ marginTop: 10 }}>
                  No uploaded assets detected — generation will invent a matching model/background from the garment.
                </div>
              ) : null}

              <div style={{ height: 12 }} />

              <div>
                <label>Model styling notes (optional)</label>
                <input
                  type="text"
                  value={modelStylingNotes}
                  onChange={(e) => setModelStylingNotes(e.target.value)}
                  placeholder="e.g. minimal jewelry, natural makeup, hair up"
                />
              </div>

              <div className="actions">
                <button type="submit" disabled={isGenerating}>
                  {isGenerating ? "Generating..." : "Generate look"}
                </button>
                <button type="button" onClick={() => void refreshAssets()} disabled={isGenerating}>
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
                    <label>Selected assets (preview)</label>
                    <div className="muted">
                      {selectedBackgroundId || selectedModelId
                        ? "Using selected background/model."
                        : "Auto-picking background/model."}
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
            <label>Generated result</label>
            {resultDataUrl ? (
              <img src={resultDataUrl} alt="Generated look" />
            ) : (
              <div className="muted">No output yet.</div>
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
                <label>Image</label>
                <input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ height: 12 }} />
              <div className="row">
                <div>
                  <label>Title (optional)</label>
                  <input value={bgTitle} onChange={(e) => setBgTitle(e.target.value)} type="text" />
                </div>
                <div>
                  <label>Theme (recommended)</label>
                  <input value={bgTheme} onChange={(e) => setBgTheme(e.target.value)} type="text" placeholder="beach, party, forest..." />
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div>
                <label>Tags (optional)</label>
                <input value={bgTags} onChange={(e) => setBgTags(e.target.value)} type="text" placeholder="comma separated" />
              </div>
              <div className="actions">
                <button type="submit" disabled={bgUploading}>
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
                <label>Image</label>
                <input type="file" accept="image/*" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
              </div>
              <div style={{ height: 12 }} />
              <div className="row">
                <div>
                  <label>Title (optional)</label>
                  <input value={modelTitle} onChange={(e) => setModelTitle(e.target.value)} type="text" />
                </div>
                <div>
                  <label>Ethnicity (recommended)</label>
                  <input value={modelAssetEthnicity} onChange={(e) => setModelAssetEthnicity(e.target.value)} type="text" placeholder="Indian, Russian..." />
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div>
                <label>Tags (optional)</label>
                <input value={modelTags} onChange={(e) => setModelTags(e.target.value)} type="text" placeholder="comma separated" />
              </div>
              <div className="actions">
                <button type="submit" disabled={modelUploading}>
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
              <button type="button" onClick={() => void refreshAssets()}>
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

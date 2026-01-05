import { type FormEvent, useMemo, useState } from "react";

type VtoResponse =
  | { mime_type: string; image_base64: string }
  | { error: string };

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
}

export default function App() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const endpoint = `${apiBaseUrl}/api/virtual-try-on`;

  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [garmentPhoto, setGarmentPhoto] = useState<File | null>(null);
  const [garmentName, setGarmentName] = useState("");
  const [garmentCategory, setGarmentCategory] = useState("");
  const [garmentGender, setGarmentGender] = useState("");
  const [garmentBrand, setGarmentBrand] = useState("");
  const [garmentColor, setGarmentColor] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null);

  const userPreviewUrl = useMemo(
    () => (userPhoto ? URL.createObjectURL(userPhoto) : null),
    [userPhoto],
  );
  const garmentPreviewUrl = useMemo(
    () => (garmentPhoto ? URL.createObjectURL(garmentPhoto) : null),
    [garmentPhoto],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResultDataUrl(null);

    if (!userPhoto || !garmentPhoto) {
      setError("Please select both a person photo and a garment photo.");
      return;
    }

    const form = new FormData();
    form.append("user_photo", userPhoto);
    form.append("garment_photo", garmentPhoto);

    if (garmentName.trim()) form.append("garment_name", garmentName.trim());
    if (garmentCategory.trim()) form.append("garment_category", garmentCategory.trim());
    if (garmentGender.trim()) form.append("garment_gender", garmentGender.trim());
    if (garmentBrand.trim()) form.append("garment_brand", garmentBrand.trim());
    if (garmentColor.trim()) form.append("garment_color", garmentColor.trim());

    setIsLoading(true);
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        body: form,
      });

      const data = (await resp.json()) as VtoResponse;
      if (!resp.ok) {
        setError("error" in data ? data.error : `Request failed (${resp.status})`);
        return;
      }

      if ("error" in data) {
        setError(data.error);
        return;
      }

      setResultDataUrl(`data:${data.mime_type};base64,${data.image_base64}`);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="title">Virtual Try-On (Nano Banana / Gemini)</h1>
          <p className="subtitle">
            Upload a person photo + a garment photo, then generate a try-on image.
          </p>
        </div>
        <div className="muted">API: {apiBaseUrl}</div>
      </div>

      <div className="grid">
        <div className="card">
          <form onSubmit={onSubmit}>
            <div className="row">
              <div>
                <label htmlFor="userPhoto">Person photo</label>
                <input
                  id="userPhoto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setUserPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label htmlFor="garmentPhoto">Garment photo</label>
                <input
                  id="garmentPhoto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGarmentPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="row">
              <div>
                <label>Garment name (optional)</label>
                <input
                  type="text"
                  value={garmentName}
                  onChange={(e) => setGarmentName(e.target.value)}
                  placeholder="e.g. Summer dress"
                />
              </div>
              <div>
                <label>Brand (optional)</label>
                <input
                  type="text"
                  value={garmentBrand}
                  onChange={(e) => setGarmentBrand(e.target.value)}
                  placeholder="e.g. ACME"
                />
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="row">
              <div>
                <label>Category (optional)</label>
                <input
                  type="text"
                  value={garmentCategory}
                  onChange={(e) => setGarmentCategory(e.target.value)}
                  placeholder="e.g. dress, top, jacket"
                />
              </div>
              <div>
                <label>Color (optional)</label>
                <input
                  type="text"
                  value={garmentColor}
                  onChange={(e) => setGarmentColor(e.target.value)}
                  placeholder="e.g. red, floral, blue"
                />
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="row">
              <div>
                <label>Gender (optional)</label>
                <input
                  type="text"
                  value={garmentGender}
                  onChange={(e) => setGarmentGender(e.target.value)}
                  placeholder="e.g. womens, mens, unisex"
                />
              </div>
              <div />
            </div>

            <div className="actions">
              <button type="submit" disabled={isLoading}>
                {isLoading ? "Generating..." : "Generate try-on"}
              </button>
              <span className="muted">
                Backend must have <code>GEMINI_API_KEY</code> set.
              </span>
            </div>

            {error ? <div className="error">{error}</div> : null}

            {(userPreviewUrl || garmentPreviewUrl) && (
              <div className="preview">
                {userPreviewUrl ? (
                  <div>
                    <label>Person preview</label>
                    <img src={userPreviewUrl} alt="Person preview" />
                  </div>
                ) : null}
                {garmentPreviewUrl ? (
                  <div>
                    <label>Garment preview</label>
                    <img src={garmentPreviewUrl} alt="Garment preview" />
                  </div>
                ) : null}
              </div>
            )}
          </form>
        </div>

        <div className="card result">
          <label>Generated result</label>
          {resultDataUrl ? (
            <img src={resultDataUrl} alt="Generated try-on" />
          ) : (
            <div className="muted">
              No output yet. Upload images and click Generate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

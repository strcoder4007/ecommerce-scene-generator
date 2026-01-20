export function parseTags(raw: string): string[] {
  return (raw || "")
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

export function normalizeHexColor(value: string): string | null {
  const raw = (value || "").trim();
  if (!raw) return null;

  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const expanded = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  return null;
}

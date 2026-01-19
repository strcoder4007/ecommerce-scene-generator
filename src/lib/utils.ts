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


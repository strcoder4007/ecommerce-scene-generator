import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs/promises";
import path from "node:path";

function extensionFromMime(mimeType) {
  const mt = (mimeType || "").toLowerCase();
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  return "bin";
}

export async function createStorageClient() {
  const backend = (process.env.STORAGE_BACKEND || "").trim().toLowerCase();
  const connectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || "").trim();
  const useLocal =
    backend === "local" ||
    backend === "filesystem" ||
    backend === "file" ||
    (!backend && !connectionString);

  if (useLocal) {
    const rawDir = (process.env.LOCAL_STORAGE_DIR || "uploads").trim();
    const localDir = path.isAbsolute(rawDir) ? rawDir : path.join(process.cwd(), rawDir);
    await fs.mkdir(localDir, { recursive: true });

    let publicPath = (process.env.LOCAL_STORAGE_PUBLIC_PATH || "/uploads").trim();
    if (!publicPath.startsWith("/")) publicPath = `/${publicPath}`;
    publicPath = publicPath.replace(/\/+$/, "");

    const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
    const urlBase = publicBaseUrl ? `${publicBaseUrl}${publicPath}` : publicPath;

    function normalizePrefix(prefix) {
      const cleaned = (prefix || "images")
        .toString()
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      return cleaned || "images";
    }

    async function uploadImage({ buffer, mimeType, prefix }) {
      const safePrefix = normalizePrefix(prefix);
      const ext = extensionFromMime(mimeType);
      const ts = Date.now();
      const fileName = `${ts}-${uuidv4()}.${ext}`;
      const dirPath = path.join(localDir, safePrefix);
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, fileName);
      await fs.writeFile(filePath, buffer);
      return {
        url: `${urlBase}/${safePrefix}/${fileName}`,
        blobName: `${safePrefix}/${fileName}`,
      };
    }

    return { uploadImage, containerName: "local", backend: "local", localDir, publicPath };
  }

  if (!connectionString) {
    throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING.");
  }

  const containerName = process.env.AZURE_STORAGE_CONTAINER || "images";

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: "blob" });

  async function uploadImage({ buffer, mimeType, prefix }) {
    const ext = extensionFromMime(mimeType);
    const ts = Date.now();
    const blobName = `${prefix}/${ts}-${uuidv4()}.${ext}`;
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        blobCacheControl: "public, max-age=31536000, immutable",
      },
    });
    return { url: blobClient.url, blobName };
  }

  return { uploadImage, containerName, backend: "azure" };
}

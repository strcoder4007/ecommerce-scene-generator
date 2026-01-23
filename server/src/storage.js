import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

function extensionFromMime(mimeType) {
  const mt = (mimeType || "").toLowerCase();
  if (mt.includes("png")) return "png";
  if (mt.includes("webp")) return "webp";
  if (mt.includes("jpeg") || mt.includes("jpg")) return "jpg";
  return "bin";
}

export async function createStorageClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
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

  return { uploadImage, containerName };
}

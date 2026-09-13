import { getStoredToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UploadMediaResult {
  status: string;
  url: string;
  secure_url: string;
  public_id?: string;
  name: string;
  size: string;
  bytes: number;
  type: "image" | "file";
  format?: string;
}

/**
 * Uploads a file (photo, document, audio) to Cloudinary via the backend API Gateway.
 */
export async function uploadMedia(
  file: File,
  folder: string = "fluxchat/media",
  token?: string
): Promise<UploadMediaResult> {
  const authToken = token || getStoredToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}/api/v1/media/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload media to Cloudinary.");
  }

  return response.json();
}

/**
 * Uploads a base64 / data URI string directly to Cloudinary.
 */
export async function uploadBase64(
  dataUri: string,
  filename: string = "image.jpg",
  folder: string = "fluxchat/media",
  token?: string
): Promise<UploadMediaResult> {
  const authToken = token || getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}/api/v1/media/upload-base64`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      data_uri: dataUri,
      filename,
      folder,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to process image.");
  }

  return response.json();
}

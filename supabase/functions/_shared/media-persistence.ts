/**
 * Shared media persistence utilities for WhatsApp webhooks.
 * Downloads media from provider URLs (ephemeral) and uploads to Supabase Storage (permanent).
 */

export function getExtFromMime(mime: string, fallbackType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/ogg; codecs=opus": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/webm": ".webm",
    "audio/amr": ".amr",
    "audio/3gpp": ".3gp",
    "video/mp4": ".mp4",
    "video/3gpp": ".3gp",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  // Normalize mime (some have params like codecs=opus)
  const baseMime = mime.split(";")[0].trim().toLowerCase();
  if (map[baseMime]) return map[baseMime];
  if (map[mime]) return map[mime];
  const typeMap: Record<string, string> = { image: ".jpg", audio: ".ogg", video: ".mp4", document: ".bin" };
  return typeMap[fallbackType] || ".bin";
}

export async function downloadAndUploadMedia(
  supabase: any,
  mediaUrl: string,
  tenantId: string,
  conversationId: string,
  mediaType: string,
  providerMimeType?: string,
): Promise<{ storedUrl: string; mimeType: string } | null> {
  if (!mediaUrl) return null;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    console.log(`[media-persistence] Downloading: ${mediaUrl.substring(0, 120)}...`);
    const resp = await fetch(mediaUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.error(`[media-persistence] Download failed: HTTP ${resp.status} from ${mediaUrl.substring(0, 120)}`);
      return null;
    }

    const downloadedContentType = resp.headers.get("content-type") || "application/octet-stream";
    // Use provider-reported MIME if available and the download returned a generic type
    const contentType = (providerMimeType && downloadedContentType === "application/octet-stream")
      ? providerMimeType
      : downloadedContentType;

    const blob = await resp.blob();
    const elapsed = Date.now() - startTime;
    
    if (blob.size === 0) {
      console.error("[media-persistence] Downloaded file is empty, skipping upload");
      return null;
    }

    const ext = getExtFromMime(contentType, mediaType);
    const fileName = `${tenantId}/${conversationId}/${crypto.randomUUID()}${ext}`;

    console.log(`[media-persistence] Uploading to chat-media/${fileName} (${blob.size} bytes, ${contentType}, ${elapsed}ms download)`);

    const { error: uploadErr } = await supabase.storage
      .from("chat-media")
      .upload(fileName, blob, { contentType, upsert: false });

    if (uploadErr) {
      console.error("[media-persistence] Storage upload error:", uploadErr.message);
      return null;
    }

    const { data: publicData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
    console.log(`[media-persistence] Persisted: ${publicData.publicUrl.substring(0, 80)}... (total ${Date.now() - startTime}ms)`);
    return { storedUrl: publicData.publicUrl, mimeType: contentType };
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error("[media-persistence] Download timed out after 20s");
    } else {
      console.error("[media-persistence] Error:", e.message);
    }
    return null;
  }
}

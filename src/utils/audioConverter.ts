/**
 * Converts an audio Blob (WebM/OGG) to MP3 using lamejs.
 * Used for official WhatsApp instances (Gupshup) that require MP3 format.
 */
export async function convertBlobToMp3(blob: Blob): Promise<Blob> {
  // Dynamically import lamejs to avoid bundle issues
  const lamejs = await import("lamejs");

  // Decode audio using Web Audio API
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get PCM samples from left channel (mono)
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const samples = audioBuffer.getChannelData(0);

  // Convert Float32 samples to Int16
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Encode to MP3
  const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Data: ArrayBuffer[] = [];

  // Process in chunks of 1152 samples
  const chunkSize = 1152;
  for (let i = 0; i < int16Samples.length; i += chunkSize) {
    const chunk = int16Samples.subarray(i, i + chunkSize);
    const mp3buf = mp3Encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf).buffer as ArrayBuffer);
    }
  }

  // Flush remaining
  const mp3End = mp3Encoder.flush();
  if (mp3End.length > 0) {
    mp3Data.push(new Uint8Array(mp3End).buffer as ArrayBuffer);
  }

  await audioContext.close();

  return new Blob(mp3Data, { type: "audio/mpeg" });
}

/**
 * Check if an instance is official (Gupshup/Meta) and requires MP3 format.
 */
export function isOfficialInstance(providerCategory?: string): boolean {
  if (!providerCategory) return false;
  return providerCategory.startsWith("official");
}

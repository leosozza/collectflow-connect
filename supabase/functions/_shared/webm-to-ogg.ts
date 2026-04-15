/**
 * WebM (Opus) → OGG (Opus) remuxer — pure TypeScript, zero dependencies.
 * Extracts raw Opus packets from a WebM/Matroska container and wraps them
 * in an OGG container with proper OpusHead and OpusTags headers.
 */

// ── EBML / Matroska helpers ──

function readVint(data: Uint8Array, offset: number): [number, number] {
  if (offset >= data.length) throw new Error("Unexpected end of WebM data");
  const first = data[offset];
  let len = 0;
  for (let i = 0; i < 8; i++) {
    if (first & (0x80 >> i)) { len = i + 1; break; }
  }
  if (len === 0) throw new Error("Invalid VINT at offset " + offset);
  let value = first & ((1 << (8 - len)) - 1);
  for (let i = 1; i < len; i++) {
    value = (value << 8) | data[offset + i];
  }
  return [value, len];
}

function findElement(data: Uint8Array, id: number, start: number, end: number): { dataStart: number; dataEnd: number } | null {
  let pos = start;
  while (pos < end) {
    const [elemId, idLen] = readVint(data, pos);
    pos += idLen;
    if (pos >= end) break;
    const [size, sizeLen] = readVint(data, pos);
    pos += sizeLen;
    const dataEnd = pos + size;
    if (elemId === id) return { dataStart: pos, dataEnd };
    pos = dataEnd;
  }
  return null;
}

function collectElements(data: Uint8Array, id: number, start: number, end: number): Array<{ dataStart: number; dataEnd: number }> {
  const results: Array<{ dataStart: number; dataEnd: number }> = [];
  let pos = start;
  while (pos < end) {
    const [elemId, idLen] = readVint(data, pos);
    pos += idLen;
    if (pos >= end) break;
    const [size, sizeLen] = readVint(data, pos);
    pos += sizeLen;
    const dataEnd = pos + size;
    if (elemId === id) results.push({ dataStart: pos, dataEnd });
    pos = dataEnd;
  }
  return results;
}

// ── OGG page builder ──

function crc32Ogg(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 24;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80000000 ? (crc << 1) ^ 0x04C11DB7 : crc << 1;
    }
  }
  return crc >>> 0;
}

let _serialNo = 0;

function buildOggPage(
  granulePos: bigint,
  serialNo: number,
  pageSeqNo: number,
  headerType: number,
  segments: Uint8Array[],
): Uint8Array {
  // Build segment table
  const segTable: number[] = [];
  for (const seg of segments) {
    let remaining = seg.length;
    while (remaining >= 255) { segTable.push(255); remaining -= 255; }
    segTable.push(remaining);
  }

  const headerSize = 27 + segTable.length;
  let bodySize = 0;
  for (const seg of segments) bodySize += seg.length;
  const page = new Uint8Array(headerSize + bodySize);
  const view = new DataView(page.buffer);

  // "OggS"
  page[0] = 0x4F; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53;
  page[4] = 0; // version
  page[5] = headerType;
  // granule position (64-bit LE)
  view.setUint32(6, Number(granulePos & 0xFFFFFFFFn), true);
  view.setUint32(10, Number((granulePos >> 32n) & 0xFFFFFFFFn), true);
  view.setUint32(14, serialNo, true);
  view.setUint32(18, pageSeqNo, true);
  // CRC placeholder
  view.setUint32(22, 0, true);
  page[26] = segTable.length;
  for (let i = 0; i < segTable.length; i++) page[27 + i] = segTable[i];

  let offset = headerSize;
  for (const seg of segments) {
    page.set(seg, offset);
    offset += seg.length;
  }

  // Compute CRC
  const crc = crc32Ogg(page);
  view.setUint32(22, crc, true);

  return page;
}

// ── Opus TOC byte parser ──

function getOpusFrameDuration(packet: Uint8Array): number {
  if (packet.length === 0) return 960;
  const toc = packet[0];
  const config = (toc >> 3) & 0x1F;
  // Mapping config → frame size in samples at 48kHz
  // configs 0-3: SILK NB, 4-7: SILK MB, 8-11: SILK WB, 12-13: Hybrid SWB/FB
  // 14-15: Hybrid SWB/FB, 16-19: CELT NB, 20-23: CELT WB, 24-27: CELT SWB, 28-31: CELT FB
  const frameSizes = [
    480, 960, 1920, 2880,   // 0-3: SILK NB
    480, 960, 1920, 2880,   // 4-7: SILK MB
    480, 960, 1920, 2880,   // 8-11: SILK WB
    480, 960,               // 12-13: Hybrid SWB
    480, 960,               // 14-15: Hybrid FB
    120, 240, 480, 960,     // 16-19: CELT NB
    120, 240, 480, 960,     // 20-23: CELT WB
    120, 240, 480, 960,     // 24-27: CELT SWB
    120, 240, 480, 960,     // 28-31: CELT FB
  ];
  const baseSize = frameSizes[config] ?? 960;
  const c = toc & 0x03;
  if (c === 0) return baseSize;          // 1 frame
  if (c === 1 || c === 2) return baseSize * 2; // 2 frames
  // c === 3: arbitrary number of frames
  if (packet.length < 2) return baseSize;
  const frameCount = packet[1] & 0x3F;
  return baseSize * frameCount;
}

// ── Main remuxer ──

export function remuxWebmToOgg(webmData: Uint8Array): Uint8Array {
  const SEGMENT_ID = 0x08538067 & 0x0FFFFFFF; // Matroska Segment = 0x18538067 but vint strips leading bits
  const CLUSTER_ID = 0x0F43B675; // 0x1F43B675
  const SIMPLE_BLOCK_ID = 0x23;
  const BLOCK_GROUP_ID = 0x20;
  const BLOCK_ID = 0x21;
  const TRACK_ENTRY_ID = 0x2E;
  const TRACKS_ID = 0x0654AE6B; // 0x1654AE6B
  const CODEC_ID_ELEM = 0x06;
  const TRACK_NUMBER_ELEM = 0x57;
  const AUDIO_ELEM = 0x61;
  const SAMPLING_FREQ_ELEM = 0x35;
  const CHANNELS_ELEM = 0x1F;

  // Parse top-level: skip EBML header, find Segment
  let pos = 0;
  // Skip EBML header
  const [ebmlId, ebmlIdLen] = readVint(webmData, pos);
  pos += ebmlIdLen;
  const [ebmlSize, ebmlSizeLen] = readVint(webmData, pos);
  pos += ebmlSizeLen + ebmlSize;

  // Segment
  const [segId, segIdLen] = readVint(webmData, pos);
  pos += segIdLen;
  const [segSize, segSizeLen] = readVint(webmData, pos);
  pos += segSizeLen;
  const segStart = pos;
  const segEnd = Math.min(pos + segSize, webmData.length);

  // Find Tracks to get sample rate and channels
  let sampleRate = 48000;
  let channels = 1;
  let opusTrackNum = 1;

  const tracks = findElement(webmData, TRACKS_ID, segStart, segEnd);
  if (tracks) {
    const entries = collectElements(webmData, TRACK_ENTRY_ID, tracks.dataStart, tracks.dataEnd);
    for (const entry of entries) {
      const codecEl = findElement(webmData, CODEC_ID_ELEM, entry.dataStart, entry.dataEnd);
      if (codecEl) {
        const codecStr = new TextDecoder().decode(webmData.slice(codecEl.dataStart, codecEl.dataEnd));
        if (codecStr === "A_OPUS") {
          const trackNumEl = findElement(webmData, TRACK_NUMBER_ELEM, entry.dataStart, entry.dataEnd);
          if (trackNumEl) {
            opusTrackNum = webmData[trackNumEl.dataStart];
          }
          const audioEl = findElement(webmData, AUDIO_ELEM, entry.dataStart, entry.dataEnd);
          if (audioEl) {
            const srEl = findElement(webmData, SAMPLING_FREQ_ELEM, audioEl.dataStart, audioEl.dataEnd);
            if (srEl) {
              const buf = new ArrayBuffer(8);
              const bytes = new Uint8Array(buf);
              const len = srEl.dataEnd - srEl.dataStart;
              for (let i = 0; i < len && i < 8; i++) bytes[7 - i] = webmData[srEl.dataStart + (len - 1 - i)];
              sampleRate = new DataView(buf).getFloat64(0);
            }
            const chEl = findElement(webmData, CHANNELS_ELEM, audioEl.dataStart, audioEl.dataEnd);
            if (chEl) {
              channels = webmData[chEl.dataStart];
            }
          }
          break;
        }
      }
    }
  }

  // Extract Opus packets from SimpleBlock/Block elements in Clusters
  const opusPackets: Uint8Array[] = [];
  const clusters = collectElements(webmData, CLUSTER_ID, segStart, segEnd);
  for (const cluster of clusters) {
    // SimpleBlocks
    const blocks = collectElements(webmData, SIMPLE_BLOCK_ID, cluster.dataStart, cluster.dataEnd);
    for (const block of blocks) {
      const trackNum = webmData[block.dataStart] & 0x7F;
      if (trackNum === opusTrackNum) {
        // Skip track number (1 byte vint) + timecode (2 bytes) + flags (1 byte)
        const packetStart = block.dataStart + 4;
        if (packetStart < block.dataEnd) {
          opusPackets.push(webmData.slice(packetStart, block.dataEnd));
        }
      }
    }
    // BlockGroups
    const groups = collectElements(webmData, BLOCK_GROUP_ID, cluster.dataStart, cluster.dataEnd);
    for (const group of groups) {
      const innerBlock = findElement(webmData, BLOCK_ID, group.dataStart, group.dataEnd);
      if (innerBlock) {
        const trackNum = webmData[innerBlock.dataStart] & 0x7F;
        if (trackNum === opusTrackNum) {
          const packetStart = innerBlock.dataStart + 4;
          if (packetStart < innerBlock.dataEnd) {
            opusPackets.push(webmData.slice(packetStart, innerBlock.dataEnd));
          }
        }
      }
    }
  }

  if (opusPackets.length === 0) {
    throw new Error("No Opus packets found in WebM data");
  }

  // Build OGG file
  const serialNo = ++_serialNo;
  const pages: Uint8Array[] = [];
  let pageSeq = 0;

  // Page 0: OpusHead
  const opusHead = new Uint8Array(19);
  const headView = new DataView(opusHead.buffer);
  // "OpusHead"
  const magic = new TextEncoder().encode("OpusHead");
  opusHead.set(magic, 0);
  opusHead[8] = 1; // version
  opusHead[9] = channels;
  headView.setUint16(10, 312, true); // pre-skip = 312 samples (standard Opus encoder delay)
  headView.setUint32(12, Math.round(sampleRate), true); // input sample rate
  headView.setUint16(16, 0, true); // output gain
  opusHead[18] = 0; // channel mapping family

  pages.push(buildOggPage(0n, serialNo, pageSeq++, 0x02, [opusHead])); // BOS

  // Page 1: OpusTags
  const vendor = new TextEncoder().encode("LovableRemux");
  const tagsSize = 8 + 4 + vendor.length + 4;
  const opusTags = new Uint8Array(tagsSize);
  const tagsView = new DataView(opusTags.buffer);
  opusTags.set(new TextEncoder().encode("OpusTags"), 0);
  tagsView.setUint32(8, vendor.length, true);
  opusTags.set(vendor, 12);
  tagsView.setUint32(12 + vendor.length, 0, true); // no user comments

  pages.push(buildOggPage(0n, serialNo, pageSeq++, 0x00, [opusTags]));

  // Audio pages: one packet per page with accurate granule positions
  let granulePos = 0n;
  for (let i = 0; i < opusPackets.length; i++) {
    granulePos += BigInt(getOpusFrameDuration(opusPackets[i]));
    const isLast = i === opusPackets.length - 1;
    pages.push(buildOggPage(
      granulePos, serialNo, pageSeq++,
      isLast ? 0x04 : 0x00,
      [opusPackets[i]],
    ));
  }

  // Concatenate all pages
  let totalSize = 0;
  for (const p of pages) totalSize += p.length;
  const result = new Uint8Array(totalSize);
  let off = 0;
  for (const p of pages) { result.set(p, off); off += p.length; }

  return result;
}

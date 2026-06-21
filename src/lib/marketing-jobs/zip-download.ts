/**
 * Minimal ZIP archive writer (stored entries, no compression).
 * Avoids adding a dependency for campaign package download.
 */

type ZipEntry = {
  path: string;
  content: string;
};

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]!;
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

function writeUint16LE(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

export function createZipArchive(entries: ZipEntry[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = encodeUtf8(entry.path);
    const contentBytes = encodeUtf8(entry.content);
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(30 + pathBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32LE(localView, 0, 0x04034b50);
    writeUint16LE(localView, 4, 20);
    writeUint16LE(localView, 6, 0);
    writeUint16LE(localView, 8, 0);
    writeUint16LE(localView, 10, 0);
    writeUint16LE(localView, 12, 0);
    writeUint32LE(localView, 14, checksum);
    writeUint32LE(localView, 18, contentBytes.length);
    writeUint32LE(localView, 22, contentBytes.length);
    writeUint16LE(localView, 26, pathBytes.length);
    writeUint16LE(localView, 28, 0);
    localHeader.set(pathBytes, 30);

    const centralHeader = new Uint8Array(46 + pathBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32LE(centralView, 0, 0x02014b50);
    writeUint16LE(centralView, 4, 20);
    writeUint16LE(centralView, 6, 20);
    writeUint16LE(centralView, 8, 0);
    writeUint16LE(centralView, 10, 0);
    writeUint16LE(centralView, 12, 0);
    writeUint16LE(centralView, 14, 0);
    writeUint32LE(centralView, 16, checksum);
    writeUint32LE(centralView, 20, contentBytes.length);
    writeUint32LE(centralView, 24, contentBytes.length);
    writeUint16LE(centralView, 28, pathBytes.length);
    writeUint16LE(centralView, 30, 0);
    writeUint16LE(centralView, 32, 0);
    writeUint16LE(centralView, 34, 0);
    writeUint16LE(centralView, 36, 0);
    writeUint32LE(centralView, 38, 0);
    writeUint32LE(centralView, 42, offset);
    centralHeader.set(pathBytes, 46);

    localParts.push(localHeader, contentBytes);
    centralParts.push(centralHeader);

    offset += localHeader.length + contentBytes.length;
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32LE(endView, 0, 0x06054b50);
  writeUint16LE(endView, 4, 0);
  writeUint16LE(endView, 6, 0);
  writeUint16LE(endView, 8, entries.length);
  writeUint16LE(endView, 10, entries.length);
  writeUint32LE(endView, 12, centralDirectorySize);
  writeUint32LE(endView, 16, offset);
  writeUint16LE(endView, 20, 0);

  const totalSize =
    localParts.reduce((sum, part) => sum + part.length, 0) +
    centralDirectorySize +
    endRecord.length;

  const archive = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, endRecord]) {
    archive.set(part, cursor);
    cursor += part.length;
  }

  return new Blob([archive], { type: 'application/zip' });
}

export function downloadZipArchive(entries: ZipEntry[], filename: string): void {
  const blob = createZipArchive(entries);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

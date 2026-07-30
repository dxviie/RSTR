// Minimal ZIP reader — the counterpart of the studio's writer
// ($lib/rstr2/zip), so the prep tool can swallow a frame-sequence zip
// directly. Reads the central directory and supports stored entries (what
// the studio writes) plus deflate via DecompressionStream, which covers
// zips produced by OS archivers too.

export interface ZipReadEntry {
	/** path inside the archive, forward slashes */
	name: string;
	data: Uint8Array;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * Parse a ZIP archive into its file entries (directories are skipped).
 * Throws on a malformed archive or an unsupported compression method.
 */
export const readZip = async (buf: Uint8Array): Promise<ZipReadEntry[]> => {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	// EOCD: scan backwards over a possible archive comment (max 64k)
	let eocd = -1;
	const scanEnd = Math.max(0, buf.length - 22 - 0xffff);
	for (let i = buf.length - 22; i >= scanEnd; i--) {
		if (view.getUint32(i, true) === EOCD_SIG) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('not a ZIP archive (no end-of-central-directory record)');
	const count = view.getUint16(eocd + 10, true);
	let cursor = view.getUint32(eocd + 16, true);

	const decoder = new TextDecoder();
	const entries: ZipReadEntry[] = [];
	for (let i = 0; i < count; i++) {
		if (view.getUint32(cursor, true) !== CENTRAL_SIG) {
			throw new Error('corrupt ZIP central directory');
		}
		const method = view.getUint16(cursor + 10, true);
		const compressedSize = view.getUint32(cursor + 20, true);
		const nameLen = view.getUint16(cursor + 28, true);
		const extraLen = view.getUint16(cursor + 30, true);
		const commentLen = view.getUint16(cursor + 32, true);
		const localOffset = view.getUint32(cursor + 42, true);
		const name = decoder.decode(buf.subarray(cursor + 46, cursor + 46 + nameLen));
		cursor += 46 + nameLen + extraLen + commentLen;

		if (name.endsWith('/')) continue; // directory entry
		// the local header repeats name/extra with its own (possibly
		// different) extra length — resolve the payload offset through it
		if (view.getUint32(localOffset, true) !== LOCAL_SIG) {
			throw new Error('corrupt ZIP local header');
		}
		const localNameLen = view.getUint16(localOffset + 26, true);
		const localExtraLen = view.getUint16(localOffset + 28, true);
		const dataStart = localOffset + 30 + localNameLen + localExtraLen;
		const raw = buf.subarray(dataStart, dataStart + compressedSize);
		if (method === 0) {
			entries.push({ name, data: raw });
		} else if (method === 8) {
			entries.push({ name, data: await inflateRaw(raw) });
		} else {
			throw new Error(`unsupported ZIP compression method ${method} for ${name}`);
		}
	}
	return entries;
};

/**
 * The SVG files the prep tool cares about inside a frame-sequence zip:
 * entries in the archive root or in an `svg/` subfolder (the studio's
 * layout when SVG and raster frames are exported together). Archiver junk
 * (`__MACOSX/`, dot-files) is ignored.
 */
export const zipSvgEntries = (entries: ZipReadEntry[]): ZipReadEntry[] =>
	entries.filter((entry) => {
		const parts = entry.name.replaceAll('\\', '/').split('/').filter(Boolean);
		const base = parts[parts.length - 1] ?? '';
		if (!/\.svg$/i.test(base) || base.startsWith('.')) return false;
		if (parts.length === 1) return true;
		return parts.length === 2 && parts[0].toLowerCase() === 'svg';
	});

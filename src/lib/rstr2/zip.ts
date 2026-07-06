// Minimal ZIP writer — stored entries only, no compression.
//
// Just enough to hand a frame sequence to the user as a single download
// without pulling in a dependency. PNG/JPEG/WebP payloads are already
// compressed and SVG shrinks little under deflate's stored cousin anyway;
// what matters here is one file instead of hundreds.

export interface ZipEntry {
	/** path inside the archive, forward slashes ('svg/frame-00001.svg') */
	name: string;
	data: Uint8Array;
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

export const crc32 = (data: Uint8Array): number => {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
};

/** MS-DOS timestamp pair used by the ZIP headers */
const dosDateTime = (date: Date): { time: number; date: number } => ({
	time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
	date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
});

/**
 * Assemble a ZIP archive from the given entries (stored, UTF-8 names).
 * Entries larger than 4GiB or archives with 65k+ files would need ZIP64 —
 * far beyond what a frame sequence produces, so not supported.
 */
export const buildZip = (entries: ZipEntry[], now: Date = new Date()): Uint8Array => {
	const encoder = new TextEncoder();
	const { time, date } = dosDateTime(now);

	interface Prepared {
		nameBytes: Uint8Array;
		data: Uint8Array;
		crc: number;
		offset: number;
	}

	const prepared: Prepared[] = [];
	let offset = 0;
	// local headers + payloads
	const localParts: Uint8Array[] = [];
	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.name);
		const crc = crc32(entry.data);
		const header = new Uint8Array(30 + nameBytes.length);
		const view = new DataView(header.buffer);
		view.setUint32(0, 0x04034b50, true); // local file header signature
		view.setUint16(4, 20, true); // version needed
		view.setUint16(6, 0x0800, true); // flags: UTF-8 names
		view.setUint16(8, 0, true); // method: stored
		view.setUint16(10, time, true);
		view.setUint16(12, date, true);
		view.setUint32(14, crc, true);
		view.setUint32(18, entry.data.length, true); // compressed size
		view.setUint32(22, entry.data.length, true); // uncompressed size
		view.setUint16(26, nameBytes.length, true);
		view.setUint16(28, 0, true); // extra field length
		header.set(nameBytes, 30);
		localParts.push(header, entry.data);
		prepared.push({ nameBytes, data: entry.data, crc, offset });
		offset += header.length + entry.data.length;
	}

	// central directory
	const centralParts: Uint8Array[] = [];
	let centralSize = 0;
	for (const entry of prepared) {
		const record = new Uint8Array(46 + entry.nameBytes.length);
		const view = new DataView(record.buffer);
		view.setUint32(0, 0x02014b50, true); // central directory signature
		view.setUint16(4, 20, true); // version made by
		view.setUint16(6, 20, true); // version needed
		view.setUint16(8, 0x0800, true); // flags: UTF-8 names
		view.setUint16(10, 0, true); // method: stored
		view.setUint16(12, time, true);
		view.setUint16(14, date, true);
		view.setUint32(16, entry.crc, true);
		view.setUint32(20, entry.data.length, true);
		view.setUint32(24, entry.data.length, true);
		view.setUint16(28, entry.nameBytes.length, true);
		// extra/comment/disk/attributes all zero
		view.setUint32(42, entry.offset, true); // local header offset
		record.set(entry.nameBytes, 46);
		centralParts.push(record);
		centralSize += record.length;
	}

	// end of central directory
	const eocd = new Uint8Array(22);
	const eocdView = new DataView(eocd.buffer);
	eocdView.setUint32(0, 0x06054b50, true);
	eocdView.setUint16(8, prepared.length, true); // entries on this disk
	eocdView.setUint16(10, prepared.length, true); // entries total
	eocdView.setUint32(12, centralSize, true);
	eocdView.setUint32(16, offset, true); // central directory offset

	const total = offset + centralSize + eocd.length;
	const out = new Uint8Array(total);
	let cursor = 0;
	for (const part of [...localParts, ...centralParts, eocd]) {
		out.set(part, cursor);
		cursor += part.length;
	}
	return out;
};

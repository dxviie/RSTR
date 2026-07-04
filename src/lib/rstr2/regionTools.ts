// Region geometry extraction for watershed segmentations.
//
// Traces the boundary of every region directly on the label grid using
// directed grid edges and numeric vertex keys — no string keys, no per-cell
// object allocation. Outer contours come out clockwise and holes
// counter-clockwise, so the default SVG nonzero fill rule renders holes
// correctly.

export interface RegionGeometry {
	id: number;
	size: number;
	/** bounding box in pixel space */
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	/** SVG path (pixel space) covering the region, holes included */
	d: string;
	/** closed contours as flat [x0, y0, x1, y1, ...] coordinate arrays (pixel space) */
	loops: Float64Array[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

// direction codes for unit edges on the vertex lattice: 0 = +x, 1 = +y, 2 = -x, 3 = -y
const dirOf = (from: number, to: number, vertexW: number): number => {
	const delta = to - from;
	if (delta === 1) return 0;
	if (delta === vertexW) return 1;
	if (delta === -1) return 2;
	return 3;
};

export const buildRegionGeometries = (
	labels: Int32Array,
	regionCount: number,
	gridW: number,
	gridH: number,
	cellW: number,
	cellH: number
): RegionGeometry[] => {
	const n = gridW * gridH;
	const vertexW = gridW + 1;

	// CSR-style cell lists per region
	const counts = new Int32Array(regionCount);
	for (let i = 0; i < n; i++) counts[labels[i]]++;
	const starts = new Int32Array(regionCount + 1);
	for (let r = 0; r < regionCount; r++) starts[r + 1] = starts[r] + counts[r];
	const cellIdx = new Int32Array(n);
	const fill = starts.slice(0, regionCount);
	for (let i = 0; i < n; i++) {
		cellIdx[fill[labels[i]]++] = i;
	}

	const geometries: RegionGeometry[] = new Array(regionCount);

	for (let r = 0; r < regionCount; r++) {
		// Directed boundary edges, keyed by start vertex. A vertex has at most
		// two outgoing boundary edges (only at diagonal pinch points).
		const edges = new Map<number, number[]>();
		const addEdge = (from: number, to: number) => {
			const ends = edges.get(from);
			if (ends) ends.push(to);
			else edges.set(from, [to]);
		};

		let minCX = gridW;
		let minCY = gridH;
		let maxCX = 0;
		let maxCY = 0;

		for (let c = starts[r]; c < starts[r + 1]; c++) {
			const i = cellIdx[c];
			const x = i % gridW;
			const y = (i / gridW) | 0;
			if (x < minCX) minCX = x;
			if (y < minCY) minCY = y;
			if (x > maxCX) maxCX = x;
			if (y > maxCY) maxCY = y;

			const v00 = y * vertexW + x;
			const v10 = v00 + 1;
			const v01 = v00 + vertexW;
			const v11 = v01 + 1;
			// Edges are directed so the region interior sits on the right-hand
			// side; out-of-bounds neighbours count as "different region".
			if (y === 0 || labels[i - gridW] !== r) addEdge(v00, v10); // top
			if (x === gridW - 1 || labels[i + 1] !== r) addEdge(v10, v11); // right
			if (y === gridH - 1 || labels[i + gridW] !== r) addEdge(v11, v01); // bottom
			if (x === 0 || labels[i - 1] !== r) addEdge(v01, v00); // left
		}

		// Trace closed loops, dropping collinear intermediate vertices.
		const loops: Float64Array[] = [];
		let d = '';
		while (edges.size > 0) {
			const start: number = edges.keys().next().value!;
			const pts: number[] = [];
			let current = start;
			let prevDir = -1;
			do {
				const ends = edges.get(current)!;
				let chosen = 0;
				if (ends.length > 1 && prevDir >= 0) {
					// At a pinch vertex, turn towards the interior so each loop
					// stays separate instead of merging into a figure-eight.
					const preferred = (prevDir + 1) % 4;
					for (let k = 0; k < ends.length; k++) {
						if (dirOf(current, ends[k], vertexW) === preferred) {
							chosen = k;
							break;
						}
					}
				}
				const next = ends[chosen];
				if (ends.length === 1) edges.delete(current);
				else ends.splice(chosen, 1);

				const dir = dirOf(current, next, vertexW);
				if (dir !== prevDir) {
					pts.push((current % vertexW) * cellW, ((current / vertexW) | 0) * cellH);
				}
				prevDir = dir;
				current = next;
			} while (current !== start);

			if (pts.length < 6) continue; // degenerate

			const loop = new Float64Array(pts);
			loops.push(loop);
			d += `M${round2(loop[0])} ${round2(loop[1])}`;
			for (let k = 2; k < loop.length; k += 2) {
				d += `L${round2(loop[k])} ${round2(loop[k + 1])}`;
			}
			d += 'Z';
		}

		geometries[r] = {
			id: r,
			size: counts[r],
			minX: minCX * cellW,
			minY: minCY * cellH,
			maxX: (maxCX + 1) * cellW,
			maxY: (maxCY + 1) * cellH,
			d,
			loops
		};
	}

	return geometries;
};

/** Mean of `values` per region label. */
export const meanPerRegion = (
	values: Float32Array,
	labels: Int32Array,
	regionCount: number
): Float32Array => {
	const sum = new Float64Array(regionCount);
	const count = new Int32Array(regionCount);
	for (let i = 0; i < labels.length; i++) {
		sum[labels[i]] += values[i];
		count[labels[i]]++;
	}
	const mean = new Float32Array(regionCount);
	for (let r = 0; r < regionCount; r++) {
		mean[r] = count[r] > 0 ? sum[r] / count[r] : 0;
	}
	return mean;
};

// Grid segmentation strategies for the RSTR v2 engine.
//
// All algorithms work on flat typed arrays over the cell grid and share the
// same post-processing (region merging, small-region absorption, compact
// relabeling), so they are interchangeable from the caller's point of view:
//
// - watershed: Meyer-style priority flood from gradient minima, followed by
//   tolerance-based merging on the region adjacency graph. Transition cells
//   along soft edges are assigned by value similarity, and leftover thin
//   "streak" regions with intermediate values are absorbed.
// - posterize: quantize intensities into 1/tolerance levels, then connected
//   component labeling. Blocky, banded look.
// - kmeans: 1D k-means clustering on intensity (k derived from tolerance),
//   then connected component labeling. Adaptive posterize.
// - slic: SLIC superpixels — localized k-means over (x, y, intensity) that
//   carves the grid into compact, roughly cell-size regions. Tolerance-based
//   merging then joins similar neighbouring superpixels, mosaic-style.

export type SegmentationAlgorithm = 'watershed' | 'posterize' | 'kmeans' | 'slic';

export interface SegmentationOptions {
	algorithm: SegmentationAlgorithm;
	/** 0..1 — value granularity: merge tolerance / level size / cluster count */
	tolerance: number;
	/** regions with fewer cells are absorbed into their most similar neighbour */
	minRegionSize: number;
	/** box-blur passes applied to the values before segmentation */
	smoothing: number;
	/** slic only — superpixel grid spacing in cells (default 8) */
	slicCellSize?: number;
	/** slic only — 0..1 spatial rigidity of the superpixels (default 0.5) */
	slicCompactness?: number;
}

export interface Segmentation {
	/** per-cell compact region label, 0..regionCount-1 */
	labels: Int32Array;
	regionCount: number;
	/** mean input value per region (0..1), indexed by label */
	regionMean: Float32Array;
	/** cell count per region, indexed by label */
	regionSize: Int32Array;
}

/** Binary min-heap keyed by (priority, insertion order) for a stable Meyer flood. */
class MinHeap {
	private prio: number[] = [];
	private seq: number[] = [];
	private idx: number[] = [];
	private counter = 0;

	get size(): number {
		return this.idx.length;
	}

	push(priority: number, index: number): void {
		this.prio.push(priority);
		this.seq.push(this.counter++);
		this.idx.push(index);
		let i = this.idx.length - 1;
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (!this.less(i, parent)) break;
			this.swap(i, parent);
			i = parent;
		}
	}

	pop(): number {
		const result = this.idx[0];
		const last = this.idx.length - 1;
		this.swap(0, last);
		this.prio.pop();
		this.seq.pop();
		this.idx.pop();
		let i = 0;
		for (;;) {
			const left = i * 2 + 1;
			const right = left + 1;
			let smallest = i;
			if (left < last && this.less(left, smallest)) smallest = left;
			if (right < last && this.less(right, smallest)) smallest = right;
			if (smallest === i) break;
			this.swap(i, smallest);
			i = smallest;
		}
		return result;
	}

	private less(a: number, b: number): boolean {
		return (
			this.prio[a] < this.prio[b] || (this.prio[a] === this.prio[b] && this.seq[a] < this.seq[b])
		);
	}

	private swap(a: number, b: number): void {
		let t = this.prio[a];
		this.prio[a] = this.prio[b];
		this.prio[b] = t;
		t = this.seq[a];
		this.seq[a] = this.seq[b];
		this.seq[b] = t;
		t = this.idx[a];
		this.idx[a] = this.idx[b];
		this.idx[b] = t;
	}
}

const boxBlur3 = (src: Float32Array, width: number, height: number): Float32Array => {
	const dst = new Float32Array(src.length);
	for (let y = 0; y < height; y++) {
		const y0 = y > 0 ? y - 1 : 0;
		const y1 = y < height - 1 ? y + 1 : height - 1;
		for (let x = 0; x < width; x++) {
			const x0 = x > 0 ? x - 1 : 0;
			const x1 = x < width - 1 ? x + 1 : width - 1;
			let sum = 0;
			let count = 0;
			for (let yy = y0; yy <= y1; yy++) {
				const row = yy * width;
				for (let xx = x0; xx <= x1; xx++) {
					sum += src[row + xx];
					count++;
				}
			}
			dst[y * width + x] = sum / count;
		}
	}
	return dst;
};

const gradientMagnitude = (values: Float32Array, width: number, height: number): Float32Array => {
	const gradient = new Float32Array(values.length);
	for (let y = 0; y < height; y++) {
		const yUp = y > 0 ? y - 1 : 0;
		const yDown = y < height - 1 ? y + 1 : height - 1;
		for (let x = 0; x < width; x++) {
			const xLeft = x > 0 ? x - 1 : 0;
			const xRight = x < width - 1 ? x + 1 : width - 1;
			const gx = values[y * width + xRight] - values[y * width + xLeft];
			const gy = values[yDown * width + x] - values[yUp * width + x];
			gradient[y * width + x] = Math.abs(gx) + Math.abs(gy);
		}
	}
	return gradient;
};

//***************************************************************
// 														WATERSHED
//***************************************************************

/**
 * Label every plateau-aware local minimum of the gradient with its own marker
 * and record the marker's characteristic value (mean over the plateau).
 * Cells that are not part of a minimum keep label -1.
 */
const findMinimaMarkers = (
	gradient: Float32Array,
	values: Float32Array,
	width: number,
	height: number,
	labels: Int32Array,
	markerValues: number[]
): number => {
	const n = gradient.length;
	const visited = new Uint8Array(n);
	const stack: number[] = [];
	const plateau: number[] = [];
	let labelCount = 0;

	for (let i = 0; i < n; i++) {
		if (visited[i]) continue;
		const g0 = gradient[i];
		visited[i] = 1;
		stack.length = 0;
		plateau.length = 0;
		stack.push(i);
		plateau.push(i);
		let isMinimum = true;

		while (stack.length > 0) {
			const c = stack.pop()!;
			const cx = c % width;
			// 4-neighbourhood
			for (let d = 0; d < 4; d++) {
				let nb = -1;
				if (d === 0 && cx > 0) nb = c - 1;
				else if (d === 1 && cx < width - 1) nb = c + 1;
				else if (d === 2 && c >= width) nb = c - width;
				else if (d === 3 && c < n - width) nb = c + width;
				if (nb < 0) continue;
				const gn = gradient[nb];
				if (gn < g0) {
					isMinimum = false;
				} else if (gn === g0 && !visited[nb]) {
					visited[nb] = 1;
					stack.push(nb);
					plateau.push(nb);
				}
			}
		}

		if (isMinimum) {
			const label = labelCount++;
			let sum = 0;
			for (let p = 0; p < plateau.length; p++) {
				labels[plateau[p]] = label;
				sum += values[plateau[p]];
			}
			markerValues.push(sum / plateau.length);
		}
	}
	return labelCount;
};

/**
 * Meyer's flooding: grow the markers outwards in order of increasing gradient.
 * Cells adopt the neighbouring basin whose seed value is closest to their own
 * value, so transition cells on soft edges split cleanly between both sides
 * instead of streaking along whichever basin reached them first.
 */
const flood = (
	gradient: Float32Array,
	values: Float32Array,
	width: number,
	height: number,
	labels: Int32Array,
	markerValues: number[]
): void => {
	const n = gradient.length;
	const heap = new MinHeap();
	const queued = new Uint8Array(n);

	const pushNeighbours = (i: number) => {
		const x = i % width;
		if (x > 0 && labels[i - 1] < 0 && !queued[i - 1]) {
			queued[i - 1] = 1;
			heap.push(gradient[i - 1], i - 1);
		}
		if (x < width - 1 && labels[i + 1] < 0 && !queued[i + 1]) {
			queued[i + 1] = 1;
			heap.push(gradient[i + 1], i + 1);
		}
		if (i >= width && labels[i - width] < 0 && !queued[i - width]) {
			queued[i - width] = 1;
			heap.push(gradient[i - width], i - width);
		}
		if (i < n - width && labels[i + width] < 0 && !queued[i + width]) {
			queued[i + width] = 1;
			heap.push(gradient[i + width], i + width);
		}
	};

	for (let i = 0; i < n; i++) {
		if (labels[i] >= 0) pushNeighbours(i);
	}

	while (heap.size > 0) {
		const i = heap.pop();
		if (labels[i] >= 0) continue;
		const v = values[i];
		const x = i % width;
		let best = -1;
		let bestDiff = Infinity;
		const consider = (nb: number) => {
			const label = labels[nb];
			if (label < 0) return;
			const diff = Math.abs(v - markerValues[label]);
			if (diff < bestDiff) {
				bestDiff = diff;
				best = label;
			}
		};
		if (x > 0) consider(i - 1);
		if (x < width - 1) consider(i + 1);
		if (i >= width) consider(i - width);
		if (i < n - width) consider(i + width);
		labels[i] = best;
		pushNeighbours(i);
	}
};

//***************************************************************
// 									POSTERIZE / K-MEANS + CCL
//***************************************************************

/** Connected component labeling over per-cell class ids (4-connectivity). */
const connectedComponents = (
	classes: Int32Array,
	width: number,
	height: number,
	labels: Int32Array
): number => {
	const n = classes.length;
	labels.fill(-1);
	const stack: number[] = [];
	let count = 0;

	for (let i = 0; i < n; i++) {
		if (labels[i] >= 0) continue;
		const cls = classes[i];
		const label = count++;
		labels[i] = label;
		stack.length = 0;
		stack.push(i);
		while (stack.length > 0) {
			const c = stack.pop()!;
			const cx = c % width;
			if (cx > 0 && labels[c - 1] < 0 && classes[c - 1] === cls) {
				labels[c - 1] = label;
				stack.push(c - 1);
			}
			if (cx < width - 1 && labels[c + 1] < 0 && classes[c + 1] === cls) {
				labels[c + 1] = label;
				stack.push(c + 1);
			}
			if (c >= width && labels[c - width] < 0 && classes[c - width] === cls) {
				labels[c - width] = label;
				stack.push(c - width);
			}
			if (c < n - width && labels[c + width] < 0 && classes[c + width] === cls) {
				labels[c + width] = label;
				stack.push(c + width);
			}
		}
	}
	return count;
};

const posterizeClasses = (values: Float32Array, tolerance: number): Int32Array => {
	const levels = Math.max(2, Math.min(64, Math.round(1 / Math.max(tolerance, 0.02))));
	const classes = new Int32Array(values.length);
	for (let i = 0; i < values.length; i++) {
		classes[i] = Math.min(levels - 1, Math.floor(values[i] * levels));
	}
	return classes;
};

const kmeansClasses = (values: Float32Array, tolerance: number): Int32Array => {
	const k = Math.max(2, Math.min(16, Math.round(1 / Math.max(tolerance, 0.05))));
	const n = values.length;

	// init centers from quantiles of a sorted sample
	const sampleSize = Math.min(n, 4096);
	const stride = Math.max(1, Math.floor(n / sampleSize));
	const sample: number[] = [];
	for (let i = 0; i < n; i += stride) sample.push(values[i]);
	sample.sort((a, b) => a - b);
	const centers = new Float64Array(k);
	for (let c = 0; c < k; c++) {
		centers[c] = sample[Math.min(sample.length - 1, Math.floor(((c + 0.5) / k) * sample.length))];
	}

	const classes = new Int32Array(n);
	const sums = new Float64Array(k);
	const counts = new Int32Array(k);
	for (let iter = 0; iter < 10; iter++) {
		sums.fill(0);
		counts.fill(0);
		for (let i = 0; i < n; i++) {
			const v = values[i];
			let best = 0;
			let bestDist = Math.abs(v - centers[0]);
			for (let c = 1; c < k; c++) {
				const dist = Math.abs(v - centers[c]);
				if (dist < bestDist) {
					bestDist = dist;
					best = c;
				}
			}
			classes[i] = best;
			sums[best] += v;
			counts[best]++;
		}
		let moved = false;
		for (let c = 0; c < k; c++) {
			if (counts[c] === 0) continue;
			const next = sums[c] / counts[c];
			if (Math.abs(next - centers[c]) > 1e-4) moved = true;
			centers[c] = next;
		}
		if (!moved) break;
	}

	// Consolidate converged centers that ended up closer than the tolerance —
	// otherwise a tight value clump split across two clusters fragments a flat
	// area into speckle.
	const order: number[] = [];
	for (let c = 0; c < k; c++) order.push(c);
	order.sort((a, b) => centers[a] - centers[b]);
	const remap = new Int32Array(k);
	let group = 0;
	remap[order[0]] = 0;
	for (let o = 1; o < k; o++) {
		if (centers[order[o]] - centers[order[o - 1]] >= tolerance * 0.75) group++;
		remap[order[o]] = group;
	}
	for (let i = 0; i < n; i++) classes[i] = remap[classes[i]];
	return classes;
};

//***************************************************************
// 														SLIC SUPERPIXELS
//***************************************************************

/**
 * SLIC (simple linear iterative clustering) on the intensity grid: k-means in
 * (x, y, value) space where each cluster only competes for cells inside a
 * 2S x 2S window around its center. Returns a per-cell cluster id; fragments
 * of a cluster that end up spatially disconnected are split apart afterwards
 * by the caller's connected-component pass.
 */
const slicClasses = (
	values: Float32Array,
	width: number,
	height: number,
	cellSize: number,
	compactness: number
): Int32Array => {
	const n = values.length;
	const S = Math.max(2, Math.round(cellSize));
	const gridCols = Math.max(1, Math.round(width / S));
	const gridRows = Math.max(1, Math.round(height / S));
	const k = gridCols * gridRows;
	const stepX = width / gridCols;
	const stepY = height / gridRows;

	const cx = new Float64Array(k);
	const cy = new Float64Array(k);
	const cv = new Float64Array(k);

	// seed centers on a regular grid, nudged to the lowest-gradient cell in
	// their 3x3 neighbourhood so they don't start on an edge
	const gradient = gradientMagnitude(values, width, height);
	for (let gy = 0; gy < gridRows; gy++) {
		for (let gx = 0; gx < gridCols; gx++) {
			const x = Math.min(width - 1, Math.floor((gx + 0.5) * stepX));
			const y = Math.min(height - 1, Math.floor((gy + 0.5) * stepY));
			let best = y * width + x;
			const y0 = Math.max(0, y - 1);
			const y1 = Math.min(height - 1, y + 1);
			const x0 = Math.max(0, x - 1);
			const x1 = Math.min(width - 1, x + 1);
			for (let yy = y0; yy <= y1; yy++) {
				for (let xx = x0; xx <= x1; xx++) {
					if (gradient[yy * width + xx] < gradient[best]) best = yy * width + xx;
				}
			}
			const c = gy * gridCols + gx;
			cx[c] = best % width;
			cy[c] = Math.floor(best / width);
			cv[c] = values[best];
		}
	}

	// squared spatial weight: dividing by S² makes compactness independent of
	// the superpixel size — 1 pins cells to the grid, near 0 follows intensity
	const m2 = Math.max(compactness, 0.01) ** 2 / (S * S);

	const classes = new Int32Array(n);
	const dist = new Float64Array(n);
	const sumX = new Float64Array(k);
	const sumY = new Float64Array(k);
	const sumV = new Float64Array(k);
	const counts = new Int32Array(k);

	for (let iter = 0; iter < 10; iter++) {
		dist.fill(Infinity);
		classes.fill(-1);
		for (let c = 0; c < k; c++) {
			const x0 = Math.max(0, Math.floor(cx[c] - S));
			const x1 = Math.min(width - 1, Math.ceil(cx[c] + S));
			const y0 = Math.max(0, Math.floor(cy[c] - S));
			const y1 = Math.min(height - 1, Math.ceil(cy[c] + S));
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					const i = y * width + x;
					const dv = values[i] - cv[c];
					const dx = x - cx[c];
					const dy = y - cy[c];
					const d = dv * dv + (dx * dx + dy * dy) * m2;
					if (d < dist[i]) {
						dist[i] = d;
						classes[i] = c;
					}
				}
			}
		}

		// cells outside every search window (possible when centers drift near an
		// uneven grid edge) fall back to their regular grid cluster
		for (let i = 0; i < n; i++) {
			if (classes[i] < 0) {
				const gx = Math.min(gridCols - 1, Math.floor((i % width) / stepX));
				const gy = Math.min(gridRows - 1, Math.floor(Math.floor(i / width) / stepY));
				classes[i] = gy * gridCols + gx;
			}
		}

		// move centers to the mean of their assigned cells
		sumX.fill(0);
		sumY.fill(0);
		sumV.fill(0);
		counts.fill(0);
		for (let i = 0; i < n; i++) {
			const c = classes[i];
			sumX[c] += i % width;
			sumY[c] += Math.floor(i / width);
			sumV[c] += values[i];
			counts[c]++;
		}
		let moved = 0;
		for (let c = 0; c < k; c++) {
			if (counts[c] === 0) continue;
			const nx = sumX[c] / counts[c];
			const ny = sumY[c] / counts[c];
			moved += Math.abs(nx - cx[c]) + Math.abs(ny - cy[c]);
			cx[c] = nx;
			cy[c] = ny;
			cv[c] = sumV[c] / counts[c];
		}
		if (moved < 0.5) break;
	}
	return classes;
};

//***************************************************************
// 														POST-PROCESSING
//***************************************************************

/**
 * Shared region post-processing on a labeled grid: optional tolerance-based
 * merging + thin transition-region absorption (watershed), minimum-size
 * absorption, and compact relabeling with per-region stats.
 */
const finalizeSegmentation = (
	labels: Int32Array,
	initialCount: number,
	values: Float32Array,
	width: number,
	height: number,
	options: SegmentationOptions,
	applyToleranceMerge: boolean
): Segmentation => {
	const n = width * height;

	const parent = new Int32Array(initialCount);
	const sum = new Float64Array(initialCount);
	const size = new Int32Array(initialCount);
	for (let r = 0; r < initialCount; r++) parent[r] = r;
	for (let i = 0; i < n; i++) {
		const label = labels[i];
		sum[label] += values[i];
		size[label]++;
	}

	const find = (r: number): number => {
		let root = r;
		while (parent[root] !== root) root = parent[root];
		while (parent[r] !== root) {
			const next = parent[r];
			parent[r] = root;
			r = next;
		}
		return root;
	};

	const union = (a: number, b: number): void => {
		// keep the larger region as the root to limit tree depth
		if (size[a] < size[b]) {
			const t = a;
			a = b;
			b = t;
		}
		parent[b] = a;
		sum[a] += sum[b];
		size[a] += size[b];
	};

	// --- region adjacency graph (unique unordered pairs of initial labels) ---
	const pairKeys = new Set<number>();
	const pairsA: number[] = [];
	const pairsB: number[] = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			const label = labels[i];
			if (x < width - 1) {
				const other = labels[i + 1];
				if (other !== label) {
					const key = label < other ? label * initialCount + other : other * initialCount + label;
					if (!pairKeys.has(key)) {
						pairKeys.add(key);
						pairsA.push(label);
						pairsB.push(other);
					}
				}
			}
			if (y < height - 1) {
				const other = labels[i + width];
				if (other !== label) {
					const key = label < other ? label * initialCount + other : other * initialCount + label;
					if (!pairKeys.has(key)) {
						pairKeys.add(key);
						pairsA.push(label);
						pairsB.push(other);
					}
				}
			}
		}
	}

	if (applyToleranceMerge) {
		// Merge adjacent regions with similar means, smallest differences first.
		const order = new Array<number>(pairsA.length);
		for (let p = 0; p < order.length; p++) order[p] = p;
		order.sort(
			(a, b) =>
				Math.abs(sum[pairsA[a]] / size[pairsA[a]] - sum[pairsB[a]] / size[pairsB[a]]) -
				Math.abs(sum[pairsA[b]] / size[pairsA[b]] - sum[pairsB[b]] / size[pairsB[b]])
		);

		for (let pass = 0; pass < 8; pass++) {
			let merged = false;
			for (let p = 0; p < order.length; p++) {
				const ra = find(pairsA[order[p]]);
				const rb = find(pairsB[order[p]]);
				if (ra === rb) continue;
				const diff = Math.abs(sum[ra] / size[ra] - sum[rb] / size[rb]);
				if (diff <= options.tolerance) {
					union(ra, rb);
					merged = true;
				}
			}
			if (!merged) break;
		}

		// Absorb thin transition regions ("streaks" along soft edges): regions
		// whose mean sits between two neighbours' means and whose perimeter is
		// large relative to their area are watershed artifacts of wide gradient
		// bands, not intentional detail. Only watershed produces these; SLIC
		// superpixels are compact by construction and skip this pass — it
		// would eat legitimate regions.
		const perimeter = new Int32Array(initialCount);
		const bestDiff = new Float64Array(initialCount);
		const bestTo = new Int32Array(initialCount);
		const nbMin = new Float64Array(initialCount);
		const nbMax = new Float64Array(initialCount);
		const sizeCap = Math.max(64, n * 0.05);
		const streakPasses = options.algorithm === 'watershed' ? 4 : 0;

		for (let pass = 0; pass < streakPasses; pass++) {
			perimeter.fill(0);
			bestDiff.fill(Infinity);
			bestTo.fill(-1);
			nbMin.fill(Infinity);
			nbMax.fill(-Infinity);

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const i = y * width + x;
					const ra = find(labels[i]);
					// image border contributes to the perimeter
					if (x === 0) perimeter[ra]++;
					if (x === width - 1) perimeter[ra]++;
					if (y === 0) perimeter[ra]++;
					if (y === height - 1) perimeter[ra]++;
					const visit = (rb: number) => {
						perimeter[ra]++;
						perimeter[rb]++;
						const meanA = sum[ra] / size[ra];
						const meanB = sum[rb] / size[rb];
						const diff = Math.abs(meanA - meanB);
						if (diff < bestDiff[ra]) {
							bestDiff[ra] = diff;
							bestTo[ra] = rb;
						}
						if (diff < bestDiff[rb]) {
							bestDiff[rb] = diff;
							bestTo[rb] = ra;
						}
						if (meanB < nbMin[ra]) nbMin[ra] = meanB;
						if (meanB > nbMax[ra]) nbMax[ra] = meanB;
						if (meanA < nbMin[rb]) nbMin[rb] = meanA;
						if (meanA > nbMax[rb]) nbMax[rb] = meanA;
					};
					if (x < width - 1) {
						const rb = find(labels[i + 1]);
						if (rb !== ra) visit(rb);
					}
					if (y < height - 1) {
						const rb = find(labels[i + width]);
						if (rb !== ra) visit(rb);
					}
				}
			}

			let merged = false;
			for (let r = 0; r < initialCount; r++) {
				if (find(r) !== r || size[r] === 0 || size[r] > sizeCap) continue;
				if (perimeter[r] < size[r] * 1.25) continue; // not thin
				const mean = sum[r] / size[r];
				if (!(nbMin[r] < mean && nbMax[r] > mean)) continue; // not a transition
				if (bestTo[r] < 0) continue;
				const rb = find(bestTo[r]);
				if (rb === r) continue;
				union(r, rb);
				merged = true;
			}
			if (!merged) break;
		}
	}

	// Absorb regions below the minimum size into their most similar neighbour.
	const minSize = Math.max(1, Math.round(options.minRegionSize));
	if (minSize > 1) {
		for (let pass = 0; pass < 8; pass++) {
			const bestDiff = new Map<number, number>();
			const bestTo = new Map<number, number>();
			for (let p = 0; p < pairsA.length; p++) {
				const ra = find(pairsA[p]);
				const rb = find(pairsB[p]);
				if (ra === rb) continue;
				const diff = Math.abs(sum[ra] / size[ra] - sum[rb] / size[rb]);
				if (size[ra] < minSize && diff < (bestDiff.get(ra) ?? Infinity)) {
					bestDiff.set(ra, diff);
					bestTo.set(ra, rb);
				}
				if (size[rb] < minSize && diff < (bestDiff.get(rb) ?? Infinity)) {
					bestDiff.set(rb, diff);
					bestTo.set(rb, ra);
				}
			}
			let merged = false;
			for (const [small, target] of bestTo) {
				const ra = find(small);
				if (ra !== small || size[ra] >= minSize) continue; // already absorbed or grown
				const rb = find(target);
				if (ra === rb) continue;
				union(ra, rb);
				merged = true;
			}
			if (!merged) break;
		}
	}

	// --- compact relabel ---
	const compact = new Int32Array(initialCount).fill(-1);
	let regionCount = 0;
	for (let i = 0; i < n; i++) {
		const root = find(labels[i]);
		if (compact[root] < 0) compact[root] = regionCount++;
		labels[i] = compact[root];
	}

	const regionMean = new Float32Array(regionCount);
	const regionSize = new Int32Array(regionCount);
	for (let r = 0; r < initialCount; r++) {
		const c = compact[r];
		if (c >= 0 && parent[r] === r) {
			regionMean[c] = sum[r] / size[r];
			regionSize[c] = size[r];
		}
	}

	return { labels, regionCount, regionMean, regionSize };
};

//***************************************************************
// 														ENTRY POINT
//***************************************************************

export const segmentGrid = (
	values: Float32Array,
	width: number,
	height: number,
	options: SegmentationOptions
): Segmentation => {
	const n = width * height;

	let smoothed = values;
	const smoothingPasses = Math.max(0, Math.round(options.smoothing));
	for (let pass = 0; pass < smoothingPasses; pass++) {
		smoothed = boxBlur3(smoothed, width, height);
	}

	const labels = new Int32Array(n);
	let initialCount: number;
	let applyToleranceMerge: boolean;

	if (options.algorithm === 'posterize') {
		initialCount = connectedComponents(
			posterizeClasses(smoothed, options.tolerance),
			width,
			height,
			labels
		);
		applyToleranceMerge = false;
	} else if (options.algorithm === 'kmeans') {
		initialCount = connectedComponents(
			kmeansClasses(smoothed, options.tolerance),
			width,
			height,
			labels
		);
		applyToleranceMerge = false;
	} else if (options.algorithm === 'slic') {
		// the component pass doubles as SLIC's connectivity enforcement:
		// disconnected fragments of a cluster become their own regions and the
		// min-size absorption sweeps up the crumbs
		initialCount = connectedComponents(
			slicClasses(
				smoothed,
				width,
				height,
				options.slicCellSize ?? 8,
				options.slicCompactness ?? 0.5
			),
			width,
			height,
			labels
		);
		applyToleranceMerge = true;
	} else {
		const gradient = gradientMagnitude(smoothed, width, height);
		labels.fill(-1);
		const markerValues: number[] = [];
		initialCount = findMinimaMarkers(gradient, smoothed, width, height, labels, markerValues);
		flood(gradient, smoothed, width, height, labels, markerValues);
		applyToleranceMerge = true;
	}

	return finalizeSegmentation(
		labels,
		initialCount,
		smoothed,
		width,
		height,
		options,
		applyToleranceMerge
	);
};

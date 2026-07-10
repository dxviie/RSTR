<script lang="ts">
	import BrandFooter from '$lib/components/BrandFooter.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { buildCalibrationBlock } from '$lib/prep/calibration';
	import {
		PAGE_LABELS,
		PAGES,
		pageDims,
		svgDimensions,
		type Orientation,
		type PageId
	} from '$lib/prep/pages';
	import { addReversedLayers } from '$lib/prep/reverse';

	//***************************************************************
	// 														STATE
	//***************************************************************

	// artwork
	let svgText: string | null = $state(null);
	let filename = $state('');
	let wMm = $state(0);
	let hMm = $state(0);
	let viewBox: [number, number, number, number] = $state([0, 0, 100, 100]);
	/** inner markup of the artwork — drives the preview blob */
	let inner = $state('');
	/** parsed artwork root, kept for the reversed-layers export */
	let sourceRoot: Element | null = null;
	let artBlobUrl = $state('');
	/** artwork offset from the page center, mm */
	let ox = $state(0);
	let oy = $state(0);
	/** 0/1/2/3 × 90° CW */
	let artRotation = $state(0);

	// calibration block position (page mm) — null = top-right default
	let calibX: number | null = $state(null);
	let calibY: number | null = $state(null);
	let calibRotated = $state(false);

	// output page + layers
	let pageSize: PageId = $state('A3');
	let orient: Orientation = $state('landscape');
	let layPaper = $state(true);
	let layCalib = $state(true);
	let layPage = $state(true);
	let addReversed = $state(false);
	let paperOutlineSize: 'artwork' | 'custom' | PageId = $state('artwork');
	let paperMargin = $state(5);
	let paperOutlineOrient: Orientation = $state('landscape');
	let paperOutlineW = $state(210);
	let paperOutlineH = $state(297);
	let penCount = $state(3);

	// stage
	let stageW = $state(0);
	let stageH = $state(0);
	let previewSvgEl: SVGSVGElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let dragActive = $state(false);
	let isDragging = $state(false);

	const PAD = 15; // mm of breathing room around the page

	const numFmt = (n: number, d = 2) => parseFloat(n.toFixed(d));

	const hasSvg = $derived(!!svgText);
	const page = $derived(pageDims(pageSize, orient));
	const pens = $derived(Math.max(1, Math.min(8, Math.round(penCount) || 2)));

	const scale = $derived.by(() => {
		const [pageW, pageH] = page;
		const vpW = pageW + PAD * 2;
		const vpH = pageH + PAD * 2;
		const cw = stageW || 900;
		const ch = stageH || 600;
		return Math.min((cw - 32) / vpW, (ch - 32) / vpH);
	});

	//***************************************************************
	// 														FILE INPUT
	//***************************************************************

	const loadFile = (file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			const text = reader.result as string;
			const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
			const root = doc.documentElement;
			if (root.querySelector('parsererror') || root.localName !== 'svg') {
				alert(`Could not parse ${file.name} as SVG.`);
				return;
			}
			const dims = svgDimensions(
				root.getAttribute('viewBox'),
				root.getAttribute('width'),
				root.getAttribute('height')
			);
			svgText = text;
			sourceRoot = root;
			filename = file.name;
			wMm = dims.wMm;
			hMm = dims.hMm;
			viewBox = dims.viewBox;
			// innerHTML preserves Inkscape layers, defs, everything
			inner = root.innerHTML;
			ox = 0;
			oy = 0;
			artRotation = 0;
		};
		reader.readAsText(file);
	};

	const openFile = (files: FileList | null | undefined) => {
		const file = files?.[0];
		if (file && file.name.toLowerCase().endsWith('.svg')) loadFile(file);
	};

	const clearSvg = () => {
		svgText = null;
		sourceRoot = null;
		filename = '';
		inner = '';
		ox = 0;
		oy = 0;
		artRotation = 0;
		if (fileInput) fileInput.value = '';
	};

	const onDrop = (event: DragEvent) => {
		event.preventDefault();
		dragActive = false;
		openFile(event.dataTransfer?.files);
	};

	//***************************************************************
	// 												ARTWORK GEOMETRY
	//***************************************************************

	// Effective display dims + viewBox accounting for rotation: odd rotations
	// swap the dims and shift the viewBox to frame the rotated content.
	const artEffDims = (): [number, number, [number, number, number, number]] => {
		const [vx, vy, vw, vh] = viewBox;
		if (artRotation % 2 === 0) return [wMm, hMm, [vx, vy, vw, vh]];
		const nvx = vx + (vw - vh) / 2;
		const nvy = vy + (vh - vw) / 2;
		return [hMm, wMm, [nvx, nvy, vh, vw]];
	};

	/** wrap artwork markup in the rotation <g> (or return it as is) */
	const wrapRotation = (content: string): string => {
		if (artRotation === 0) return content;
		const [vx, vy, vw, vh] = viewBox;
		const cx = vx + vw / 2;
		const cy = vy + vh / 2;
		return `<g transform="rotate(${artRotation * 90},${cx},${cy})">${content}</g>`;
	};

	const artworkTransform = (pageW: number, pageH: number) => {
		const [effW, effH, rotVb] = artEffDims();
		const [nvx, nvy, nvw, nvh] = rotVb;
		const sx = effW / nvw;
		const sy = effH / nvh;
		const ax = pageW / 2 + ox - effW / 2;
		const ay = pageH / 2 + oy - effH / 2;
		return { tx: ax - nvx * sx, ty: ay - nvy * sy, sx, sy, ax, ay, effW, effH };
	};

	// artwork preview blob — an HTML <img> rasterises once into a GPU texture,
	// so heavy artwork never re-rasterises on hover or drag
	$effect(() => {
		if (!svgText) {
			artBlobUrl = '';
			return;
		}
		const [effW, effH, rotVb] = artEffDims();
		const [nvx, nvy, nvw, nvh] = rotVb;
		const svgStr = `<svg xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${effW}mm" height="${effH}mm"
      viewBox="${nvx} ${nvy} ${nvw} ${nvh}">${wrapRotation(inner)}</svg>`;
		const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
		artBlobUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	const rotateArtwork = () => {
		artRotation = (artRotation + 1) % 4;
		ox = 0;
		oy = 0;
	};

	const centerArtwork = () => {
		ox = 0;
		oy = 0;
	};

	//***************************************************************
	// 												PAPER OUTLINE
	//***************************************************************

	// {x, y, w, h} in page mm, or null in artwork mode without artwork
	const paperOutlineRect = (pageW: number, pageH: number) => {
		const pm = paperMargin || 5;
		if (paperOutlineSize === 'artwork') {
			if (!svgText) return null;
			const t = artworkTransform(pageW, pageH);
			return { x: t.ax - pm, y: t.ay - pm, w: t.effW + pm * 2, h: t.effH + pm * 2 };
		}
		let pw: number;
		let ph: number;
		if (paperOutlineSize === 'custom') {
			pw = paperOutlineW || 210;
			ph = paperOutlineH || 297;
		} else {
			[pw, ph] = PAGES[paperOutlineSize];
			if (paperOutlineOrient === 'landscape') [pw, ph] = [Math.max(pw, ph), Math.min(pw, ph)];
			else [pw, ph] = [Math.min(pw, ph), Math.max(pw, ph)];
		}
		return { x: (pageW - pw) / 2 - pm, y: (pageH - ph) / 2 - pm, w: pw + pm * 2, h: ph + pm * 2 };
	};

	//***************************************************************
	// 														PREVIEW
	//***************************************************************

	const previewHtml = $derived.by(() => {
		const [pageW, pageH] = page;
		let html = '';

		// page shadow + background
		html += `<rect x="1.2" y="1.2" width="${pageW}" height="${pageH}" fill="#60739f" opacity="0.2"/>`;
		html += `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="white" stroke="#e1e4e8" stroke-width="0.25"/>`;

		// faint 10mm grid + 50mm accent
		html += `<g stroke="#eceff4" stroke-width="0.2">`;
		for (let x = 10; x < pageW; x += 10) html += `<line x1="${x}" y1="0" x2="${x}" y2="${pageH}"/>`;
		for (let y = 10; y < pageH; y += 10) html += `<line x1="0" y1="${y}" x2="${pageW}" y2="${y}"/>`;
		html += `</g><g stroke="#dfe4ec" stroke-width="0.35">`;
		for (let x = 50; x < pageW; x += 50) html += `<line x1="${x}" y1="0" x2="${x}" y2="${pageH}"/>`;
		for (let y = 50; y < pageH; y += 50) html += `<line x1="0" y1="${y}" x2="${pageW}" y2="${y}"/>`;
		html += `</g>`;

		// artwork bounding box (the artwork itself is the <img> overlay)
		if (hasSvg) {
			const t = artworkTransform(pageW, pageH);
			html += `<rect x="${t.ax}" y="${t.ay}" width="${t.effW}" height="${t.effH}"
        fill="${isDragging ? 'rgba(96,115,159,0.06)' : 'none'}" stroke="#a8b3c9"
        stroke-width="${isDragging ? 0.5 : 0.35}" stroke-dasharray="2 1.5"/>`;
		}

		// paper outline layer
		if (layPaper) {
			const pr = paperOutlineRect(pageW, pageH);
			if (pr) {
				html += `<rect x="${pr.x}" y="${pr.y}" width="${pr.w}" height="${pr.h}"
          fill="none" stroke="#00BFE8" stroke-width="0.55" stroke-dasharray="3 2"/>`;
			}
		}

		// calibration block + its drag handle
		if (layCalib) {
			const calib = buildCalibrationBlock({
				pageW,
				pageH,
				penCount: pens,
				forExport: false,
				rotated: calibRotated,
				x: calibX,
				y: calibY
			});
			html += calib.svg;
			html += `<rect x="${calib.bx}" y="${calib.by}" width="${calib.bw}" height="${calib.bh}"
        fill="transparent" stroke="#93a1bd" stroke-width="0.3" stroke-dasharray="1.5 1.5"
        style="cursor:move" data-drag="calib"/>`;
		}

		// page boundary
		if (layPage) {
			html += `<rect x="0" y="0" width="${pageW}" height="${pageH}"
        fill="none" stroke="#FF2AA6" stroke-width="0.6"/>`;
		}

		// dimension labels
		html += `<text x="${pageW / 2}" y="${-PAD + 4}" font-size="3" text-anchor="middle"
      font-family="monospace" fill="#60739f">${numFmt(pageW, 0)} mm</text>`;
		html += `<text x="${-PAD + 3.5}" y="${pageH / 2}" font-size="3" text-anchor="middle"
      font-family="monospace" fill="#60739f" transform="rotate(-90,${-PAD + 3.5},${pageH / 2})">${numFmt(pageH, 0)} mm</text>`;

		// empty state
		if (!hasSvg) {
			html += `<text x="${pageW / 2}" y="${pageH / 2 - 4}" font-size="5" text-anchor="middle"
        font-family="monospace" fill="#60739f" opacity="0.4">drop SVG to begin</text>`;
			html += `<text x="${pageW / 2}" y="${pageH / 2 + 4}" font-size="3" text-anchor="middle"
        font-family="monospace" fill="#60739f" opacity="0.3">${pageSize} ${orient} · ${numFmt(pageW, 0)} × ${numFmt(pageH, 0)} mm</text>`;
		}

		// artwork drag handle + rotate button (hover-revealed via CSS)
		if (hasSvg) {
			const t = artworkTransform(pageW, pageH);
			const btnR = 4.5;
			const btnCX = t.ax + t.effW - btnR - 1.5;
			const btnCY = t.ay + btnR + 1.5;
			html += `<g class="artwork-hover">
        <rect x="${t.ax}" y="${t.ay}" width="${t.effW}" height="${t.effH}"
          fill="transparent" stroke="none" style="cursor:move" data-drag="artwork"/>
        <g class="rotate-btn" data-action="rotate" style="cursor:pointer"
          transform="translate(${btnCX},${btnCY})">
          <circle r="${btnR}" fill="#fdfaff" stroke="#1a202c" stroke-width="0.5"/>
          <text font-size="${btnR * 0.95}" text-anchor="middle" dominant-baseline="central"
            font-family="monospace" fill="#1a202c">↻</text>
        </g>
      </g>`;
		}

		return html;
	});

	const previewViewBox = $derived(`${-PAD} ${-PAD} ${page[0] + PAD * 2} ${page[1] + PAD * 2}`);

	const artworkImgStyle = $derived.by(() => {
		if (!hasSvg || !artBlobUrl || isDragging) return 'display:none';
		const [pageW, pageH] = page;
		const t = artworkTransform(pageW, pageH);
		return (
			`left:${(t.ax + PAD) * scale}px;top:${(t.ay + PAD) * scale}px;` +
			`width:${t.effW * scale}px;height:${t.effH * scale}px`
		);
	});

	//***************************************************************
	// 												DRAG TO REPOSITION
	//***************************************************************

	interface DragState {
		target: 'artwork' | 'calib';
		x: number;
		y: number;
		ox0: number;
		oy0: number;
		cx0: number;
		cy0: number;
	}
	let drag: DragState | null = null;

	const svgPoint = (event: PointerEvent) => {
		const el = previewSvgEl;
		if (!el) return { x: 0, y: 0 };
		const bb = el.getBoundingClientRect();
		const [pageW, pageH] = page;
		const vpW = pageW + PAD * 2;
		const vpH = pageH + PAD * 2;
		return {
			x: ((event.clientX - bb.left) * vpW) / bb.width - PAD,
			y: ((event.clientY - bb.top) * vpH) / bb.height - PAD
		};
	};

	const onStagePointerDown = (event: PointerEvent) => {
		const target = event.target as Element;
		if (target.closest('[data-action="rotate"]')) return;
		const handle = target.closest('[data-drag]');
		if (!handle) return;
		event.preventDefault();
		const [pageW, pageH] = page;
		// resolve the calib default position through the builder
		const calib = buildCalibrationBlock({
			pageW,
			pageH,
			penCount: pens,
			forExport: false,
			rotated: calibRotated,
			x: calibX,
			y: calibY
		});
		const pt = svgPoint(event);
		drag = {
			target: handle.getAttribute('data-drag') as 'artwork' | 'calib',
			x: pt.x,
			y: pt.y,
			ox0: ox,
			oy0: oy,
			cx0: calib.bx,
			cy0: calib.by
		};
		if (drag.target === 'artwork') isDragging = true;
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragEnd);
	};

	const onDragMove = (event: PointerEvent) => {
		if (!drag) return;
		const pt = svgPoint(event);
		const dx = pt.x - drag.x;
		const dy = pt.y - drag.y;
		if (drag.target === 'artwork') {
			ox = numFmt(drag.ox0 + dx);
			oy = numFmt(drag.oy0 + dy);
		} else {
			calibX = numFmt(drag.cx0 + dx);
			calibY = numFmt(drag.cy0 + dy);
		}
	};

	const onDragEnd = () => {
		drag = null;
		isDragging = false;
		window.removeEventListener('pointermove', onDragMove);
		window.removeEventListener('pointerup', onDragEnd);
	};

	const onStageClick = (event: MouseEvent) => {
		if ((event.target as Element).closest('[data-action="rotate"]')) rotateArtwork();
	};

	//***************************************************************
	// 														EXPORT
	//***************************************************************

	const doExport = () => {
		if (!svgText) return;
		const [pageW, pageH] = page;
		const t = artworkTransform(pageW, pageH);

		// the reversed duplicates are built from the pristine parsed source, so
		// namespaced attributes survive; rotation wraps around the result
		let artworkInner = inner;
		if (addReversed && sourceRoot) {
			const clone = sourceRoot.cloneNode(true) as Element;
			addReversedLayers(clone);
			artworkInner = clone.innerHTML;
		}

		let out = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by RSTR plot prep -->
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:svg="http://www.w3.org/2000/svg"
     width="${pageW}mm" height="${pageH}mm"
     viewBox="0 0 ${pageW} ${pageH}">

  <!-- ═══ Artwork (original SVG, layers preserved${addReversed ? ' + reversed duplicates' : ''}) ═══ -->
  <g inkscape:label="artwork" inkscape:groupmode="layer" id="layer-artwork"
     transform="translate(${t.tx.toFixed(6)},${t.ty.toFixed(6)}) scale(${t.sx.toFixed(8)},${t.sy.toFixed(8)})">
${wrapRotation(artworkInner)}
  </g>

`;

		if (layPaper) {
			const pr = paperOutlineRect(pageW, pageH);
			if (pr) {
				out += `  <!-- ═══ Paper outline: place paper within this rectangle ═══ -->
  <g inkscape:label="paper-outline" inkscape:groupmode="layer" id="layer-paper-outline">
    <rect x="${pr.x.toFixed(4)}" y="${pr.y.toFixed(4)}"
          width="${pr.w.toFixed(4)}" height="${pr.h.toFixed(4)}"
          fill="none" stroke="black" stroke-width="0.5"/>
  </g>

`;
			}
		}

		if (layCalib) {
			out += `  <!-- ═══ Calibration markers ═══ -->
  ${
		buildCalibrationBlock({
			pageW,
			pageH,
			penCount: pens,
			forExport: true,
			rotated: calibRotated,
			x: calibX,
			y: calibY
		}).svg
	}

`;
		}

		if (layPage) {
			out += `  <!-- ═══ Page boundary ═══ -->
  <g inkscape:label="page-boundary" inkscape:groupmode="layer" id="layer-page-boundary">
    <rect x="0" y="0" width="${pageW}" height="${pageH}"
          fill="none" stroke="black" stroke-width="0.5"/>
  </g>

`;
		}

		out += `</svg>`;

		const blob = new Blob([out], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename.replace(/\.svg$/i, '') + '_plotprep.svg';
		a.click();
		URL.revokeObjectURL(url);
	};
</script>

<svelte:head>
	<title>RSTR prep — decorate SVGs for plotting</title>
</svelte:head>

<div class="app">
	<TopBar active="prep" sub="PREP" tagline="decorate SVGs for pen plotting" />

	<div class="workspace">
		<!-------------------------------------------------------------
			LEFT PANE — input, page, layers, calibration, position
		-------------------------------------------------------------->
		<aside class="pane left">
			<section class="panel-group">
				<div class="group-title">input svg</div>
				{#if !hasSvg}
					<button
						class="drop-zone"
						onclick={() => fileInput?.click()}
						title="pick an SVG from your device — it never leaves the browser"
					>
						drop .svg here<span class="drop-sub">or click to browse</span>
					</button>
				{:else}
					<div class="file-info">
						<div class="fi-row">
							<span class="fi-key">file</span>
							<span class="fi-val" title={filename}>{filename}</span>
						</div>
						<div class="fi-row">
							<span class="fi-key">dimensions</span>
							<span class="fi-val">{numFmt(wMm, 1)} × {numFmt(hMm, 1)} mm</span>
						</div>
						<div class="fi-actions">
							<button onclick={() => fileInput?.click()} title="load a different SVG">
								↻ replace
							</button>
							<button class="danger" onclick={clearSvg} title="remove the loaded SVG">
								✕ clear
							</button>
						</div>
					</div>
				{/if}
			</section>

			<section class="panel-group">
				<div class="group-title">output page</div>
				<label class="select-row" title="physical size of the exported page">
					<span>paper size</span>
					<select bind:value={pageSize}>
						{#each Object.keys(PAGES) as id (id)}
							<option value={id}>{PAGE_LABELS[id as PageId]}</option>
						{/each}
					</select>
				</label>
				<label class="select-row" title="orientation of the exported page">
					<span>orientation</span>
					<select bind:value={orient}>
						<option value="landscape">Landscape</option>
						<option value="portrait">Portrait</option>
					</select>
				</label>
			</section>

			<section class="panel-group">
				<div class="group-title">output layers</div>
				<label class="toggle-row" title="rectangle marking where to place the physical paper">
					<input type="checkbox" bind:checked={layPaper} />
					<span class="layer-dot" style="background: #00BFE8"></span>
					paper outline
				</label>
				<label
					class="toggle-row"
					title="pen alignment markers — rulers, per-pen lines and a verify circle"
				>
					<input type="checkbox" bind:checked={layCalib} />
					<span class="layer-dot" style="background: #FFB000"></span>
					calibration markers
				</label>
				<label class="toggle-row" title="rectangle around the full output page">
					<input type="checkbox" bind:checked={layPage} />
					<span class="layer-dot" style="background: #FF2AA6"></span>
					page boundary
				</label>
				<label
					class="toggle-row reversed-toggle"
					title="duplicate every artwork layer as a '-reversed' layer with the same lines running in the opposite direction — each line gets plotted twice, once in each direction, for denser ink"
				>
					<input type="checkbox" bind:checked={addReversed} />
					<span class="layer-dot reversed-dot">⇄</span>
					add reversed layers
				</label>
			</section>

			<section class="panel-group">
				<div class="group-title">paper outline</div>
				<label
					class="select-row"
					title="what the paper outline wraps — the artwork or a fixed paper size"
				>
					<span>size</span>
					<select bind:value={paperOutlineSize}>
						<option value="artwork">artwork</option>
						{#each Object.keys(PAGES) as id (id)}
							<option value={id}>{id}</option>
						{/each}
						<option value="custom">custom…</option>
					</select>
				</label>
				<label class="slider-row" title="extra room around the outlined size (mm)">
					<span>+ margin</span>
					<input type="range" min="1" max="50" step="0.5" bind:value={paperMargin} />
					<input type="number" min="1" max="50" step="0.5" bind:value={paperMargin} />
				</label>
				{#if paperOutlineSize !== 'artwork' && paperOutlineSize !== 'custom'}
					<label class="select-row" title="orientation of the outlined paper size">
						<span>orient</span>
						<select bind:value={paperOutlineOrient}>
							<option value="landscape">Landscape</option>
							<option value="portrait">Portrait</option>
						</select>
					</label>
				{/if}
				{#if paperOutlineSize === 'custom'}
					<label class="slider-row" title="custom paper width (mm)">
						<span>width (mm)</span>
						<input type="range" min="10" max="1200" step="1" bind:value={paperOutlineW} />
						<input type="number" min="1" step="1" bind:value={paperOutlineW} />
					</label>
					<label class="slider-row" title="custom paper height (mm)">
						<span>height (mm)</span>
						<input type="range" min="10" max="1200" step="1" bind:value={paperOutlineH} />
						<input type="number" min="1" step="1" bind:value={paperOutlineH} />
					</label>
				{/if}
			</section>

			<section class="panel-group">
				<div class="group-title">calibration</div>
				<label
					class="slider-row"
					title="how many pens the plot uses — one calibration line pair per pen"
				>
					<span>pens/layers</span>
					<input type="range" min="1" max="8" step="1" bind:value={penCount} />
					<input type="number" min="1" max="8" step="1" bind:value={penCount} />
				</label>
				<label class="toggle-row" title="rotate the calibration block 90° into a wide layout">
					<input
						type="checkbox"
						bind:checked={calibRotated}
						onchange={() => {
							// effective dims swap — reset to the default corner
							calibX = null;
							calibY = null;
						}}
					/>
					rotate 90°
				</label>
			</section>

			<section class="panel-group">
				<div class="group-title">artwork position</div>
				<label class="slider-row" title="horizontal offset from the page center (mm)">
					<span>offset X</span>
					<input type="range" min="-200" max="200" step="0.5" bind:value={ox} />
					<input type="number" step="0.5" bind:value={ox} />
				</label>
				<label class="slider-row" title="vertical offset from the page center (mm)">
					<span>offset Y</span>
					<input type="range" min="-200" max="200" step="0.5" bind:value={oy} />
					<input type="number" step="0.5" bind:value={oy} />
				</label>
				<div class="position-actions">
					<button onclick={centerArtwork} title="center the artwork on the page">⊹ center</button>
					<button
						onclick={rotateArtwork}
						disabled={!hasSvg}
						title="rotate the artwork 90° clockwise">↻ rotate</button
					>
				</div>
			</section>

			<section class="panel-group">
				<div class="group-title">export</div>
				<button
					class="primary-btn"
					onclick={doExport}
					disabled={!hasSvg}
					title="download the decorated SVG — artwork plus the enabled marker layers{addReversed
						? ', artwork layers duplicated in reverse'
						: ''}"
				>
					↓ export SVG
				</button>
			</section>

			<div class="spacer"></div>
			<BrandFooter />
		</aside>

		<!-------------------------------------------------------------
			STAGE — page preview
		-------------------------------------------------------------->
		<main
			class="stage"
			class:drag-active={dragActive}
			bind:clientWidth={stageW}
			bind:clientHeight={stageH}
			ondragover={(event) => {
				event.preventDefault();
				dragActive = true;
			}}
			ondragleave={() => (dragActive = false)}
			ondrop={onDrop}
		>
			<div class="preview-wrap">
				<div class="svg-wrap">
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<svg
						bind:this={previewSvgEl}
						class="preview-svg"
						role="application"
						aria-label="page preview — drag the artwork or the calibration block to reposition"
						viewBox={previewViewBox}
						style={`width:${(page[0] + PAD * 2) * scale}px;height:${(page[1] + PAD * 2) * scale}px`}
						onpointerdown={onStagePointerDown}
						onclick={onStageClick}
					>
						<!-- the markup is generated locally by the preview builders; the
						     artwork itself is shown through the <img> overlay, never inlined -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html previewHtml}
					</svg>
					{#if hasSvg && artBlobUrl}
						<img class="artwork-img" src={artBlobUrl} style={artworkImgStyle} alt="" />
					{/if}
				</div>
			</div>
			<div class="stage-footer">
				<span><span class="legend-dot" style="background: #00BFE8"></span>paper outline</span>
				<span><span class="legend-dot" style="background: #FFB000"></span>calibration</span>
				<span><span class="legend-dot" style="background: #FF2AA6"></span>page boundary</span>
				<span class="legend-hint">drag artwork or calibration block to reposition</span>
			</div>
		</main>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept=".svg,image/svg+xml"
		style="display: none;"
		onchange={(event) => {
			openFile(event.currentTarget.files);
			event.currentTarget.value = '';
		}}
	/>
</div>

<style>
	@font-face {
		font-family: 'nudica_monobold';
		src: url('/fonts/nudicamono-bold-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'nudica_monolight';
		src: url('/fonts/nudicamono-light-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	@font-face {
		font-family: 'argesta_regular';
		src: url('/fonts/argestatext-regular-webfont.woff') format('woff');
		font-weight: normal;
		font-style: normal;
		font-display: swap;
	}

	/* Full-viewport app shell in the d17e.dev brand, matching the studio. */
	.app {
		--ink: #1a202c;
		--bg: #fdfaff;
		--border: #e1e4e8;
		--muted: #60739f;
		--muted-light: #eef1f6;

		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.8rem;
	}

	.app button {
		font-family: 'nudica_monobold', monospace !important;
		font-size: 0.75rem !important;
		transition: all 0.1s ease;
	}

	.app button:hover:not(:disabled) {
		background-color: var(--muted-light) !important;
	}

	.app button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.app :focus-visible {
		outline: var(--muted) dashed 1px;
	}

	.app input[type='range'],
	.app input[type='checkbox'] {
		accent-color: var(--ink);
	}

	.spacer {
		flex: 1;
	}

	/* ------------------------------------------------- workspace */

	.workspace {
		flex: 1;
		display: flex;
		min-height: 0;
		container-type: inline-size;
	}

	.pane {
		width: 272px;
		flex-shrink: 0;
		overflow-y: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.pane.left {
		border-right: 1px solid var(--border);
	}

	.panel-group {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.panel-group + .panel-group {
		border-top: 1px solid var(--border);
		padding-top: 0.75rem;
	}

	.group-title {
		font-family: 'nudica_monobold', monospace;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* ------------------------------------------------- input svg */

	.drop-zone {
		border: 1px dashed var(--border);
		border-radius: 8px;
		background: #fff;
		cursor: pointer;
		color: var(--ink);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		padding: 1.1rem 0.4rem;
	}

	.drop-zone:hover {
		border-color: var(--muted);
	}

	.drop-sub {
		font-family: 'argesta_regular', serif;
		font-size: 0.66rem;
		color: var(--muted);
		font-weight: normal;
	}

	.file-info {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: #fff;
		padding: 0.5rem;
	}

	.fi-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.fi-key {
		font-size: 0.66rem;
		color: var(--muted);
		flex-shrink: 0;
	}

	.fi-val {
		font-size: 0.68rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fi-actions {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.2rem;
	}

	.fi-actions button {
		flex: 1;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: #fff;
		color: var(--ink);
		cursor: pointer;
	}

	.fi-actions button.danger:hover {
		color: #d50000;
		border-color: #d50000;
	}

	/* ------------------------------------------------- controls */

	.slider-row {
		display: grid;
		grid-template-columns: 6rem 1fr 3.2rem;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
	}

	.slider-row > span {
		font-size: 0.68rem;
	}

	.slider-row input[type='range'] {
		width: 100%;
		min-width: 0;
	}

	.slider-row input[type='number'] {
		width: 100%;
		box-sizing: border-box;
		padding: 0.1rem 0.2rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.68rem;
	}

	.select-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--muted);
	}

	.select-row > span {
		font-size: 0.68rem;
		width: 6rem;
		flex-shrink: 0;
	}

	.select-row select {
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: #fff;
		color: var(--ink);
		font-family: 'nudica_monolight', monospace;
		font-size: 0.7rem;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: var(--ink);
		cursor: pointer;
	}

	.layer-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.reversed-toggle {
		border-top: 1px dashed var(--border);
		padding-top: 0.45rem;
		margin-top: 0.15rem;
	}

	.reversed-dot {
		width: auto;
		height: auto;
		border-radius: 0;
		background: none;
		color: var(--muted);
		font-size: 0.75rem;
		line-height: 1;
	}

	.position-actions {
		display: flex;
		gap: 0.3rem;
	}

	.position-actions button {
		flex: 1;
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: #fff;
		color: var(--ink);
		cursor: pointer;
	}

	.position-actions button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.primary-btn {
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--ink);
		border-radius: 6px;
		background: var(--ink);
		color: #fff;
		cursor: pointer;
	}

	.primary-btn:hover:not(:disabled) {
		color: var(--ink);
	}

	.primary-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ------------------------------------------------- stage */

	.stage {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.stage.drag-active {
		outline: 2px dashed var(--muted);
		outline-offset: -6px;
	}

	.preview-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		padding: 0.75rem;
	}

	/* tight wrapper — the artwork <img> is positioned relative to the svg */
	.svg-wrap {
		position: relative;
		line-height: 0;
	}

	.preview-svg {
		display: block;
		user-select: none;
		filter: drop-shadow(0 8px 24px rgba(96, 115, 159, 0.2));
	}

	.artwork-img {
		position: absolute;
		pointer-events: none;
		opacity: 0.9;
	}

	.preview-svg :global(.rotate-btn) {
		opacity: 0;
		transition: opacity 0.12s ease;
	}

	.preview-svg :global(.artwork-hover:hover .rotate-btn) {
		opacity: 1;
	}

	.stage-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
		padding: 0.3rem;
		border-top: 1px solid var(--border);
		font-size: 0.62rem;
		color: var(--muted);
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.stage-footer span {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.legend-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.legend-hint {
		font-family: 'argesta_regular', serif;
	}
</style>

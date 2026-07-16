<script lang="ts">
	// Help page: a compact reference of every setting and feature in the
	// studio (plus prep and classic). Descriptions mirror the in-app
	// tooltips — hover any control in the app for the same hint in place.
</script>

<svelte:head>
	<title>RSTR help — settings & features</title>
	<meta
		name="description"
		content="What every RSTR setting does: image adjustments, segmentation, lines, layers, presets, export, plot time — plus the prep tool and the classic app."
	/>
</svelte:head>

<div class="help">
	<h1>help</h1>
	<p class="intro">
		The <a href="/studio">studio</a> is where images become line art: the left pane feeds and tunes the
		image, the middle shows the render, the right pane manages pens and exports. Every control in the
		app has a tooltip — hover (or long-press) it for a hint in place. This page is the longer version.
	</p>

	<figure class="shot">
		<a href="/help/studio-sections.webp" target="_blank" rel="noopener">
			<img
				src="/help/studio-sections.webp"
				alt="the RSTR studio on desktop, its sections outlined and numbered — 1 source & adjustments, 2 video, 3 segmentation and 4 lines on the left, 5 presets, 6 layers, 7 export and 8 stats on the right, the render in the middle"
				width="2000"
				height="1250"
			/>
		</a>
	</figure>
	<ol class="map">
		<li style="--c: #e63946">
			<span class="map-dot">1</span>
			<span><strong>image</strong> — load a picture or video and tune it before tracing.</span>
		</li>
		<li style="--c: #8338ec">
			<span class="map-dot">2</span>
			<span
				><strong>video</strong> — frame rate and export window, shown while a video is loaded.</span
			>
		</li>
		<li style="--c: #3a86ff">
			<span class="map-dot">3</span>
			<span><strong>segmentation</strong> — how the image is carved into tonal regions.</span>
		</li>
		<li style="--c: #00b4d8">
			<span class="map-dot">4</span>
			<span><strong>lines</strong> — pen width and how ink turns into line spacing.</span>
		</li>
		<li style="--c: #fb8500">
			<span class="map-dot">5</span>
			<span><strong>presets</strong> — randomize everything, or save and share complete looks.</span
			>
		</li>
		<li style="--c: #06a77d">
			<span class="map-dot">6</span>
			<span
				><strong>layers</strong> — one pen per layer: color, channel, hatch angles, overrides.</span
			>
		</li>
		<li style="--c: #8b4513">
			<span class="map-dot">7</span>
			<span
				><strong>export</strong> — output width and the SVG, PNG and frame-sequence downloads.</span
			>
		</li>
		<li style="--c: #ff2aa6">
			<span class="map-dot">8</span>
			<span><strong>stats</strong> — render numbers and the estimated plot time.</span>
		</li>
	</ol>

	<section>
		<h2>image</h2>
		<dl>
			<dt>browse / drop</dt>
			<dd>
				Load an image or video from your device — or drop it straight onto the render. Nothing is
				uploaded; all processing happens in your browser.
			</dd>
			<dt>input thumbnail</dt>
			<dd>Hold it down to peek at the input with the adjustments below applied.</dd>
			<dt>brightness / contrast</dt>
			<dd>Brighten or darken the image, and push contrast around mid grey, before segmentation.</dd>
			<dt>gamma / key</dt>
			<dd>Midtone curve — above 1 lifts the midtones, below 1 keys them down.</dd>
			<dt>saturation</dt>
			<dd>Uniform color saturation; 0 turns the input greyscale.</dd>
			<dt>vibrance</dt>
			<dd>
				Saturation boost weighted towards muted colors, so it won't blow out what's already vivid.
			</dd>
		</dl>
	</section>

	<section>
		<h2>video</h2>
		<dl>
			<dt>output fps</dt>
			<dd>
				Frame rate the video is sampled at — fewer frames per second means fewer, smaller files.
			</dd>
			<dt>frames</dt>
			<dd>
				The exported frame window (first – last). The timeline over the render shades this range;
				scrub it or step frame by frame to preview any moment with the current settings.
			</dd>
			<dt>frame sequence export</dt>
			<dd>
				Renders every frame in the window and downloads one zip — plottable SVGs, images (png, jpeg
				or webp with quality and scale controls), or both.
			</dd>
		</dl>
	</section>

	<section>
		<h2>segmentation</h2>
		<p class="section-note">
			Segmentation carves the image into regions of similar tone — the shapes the lines will fill.
		</p>
		<dl>
			<dt>algorithm</dt>
			<dd>
				<em>Watershed</em> follows tonal basins, <em>posterize</em> bands intensities,
				<em>k-means</em> clusters them, and <em>SLIC</em> carves compact superpixels.
			</dd>
			<dt>resolution</dt>
			<dd>Grid resolution the image is sampled at — more cells, more detail, slower renders.</dd>
			<dt>smoothing</dt>
			<dd>Blur passes before segmentation — higher means fewer, larger regions.</dd>
			<dt>superpixel size / compactness</dt>
			<dd>
				SLIC only: superpixel spacing in grid cells, and how strictly they stay grid-like versus
				following image detail.
			</dd>
			<dt>tolerance</dt>
			<dd>Maximum intensity difference for merging adjacent regions.</dd>
			<dt>min region size</dt>
			<dd>Regions with fewer cells get absorbed into a neighbour.</dd>
		</dl>
	</section>

	<section>
		<h2>lines</h2>
		<dl>
			<dt>pen width (mm)</dt>
			<dd>Physical line width used for rendering and spacing math. Layers can override it.</dd>
			<dt>ink threshold</dt>
			<dd>Regions holding less ink than this stay empty.</dd>
			<dt>ink gamma</dt>
			<dd>Perceptual weight on ink intensity before it becomes line spacing.</dd>
			<dt>ink boost</dt>
			<dd>Coverage multiplier — above 1 pushes dark regions into overlapping lines.</dd>
			<dt>spacing (mm)</dt>
			<dd>
				Nominal min–max line spacing. Each region lands somewhere in this range based on its ink:
				dense lines where the image is dark, sparse where it's light.
			</dd>
		</dl>
	</section>

	<section>
		<h2>layers — one per pen</h2>
		<dl>
			<dt>layer basics</dt>
			<dd>
				Each layer is one pen: pick its color, name it, toggle it, reorder with ▲▼ (layers draw top
				to bottom). The name becomes the layer label in the exported SVG.
			</dd>
			<dt>channel</dt>
			<dd>
				Which part of the image drives the layer's ink: cyan / magenta / yellow (the print
				channels), key / darkness, red / green / blue, or (inverted) luminance.
			</dd>
			<dt>angle min / max</dt>
			<dd>
				Hatch direction range — every region picks its own angle within it, based on the region's
				shape, so one layer never looks mechanical.
			</dd>
			<dt>overrides</dt>
			<dd>
				Pen width, threshold, spacing, ink gamma and ink boost can be set per layer. Empty fields
				inherit the global lines values (shown as grey italics); "clear overrides" resets them all.
			</dd>
		</dl>
	</section>

	<section>
		<h2>presets & randomize</h2>
		<dl>
			<dt>randomize</dt>
			<dd>
				The dice rolls all segmentation, lines and layer settings. "Stick to built-in presets"
				limits the roll to ink + pen combinations that physically exist, so the result stays
				plottable.
			</dd>
			<dt>presets</dt>
			<dd>
				Apply a built-in look, or save your current settings under a name — saved presets live in
				your browser. A fresh visit opens on a random built-in.
			</dd>
			<dt>export / import .json</dt>
			<dd>Move settings between browsers or share them as a small JSON file.</dd>
		</dl>
	</section>

	<section>
		<h2>export</h2>
		<dl>
			<dt>width (mm)</dt>
			<dd>Physical output width — the height follows the image aspect.</dd>
			<dt>↓ SVG</dt>
			<dd>A plottable SVG with one layer group per pen, ready for plotter software.</dd>
			<dt>↓ PNG</dt>
			<dd>The current render as an image — for screens, sharing and regular printing.</dd>
		</dl>
	</section>

	<section>
		<h2>stats & plot time</h2>
		<dl>
			<dt>grid / regions / lines / render</dt>
			<dd>
				The sampling grid size, how many tonal regions segmentation found, how many hatch lines were
				drawn, and how long your browser needed to compute the render.
			</dd>
			<dt>plot time</dt>
			<dd>
				Estimated plotting time on an AxiDraw-style machine (saxi's motion model): drawing, travel
				and pen lifts — hover it for the per-pen breakdown.
			</dd>
			<dt>plotter settings</dt>
			<dd>
				The motion profile behind that estimate: pen-up/-down speeds and accelerations, cornering,
				pen lift/drop pauses and the join radius (lines closer than this are drawn without lifting
				the pen). Match it to your machine, or reset to saxi's defaults.
			</dd>
		</dl>
	</section>

	<section>
		<h2>prep — <a href="/prep">/prep</a></h2>
		<figure class="shot">
			<a href="/help/prep.webp" target="_blank" rel="noopener">
				<img
					src="/help/prep.webp"
					alt="the prep tool on desktop — a studio export placed on an A3 page, with the paper outline, calibration block and page boundary around it"
					width="2000"
					height="1250"
					loading="lazy"
				/>
			</a>
		</figure>
		<p class="section-note">
			The plot prep tool takes an exported SVG and dresses it for the machine.
		</p>
		<dl>
			<dt>output page</dt>
			<dd>
				Pick the page size and orientation the plotter will see; drag the artwork (or use the
				offsets) to place it.
			</dd>
			<dt>paper outline</dt>
			<dd>
				A rectangle marking where to place the physical paper — sized to the artwork or a fixed
				format, plus margin.
			</dd>
			<dt>calibration markers</dt>
			<dd>
				Rulers, a verify circle and one line pair per pen, so multi-pen plots line up. Drag the
				block anywhere.
			</dd>
			<dt>page boundary</dt>
			<dd>A rectangle around the full output page.</dd>
			<dt>add reversed layers</dt>
			<dd>
				Duplicates every artwork layer with the same lines running in the opposite direction — each
				line gets plotted twice for denser ink.
			</dd>
			<dt>export SVG</dt>
			<dd>Downloads the decorated SVG with everything on its own (Inkscape-compatible) layer.</dd>
		</dl>
	</section>

	<section>
		<h2>classic — <a href="/classic">/classic</a></h2>
		<figure class="shot">
			<a href="/help/classic.webp" target="_blank" rel="noopener">
				<img
					src="/help/classic.webp"
					alt="the classic app on desktop — a finished multi-color line render next to its resolution, grouping and fill controls"
					width="2000"
					height="1468"
					loading="lazy"
				/>
			</a>
		</figure>
		<p class="section-note">
			The original RSTR, kept around for nostalgia (and because it still makes nice plots). One
			image, one layer, multiple pens. The algorithm that started it all.
		</p>
	</section>

	<section>
		<h2>good to know</h2>
		<dl>
			<dt>private by design</dt>
			<dd>Images, videos and settings never leave your device.</dd>
			<dt>works offline</dt>
			<dd>RSTR is an installable web app — once visited, it keeps working without a connection.</dd>
			<dt>settings persistence</dt>
			<dd>
				Your settings are remembered in this browser from the moment you first edit them — until
				then, every visit rolls a fresh random preset.
			</dd>
			<dt>real ink colors</dt>
			<dd>
				The palettes behind the randomize button are sampled from real fountain-pen inks, so a
				random roll always lands on colors you can actually plot with. They're based on the ranges
				from
				<a href="https://www.de-atramentis.com/en/Artist-ink-/" target="_blank" rel="noopener"
					>De Atramentis</a
				>,
				<a href="https://www.octopus-fluids.de/en/write-draw-inks" target="_blank" rel="noopener"
					>Octopus Fluids</a
				>
				and
				<a href="https://www.rohrer-klingner.de/en/en_home/" target="_blank" rel="noopener"
					>Rohrer &amp; Klingner</a
				>.
			</dd>
		</dl>
	</section>
</div>

<style>
	.help {
		width: 100%;
		max-width: 46rem;
		padding: 2.5rem 1.5rem 4rem;
		color: var(--ink);
	}

	h1 {
		font-family: 'mono-bold', monospace;
		font-size: 1.8rem;
		margin: 0 0 1rem;
	}

	.intro {
		font-family: 'serif-text', serif;
		line-height: 1.65;
		color: var(--ink-soft, #2d3748);
		margin: 0 0 1.5rem;
	}

	/* ------------------------------------------- screenshots & legend */

	.shot {
		margin: 0 0 1rem;
	}

	.shot img {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid var(--border-c);
		border-radius: 10px;
		box-shadow: 0 2px 10px rgba(96, 115, 159, 0.14);
	}

	section .shot {
		margin: 0.25rem 0 1rem;
	}

	.map {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem 1.75rem;
	}

	.map li {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-family: 'serif-text', serif;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--ink-soft, #2d3748);
	}

	.map-dot {
		flex-shrink: 0;
		width: 1.35rem;
		height: 1.35rem;
		margin-top: 0.1rem;
		border-radius: 50%;
		background: var(--c);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: 'mono-bold', monospace;
		font-size: 0.75rem;
	}

	.map strong {
		font-family: 'mono-bold', monospace;
		font-weight: normal;
		font-size: 0.8rem;
	}

	section {
		padding: 1.75rem 0;
		border-top: 1px solid var(--border-c);
	}

	h2 {
		font-family: 'mono-bold', monospace;
		font-size: 1.05rem;
		margin: 0 0 0.75rem;
	}

	.section-note {
		font-family: 'serif-text', serif;
		line-height: 1.6;
		color: var(--muted-c);
		margin: 0 0 0.75rem;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: 11rem 1fr;
		gap: 0.6rem 1.25rem;
	}

	dt {
		font-family: 'mono-bold', monospace;
		font-size: 0.8rem;
		padding-top: 0.1rem;
	}

	dd {
		margin: 0;
		font-family: 'serif-text', serif;
		font-size: 0.92rem;
		line-height: 1.55;
		color: var(--ink-soft, #2d3748);
	}

	em {
		font-style: italic;
	}

	@media (max-width: 640px) {
		.map {
			grid-template-columns: 1fr;
		}

		dl {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}

		dd {
			margin-bottom: 0.75rem;
		}
	}
</style>

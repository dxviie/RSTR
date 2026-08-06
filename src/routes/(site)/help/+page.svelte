<script lang="ts">
	// Help page: a compact reference of every setting and feature in the
	// studio (plus prep and classic). Descriptions mirror the in-app
	// tooltips — hover any control in the app for the same hint in place.

	interface HelpSection {
		/** anchor id of the section (or the h1, for overview) */
		id: string;
		/** label in the legend and the on-this-page panel */
		title: string;
		/** studio-screenshot number + dot color — only the studio sections */
		num?: number;
		color?: string;
		/** legend blurb (studio sections only) */
		blurb?: string;
	}

	// One entry per page section, in DOCUMENT order — drives the on-this-page
	// panel and the scroll spy. The numbered legend under the screenshot
	// renders the studio subset in numeric order; numbers and colors mirror
	// the annotated screenshot.
	const SECTIONS: HelpSection[] = [
		{ id: 'overview', title: 'overview' },
		{
			id: 'image',
			title: 'image',
			num: 1,
			color: '#e63946',
			blurb: 'load a picture or video and tune it before tracing.'
		},
		{
			id: 'video',
			title: 'video',
			num: 2,
			color: '#8338ec',
			blurb: 'frame rate and export window, shown while a video is loaded.'
		},
		{
			id: 'segmentation',
			title: 'segmentation',
			num: 3,
			color: '#3a86ff',
			blurb: 'how the image is carved into tonal regions.'
		},
		{
			id: 'lines',
			title: 'lines',
			num: 4,
			color: '#00b4d8',
			blurb: 'pen width, how ink turns into line spacing, and the optional hand-drawn wobble.'
		},
		{
			id: 'presets',
			title: 'presets',
			num: 5,
			color: '#fb8500',
			blurb: 'randomize everything, or save and share complete looks.'
		},
		{
			id: 'layers',
			title: 'layers',
			num: 6,
			color: '#06a77d',
			blurb: 'one pen per layer: color, channel, hatch angles, overrides.'
		},
		{
			id: 'export',
			title: 'export',
			num: 7,
			color: '#8b4513',
			blurb: 'output width or a fixed page format, and the SVG, PNG and frame-sequence downloads.'
		},
		{
			id: 'stats',
			title: 'stats',
			num: 8,
			color: '#ff2aa6',
			blurb: 'render numbers and the estimated plot time.'
		},
		{ id: 'prep', title: 'prep' },
		{ id: 'classic', title: 'classic' },
		{ id: 'good-to-know', title: 'good to know' }
	];

	const mapSections = SECTIONS.filter((section) => section.num).sort(
		(a, b) => (a.num ?? 0) - (b.num ?? 0)
	);

	// Scroll spy for the panel: the last section whose top has passed the
	// reading line (a quarter down the viewport) is the active one; pinned to
	// the very end of the page, the final section wins even when it is too
	// short to ever reach that line.
	let activeSection = $state('overview');
	$effect(() => {
		let raf = 0;
		const update = () => {
			raf = 0;
			const line = window.innerHeight * 0.25;
			let current = SECTIONS[0].id;
			for (const section of SECTIONS) {
				const el = document.getElementById(section.id);
				if (el && el.getBoundingClientRect().top <= line) current = section.id;
			}
			if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
				current = SECTIONS[SECTIONS.length - 1].id;
			}
			activeSection = current;
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(update);
		};
		update();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});
</script>

<svelte:head>
	<title>RSTR help — settings & features</title>
	<meta
		name="description"
		content="What every RSTR setting does: image adjustments, segmentation, lines, layers, presets, export, plot time — plus the prep tool and the classic app."
	/>
</svelte:head>

<div class="help">
	<h1 id="overview">help</h1>
	<nav class="toc" aria-label="on this page">
		<div class="toc-title">on this page</div>
		<ol>
			{#each SECTIONS as section (section.id)}
				<li>
					<a
						href="#{section.id}"
						class:active={activeSection === section.id}
						style={section.color ? `--c: ${section.color}` : ''}
					>
						{#if section.num}
							<span class="toc-dot">{section.num}</span>
						{:else}
							<span class="toc-gap"></span>
						{/if}
						<span>{section.title}</span>
					</a>
				</li>
			{/each}
		</ol>
	</nav>
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
				height="1405"
			/>
		</a>
	</figure>
	<ol class="map">
		{#each mapSections as section (section.id)}
			<li style="--c: {section.color}">
				<span class="map-dot">{section.num}</span>
				<span>
					<a class="map-title" href="#{section.id}"><strong>{section.title}</strong></a>
					— {section.blurb}
				</span>
			</li>
		{/each}
	</ol>

	<section id="image">
		<h2>image</h2>
		<dl>
			<dt>browse / drop</dt>
			<dd>
				Load an image or video from your device — or drop it straight onto the render. Nothing is
				uploaded; all processing happens in your browser.
			</dd>
			<dt>input thumbnail</dt>
			<dd>Hold it down to peek at the input with the adjustments below applied.</dd>
			<dt>crop / reposition</dt>
			<dd>
				Zoom in on the interesting part by manipulating the input right on the render: drag to move
				it, scroll to zoom on the cursor (a trackpad pinch works too), alt/⌥ + scroll to rotate — on
				a touch screen, drag, pinch and twist with two fingers while one finger keeps scrolling the
				page. While you're reframing, the input shows with a composition grid and an accent border
				along its own edge — so you can see where it ends even on a white background; let go and the
				lines recompute for the new framing, which also carries into every export (a video keeps one
				framing across all its frames). Double-click the render — or the
				<em>⛶ full image</em> chip that appears — to get the whole picture back.
			</dd>
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

	<section id="video">
		<h2>video</h2>
		<dl>
			<dt>supported formats</dt>
			<dd>
				Whatever your browser can decode — MP4 (H.264) and WebM play everywhere. HEVC (H.265)
				videos, like the .mov recordings phones make, don't decode in many browsers; the studio will
				tell you when that happens. Convert those to MP4 (H.264) first — QuickTime's export,
				<a href="https://handbrake.fr" target="_blank" rel="noopener">HandBrake</a>, or
				<code>ffmpeg -i input.mov -c:v libx264 -pix_fmt yuv420p output.mp4</code> — and load the result.
			</dd>
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

	<section id="segmentation">
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

	<section id="lines">
		<h2>lines</h2>
		<dl>
			<dt>pen width (mm)</dt>
			<dd>Physical line width used for rendering and spacing math. Layers can override it.</dd>
			<dt>ink gamma</dt>
			<dd>Perceptual weight on ink intensity before it becomes line spacing.</dd>
			<dt>ink boost</dt>
			<dd>Coverage multiplier — above 1 pushes dark regions into overlapping lines.</dd>
			<dt>ink threshold</dt>
			<dd>
				The band of ink a region must fall in to be hatched. The low bound is a high-pass filter —
				regions holding less ink stay empty; the high bound is a low-pass filter — regions holding
				more ink stay empty too (leave it at 1 to keep every dark region). Narrow the band from both
				ends to isolate the midtones.
			</dd>
			<dt>spacing (mm)</dt>
			<dd>
				Nominal min–max line spacing. Each region lands somewhere in this range based on its ink:
				dense lines where the image is dark, sparse where it's light.
			</dd>
		</dl>
		<figure class="shot">
			<a href="/help/hand-drawn.webp" target="_blank" rel="noopener">
				<img
					src="/help/hand-drawn.webp"
					alt="the same render region twice — hand-drawn off with perfectly straight hatch lines on the left, hand-drawn on with organic wavy lines on the right"
					width="2000"
					height="1250"
					loading="lazy"
				/>
			</a>
		</figure>
		<dl>
			<dt>hand-drawn lines</dt>
			<dd>
				Swap the perfectly straight hatch lines for organic, hand-drawn-looking ones. Off by default
				— and off means untouched: the classic ruler-straight output stays exactly as it was. When
				on, the same wobble flows through everything consistently — preview, SVG and PNG exports,
				frame sequences and the plot-time estimate (squiggly lines are longer, so plots take a bit
				more time). The wobble is deterministic: the same settings always draw the same squiggles.
			</dd>
			<dt>squiggle (mm)</dt>
			<dd>
				How far a line may wander from perfectly straight — the squiggliness. Lines keep their exact
				endpoints and short strokes stay steadier, so regions keep their shape.
			</dd>
			<dt>wave (mm)</dt>
			<dd>
				Distance between direction changes along a line — short makes a nervous scribble, long makes
				lazy waves.
			</dd>
			<dt>variation</dt>
			<dd>Rerolls the wobble pattern without changing its character.</dd>
		</dl>
	</section>

	<section id="presets">
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
				your browser. A fresh visit opens on a random built-in. Presets are about the look: your
				output width and margin stay yours (any values stored in older preset files are ignored).
			</dd>
			<dt>export / import .json</dt>
			<dd>Move settings between browsers or share them as a small JSON file.</dd>
		</dl>
	</section>

	<section id="layers">
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
				channels), key / darkness, red / green / blue, or (inverted) luminance. "Match pen color"
				instead derives the channel from the layer's pen color.
			</dd>
			<dt>angle min / max</dt>
			<dd>
				Hatch direction range — every region picks its own angle within it, based on the region's
				shape, so one layer never looks mechanical.
			</dd>
			<dt>overrides</dt>
			<dd>
				Pen width, the threshold band (low / high), spacing, ink gamma and ink boost can be set per
				layer. Empty fields inherit the global lines values (shown as grey italics); "clear
				overrides" resets them all.
			</dd>
		</dl>
	</section>

	<section id="export">
		<h2>export</h2>
		<dl>
			<dt>width (mm)</dt>
			<dd>
				Physical output width — the height follows the image aspect. This is your own setting:
				presets and the dice never touch it, and it stays put while you switch inputs.
			</dd>
			<dt>output format</dt>
			<dd>
				Optionally compose onto a fixed sheet instead. Toggle A6–A3 (tap again to turn off — at most
				one is active), or pick more sizes from the list: A2–A0, B-series, US letter/legal/ tabloid,
				squares, AxiDraw beds and a custom width × height. The render takes the page's shape, the
				export becomes exactly that page, and the whole image starts fitted inside the margins —
				from there, crop and reposition it into the sheet with the usual gestures. Named sheets are
				turned to match the input (flip them with ⇄); a new input starts back at no format.
			</dd>
			<dt>margin (mm)</dt>
			<dd>
				With a format active, the margin is a mask: a band this wide around the sheet's edge is kept
				clear of ink, whatever the composition puts there — like a matted print, and safe for the
				plotter's paper clamps. The reframing view dims the masked band while you compose. Defaults
				to 10mm; 0 disables the mask.
			</dd>
			<dt>↓ SVG</dt>
			<dd>A plottable SVG with one layer group per pen, ready for plotter software.</dd>
			<dt>↓ PNG</dt>
			<dd>The current render as an image — for screens, sharing and regular printing.</dd>
			<dt>⚡ order this plot</dt>
			<dd>
				No plotter? I'll plot it for you — real pens on paper, shipped flat-packed with tracking,
				shipping included in the price. Orders are limited to the inks in the built-in presets and
				sizes up to A3; the order dialog tells you if a design needs adjusting. Only the exported
				SVG — the lines to draw — is sent with your order, never your image, and it's used solely to
				produce your plot.
			</dd>
		</dl>
	</section>

	<section id="stats">
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

	<section id="prep">
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
			<dt>multiple SVGs</dt>
			<dd>
				Drop several same-size SVGs, a folder, or the studio's frame-sequence zip (SVGs in the root
				or an <code>svg/</code> subfolder) — geared to the video export. Frames are laid out as a grid
				with an adjustable per-frame margin, gap and edge clearance, across as many pages as needed. Matching
				layers of all frames are combined so pen selection in saxi stays simple, and each frame carries
				its number in plottable single-stroke digits. Export downloads a zip with one page SVG per sheet.
			</dd>
			<dt>paper outline</dt>
			<dd>
				Marks where to place the physical paper — sized to the artwork (or each frame) or a fixed
				format, plus margin, drawn as a full rectangle, corner marks or crosses.
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
				line gets plotted twice for denser ink. Works on the studio's hand-drawn wobbly lines too:
				every squiggle is retraced point for point, just backwards.
			</dd>
			<dt>export SVG</dt>
			<dd>Downloads the decorated SVG with everything on its own (Inkscape-compatible) layer.</dd>
		</dl>
	</section>

	<section id="classic">
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

	<section id="good-to-know">
		<h2>good to know</h2>
		<dl>
			<dt>private by design</dt>
			<dd>
				Images, videos and settings never leave your device. The one deliberate exception: ordering
				a plot sends the exported SVG — the drawn lines, never your image — along with your order,
				and it's used solely to produce that plot.
			</dd>
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

	/* the legend titles link to their section — the site's dashed link style
	   provides the affordance */
	.map-title {
		color: inherit;
	}

	section {
		padding: 1.75rem 0;
		border-top: 1px solid var(--border-c);
	}

	/* anchor targets land just below the sticky top bar */
	section,
	h1 {
		scroll-margin-top: 3.5rem;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(html) {
			scroll-behavior: smooth;
		}
	}

	/* ------------------------------------------- on-this-page panel */

	/* Fixed beside the centered column on desktop, absent elsewhere — the
	   legend anchors cover navigation on small screens. */
	.toc {
		display: none;
	}

	@media (min-width: 1200px) {
		.toc {
			display: block;
			position: fixed;
			top: 5.5rem;
			/* right of the 46rem content column, 1rem off its padded edge */
			left: calc(50vw + 24rem);
			width: 11.5rem;
			max-height: calc(100vh - 7rem);
			overflow-y: auto;
		}

		.toc-title {
			font-family: 'mono-bold', monospace;
			font-size: 0.68rem;
			text-transform: uppercase;
			letter-spacing: 0.08em;
			color: var(--muted-c);
			margin: 0 0 0.6rem;
			padding-left: 0.5rem;
		}

		.toc ol {
			list-style: none;
			margin: 0;
			padding: 0;
		}

		.toc li + li {
			margin-top: 0.15rem;
		}

		.toc a {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 0.2rem 0.5rem;
			border: none;
			border-left: 2px solid transparent;
			border-radius: 0 4px 4px 0;
			font-family: 'mono-light', monospace;
			font-size: 0.78rem;
			color: var(--muted-c);
		}

		.toc a:hover {
			color: var(--ink);
			border-left-color: var(--border-c);
		}

		.toc a.active {
			color: var(--ink);
			border-left-color: var(--ink);
			background: var(--muted-light);
		}

		.toc-dot,
		.toc-gap {
			flex-shrink: 0;
			width: 1rem;
		}

		.toc-dot {
			height: 1rem;
			border-radius: 50%;
			background: var(--c, var(--muted-c));
			color: #fff;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			font-family: 'mono-bold', monospace;
			font-size: 0.6rem;
		}
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

	dd code {
		font-family: 'mono-light', monospace;
		font-size: 0.72rem;
		overflow-wrap: anywhere;
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

// Video input support: output-frame math for sampling a video at a chosen
// frame rate, plus persistence of the sequence-export options.
//
// Browsers don't expose a video's native frame rate, so everything is
// expressed in *output* frames at the user-chosen fps: frame n is sampled at
// the midpoint of its 1/fps slot, which keeps seeks away from the t=0 and
// t=duration edges where decoders are unreliable.

export type RasterFormat = 'png' | 'jpeg' | 'webp';

export interface VideoExportConfig {
	/** output frame rate the video is sampled at */
	fps: number;
	/** frames skipped from the start (at the output fps) */
	startFrame: number;
	/** cap on the number of exported frames */
	maxFrames: number;
	exportSvg: boolean;
	exportRaster: boolean;
	rasterFormat: RasterFormat;
	/** 0.05..1 — jpeg/webp encoder quality (png ignores it) */
	rasterQuality: number;
	/** 0.1..1 — raster output size relative to the video resolution */
	rasterScale: number;
}

export const VIDEO_STORAGE_KEY = 'rstr:v2:video';

export const MAX_SEQUENCE_FRAMES = 2000;

const RASTER_FORMATS: RasterFormat[] = ['png', 'jpeg', 'webp'];

export const defaultVideoConfig = (): VideoExportConfig => ({
	fps: 12,
	startFrame: 0,
	maxFrames: 120,
	exportSvg: true,
	exportRaster: false,
	rasterFormat: 'png',
	rasterQuality: 0.85,
	rasterScale: 1
});

const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

/** total output frames a video of the given duration yields at this fps */
export const totalFrameCount = (durationSec: number, fps: number): number => {
	if (!isFinite(durationSec) || durationSec <= 0 || fps <= 0) return 0;
	return Math.max(1, Math.floor(durationSec * fps));
};

/** sample time of an output frame — slot midpoint, clamped inside the video */
export const frameTime = (frame: number, fps: number, durationSec: number): number => {
	const t = (frame + 0.5) / fps;
	return clamp(t, 0, Math.max(durationSec - 0.001, 0));
};

export interface FrameRange {
	/** first exported frame index */
	start: number;
	/** number of exported frames */
	count: number;
	/** total frames available at the current fps */
	total: number;
}

/** resolve start offset + frame cap against the actual video duration */
export const exportFrameRange = (durationSec: number, config: VideoExportConfig): FrameRange => {
	const total = totalFrameCount(durationSec, config.fps);
	if (total === 0) return { start: 0, count: 0, total: 0 };
	const start = clamp(Math.floor(config.startFrame), 0, total - 1);
	const count = clamp(Math.floor(config.maxFrames), 1, total - start);
	return { start, count, total };
};

/**
 * Merge a parsed value over the defaults, keeping only sane values — same
 * contract as sanitizeParams in params.ts.
 */
export const sanitizeVideoConfig = (parsed: unknown): VideoExportConfig => {
	const config = defaultVideoConfig();
	if (typeof parsed !== 'object' || parsed === null) return config;
	const source = parsed as Record<string, unknown>;
	for (const key of Object.keys(config) as (keyof VideoExportConfig)[]) {
		const value = source[key];
		if (typeof value === typeof config[key]) {
			(config as unknown as Record<string, unknown>)[key] = value;
		}
	}
	if (!RASTER_FORMATS.includes(config.rasterFormat)) config.rasterFormat = 'png';
	config.fps = clamp(Math.round(config.fps), 1, 60);
	config.startFrame = Math.max(0, Math.floor(config.startFrame));
	config.maxFrames = clamp(Math.floor(config.maxFrames), 1, MAX_SEQUENCE_FRAMES);
	config.rasterQuality = clamp(config.rasterQuality, 0.05, 1);
	config.rasterScale = clamp(config.rasterScale, 0.1, 1);
	return config;
};

export const parseStoredVideoConfig = (json: string | null): VideoExportConfig => {
	if (!json) return defaultVideoConfig();
	try {
		return sanitizeVideoConfig(JSON.parse(json));
	} catch {
		// corrupted storage falls back to defaults
		return defaultVideoConfig();
	}
};

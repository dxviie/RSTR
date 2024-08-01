export type RstrConfig = {
	// image
	file: string;
	// grid
	resolution: number;
	// grouping
	iterations: number;
	tolerance: number;
	// hatching
	halves: boolean;
	density: number;
	// colors
	color_a: RstrColor;
	color_b: RstrColor;
	color_c: RstrColor;
}

export type RstrColor = {
	r: number;
	g: number;
	b: number;
}

const initialState = {
	// image
	file: '',
	// grid
	resolution: 33,
	// grouping
	iterations: 3,
	tolerance: 0.33,
	// hatching
	halves: false,
	density: .66,
	// colors
	color_a: { r: 255, g: 0, b: 255 },
	color_b: { r: 255, g: 255, b: 0 },
	color_c: { r: 0, g: 255, b: 255 }
};

const updateConfig = (newValues: { [s: string]: unknown; } | ArrayLike<unknown>) => {
	for (const [key, value] of Object.entries(newValues)) {
		if (key in config) {
			config[key] = value;
		}
	}
};

export const config: RstrConfig = $state({ ...initialState });

export const configActions = {
	update: updateConfig,
	reset: () => updateConfig(initialState)
};


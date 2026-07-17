// @ts-nocheck — /classic legacy code — kept for nostalgia, intentionally left as-is and not type-checked.
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
	colors: RstrColor[];
};

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
	density: 0.66,
	// colors
	colors: []
};

const updateConfig = (newValues: { [s: string]: unknown } | ArrayLike<unknown>) => {
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

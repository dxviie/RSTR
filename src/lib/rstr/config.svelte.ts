export type RstrConfig = {
	// image
	file: string;
	// grid building
	resolution: number;
	iterations: number;
	tolerance: number;
	// hatching
	density: number;
}

const initialState = {
	// image
	file: '',
	// grid building
	resolution: 33,
	iterations: 3,
	tolerance: 0.33,
	// hatching
	density: .66
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


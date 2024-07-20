export type RstrConfig = {
	// image
	file: string;
	// grid building
	resolution: number;
	iterations: number;
	tolerance: number;
	// hatching
	blockLineCount: number;
}

const initialState = {
	// image
	file: '',
	// grid building
	resolution: 27,
	iterations: 1,
	tolerance: 0.27,
	// hatching
	blockLineCount: 27
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


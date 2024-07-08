const initialState = {
	// image
	file: null,
	// grid building
	resolution: 33,
	iterations: 3,
	tolerance: 0.33,
	// hatching
	blockLineCount: 33
};

export const config = $state({ ...initialState });

export const configActions = {
	// get value() { return state },
	update: (newValues) => {
		for (const [key, value] of Object.entries(newValues)) {
			if (key in config) {
				config[key] = value;
			}
		}
	},
	reset: () => {
		config.file = initialState.file;
		config.resolution = initialState.resolution;
		config.iterations = initialState.iterations;
		config.tolerance = initialState.tolerance;
		config.blockLineCount = initialState.blockLineCount;
	},
};


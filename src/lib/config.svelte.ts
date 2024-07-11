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

const updateConfig = (newValues: { [s: string]: unknown; } | ArrayLike<unknown>) => {
	for (const [key, value] of Object.entries(newValues)) {
		if (key in config) {
			config[key] = value;
		}
	}
}

export const config: { [key: string]: any } = $state({ ...initialState });

export const configActions = {
	update: updateConfig,
	reset: () => updateConfig(initialState)
};


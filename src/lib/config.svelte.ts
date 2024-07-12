const initialState = {
	// image
	file: "",
	// grid building
	resolution: 10,
	iterations: 3,
	tolerance: 0.5,
	// hatching
	blockLineCount: 27
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


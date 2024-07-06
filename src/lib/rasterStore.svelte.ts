export const config = $state({
	// image
	file: null,
	// grid building
	resolution: 33,
	iterations: 3,
	tolerance: 0.33,
	// hatching
	blockLineCount: 33
});

// You can add derived values if needed
// export const derivedValue = $derived(config.resolution * config.iterations);

// You can also add methods to update the state
export function updateConfig(newValues) {
	for (const [key, value] of Object.entries(newValues)) {
		if (key in config) {
			config[key] = value;
		}
	}
}
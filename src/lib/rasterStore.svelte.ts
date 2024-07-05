export let config = $state({
	// image
	file: null,
	// grid building
	resolution: 27,
	iterations: 1,
	tolerance: 0.8,
	// hatching
	blockLineCount: 9
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
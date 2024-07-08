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

let state = $state({ ...initialState });

export const config = {
	get value() { return state },
	update: (newValues) => {
		state = {
			...state,
			...newValues,
		}
		console.log('config UPDATED::', state);
	},
	reset: () => {
		state = {
			...initialState,
		};
	},
};


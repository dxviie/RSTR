export type RstrActionType = 'button' | 'input' | 'system';
export type RstrState = 'config' | 'render' | 'done' | 'error' | 'loading';
export type RstrAction = {
	label: string;
	action: () => boolean;
	type: RstrActionType;
}

const initialState = { status: 'config' as RstrState };

export const rstrState: { status: RstrState } = $state(initialState);

const transitions = {
	startRendering: () => {
		if (rstrState.status === 'config') {
			console.debug('Status update: config -> render');
			rstrState.status = 'render';
			return true;
		}
		console.warn('Cannot start rendering from state', rstrState);
		return false;
	},
	renderingFinished: () => {
		if (rstrState.status === 'render') {
			console.debug('Status update: render -> done');
			rstrState.status = 'done';
			return true;
		}
		console.warn('Cannot finish rendering from state', rstrState);
		return false;
	},
	renderingStopped: () => {
		if (rstrState.status === 'render') {
			console.debug('Status update: render -> done');
			rstrState.status = 'done';
			return true;
		}
		console.warn('Cannot stop rendering from state', rstrState);
		return false;
	},
	error: (err: string) => {
		rstrState.status = 'error';
		console.error(err);
	},
	reset: () => {
		if (rstrState.status === 'done' || rstrState.status === 'error') {
			console.debug('Status update: done/error -> ``config');
			rstrState.status = 'config';
			return true;
		}
		console.warn('Cannot reset from state', rstrState);
		return false;
	},
	loadingImage: () => {
		if (rstrState.status === 'config') {
			console.debug('Status update: config -> loading');
			rstrState.status = 'loading';
			return true;
		}
		console.warn('Cannot start loading image from state', rstrState);
		return false;
	},
	imageLoaded: () => {
		if (rstrState.status === 'loading') {
			console.debug('Status update: loading -> config');
			rstrState.status = 'config';
			return true;
		}
		console.warn('Cannot finish loading image from state', rstrState);
		return false;
	}
};

const actions = {
	startRendering: {
		label: 'RENDER',
		action: transitions.startRendering,
		type: 'button' as RstrActionType
	},
	renderingFinished: {
		label: 'DONE',
		action: transitions.renderingFinished,
		type: 'system' as RstrActionType
	},
	renderingStopped: {
		label: 'STOP',
		action: transitions.renderingStopped,
		type: 'button' as RstrActionType
	},
	reset: {
		label: 'RESET',
		action: transitions.reset,
		type: 'button' as RstrActionType
	},
	loadingImage: {
		label: 'SELECT IMAGE',
		action: transitions.loadingImage,
		type: 'input' as RstrActionType
	},
	imageLoaded: {
		label: 'IMAGE LOADED',
		action: transitions.imageLoaded,
		type: 'system' as RstrActionType
	}
};

export const getActionsForStatus = (status: string): RstrAction[] => {
	if (status === 'config') {
		return [actions.startRendering, actions.loadingImage];
	}
	if (status === 'render') {
		return [actions.renderingFinished, actions.renderingStopped];
	}
	if (status === 'done') {
		return [actions.reset];
	}
	if (status === 'error') {
		return [actions.reset];
	}
	if (status === 'loading') {
		return [actions.imageLoaded];
	}
	return [];
}
export type RstrActionType = 'button' | 'input' | 'system';
export type RstrState = 'config' | 'render' | 'done' | 'error' | 'loading' | 'exporting';
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
		console.warn('Cannot start rendering from state', rstrState.status);
		return false;
	},
	renderingFinished: () => {
		if (rstrState.status === 'render') {
			console.debug('Status update: render -> done');
			rstrState.status = 'done';
			return true;
		}
		console.warn('Cannot finish rendering from state', rstrState.status);
		return false;
	},
	renderingStopped: () => {
		if (rstrState.status === 'render') {
			console.debug('Status update: render -> done');
			rstrState.status = 'done';
			return true;
		}
		console.warn('Cannot stop rendering from state', rstrState.status);
		return false;
	},
	error: (err: string) => {
		rstrState.status = 'error';
		console.error(err);
	},
	reset: () => {
		if (rstrState.status === 'done' || rstrState.status === 'error') {
			console.debug('Status update: done/error -> config');
			rstrState.status = 'config';
			return true;
		}
		console.warn('Cannot reset from state', rstrState.status);
		return false;
	},
	loadingImage: () => {
		if (rstrState.status === 'config') {
			console.debug('Status update: config -> loading');
			rstrState.status = 'loading';
			return true;
		}
		console.warn('Cannot start loading image from state', rstrState.status);
		return false;
	},
	imageLoaded: () => {
		if (rstrState.status === 'loading') {
			console.debug('Status update: loading -> config');
			rstrState.status = 'config';
			return true;
		}
		console.warn('Cannot finish loading image from state', rstrState.status);
		return false;
	},
	exporting: () => {
		if (rstrState.status === 'done') {
			console.debug('Status update: done -> exporting');
			rstrState.status = 'exporting';
			return true;
		}
		console.warn('Cannot start exporting from state', rstrState.status);
		return false;
	},
	exported: () => {
		if (rstrState.status === 'exporting') {
			console.debug('Status update: exporting -> done');
			rstrState.status = 'done';
			return true;
		}
		console.warn('Cannot finish exporting from state', rstrState.status);
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
	},
	exporting: {
		label: 'EXPORT',
		action: transitions.exporting,
		type: 'button' as RstrActionType
	},
	exported: {
		label: 'EXPORTED',
		action: transitions.exported,
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

export const renderingFinished: RstrAction = actions.renderingFinished;
export const loadingImage: RstrAction = actions.loadingImage;
export const imageLoaded: RstrAction = actions.imageLoaded;
export const exporting: RstrAction = actions.exporting;
export const exported: RstrAction = actions.exported;
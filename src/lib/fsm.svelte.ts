export let status : 'config' | 'render' | 'done' | 'error' | 'loading' = $state('config');

export const transitions = {
	startRendering: () =>  {
		if(status === 'config') {
			console.debug('Status update: config -> render');
			status = 'render'
			return true;
		}
		console.warn('Cannot start rendering from state', status);
		return false;
	},
	renderingFinished: () => {
		if(status === 'render') {
			console.debug('Status update: render -> done');
			status = 'done';
			return true;
		}
		console.warn('Cannot finish rendering from state', status);
		return false;
	},
	renderingStopped: () => {
		if(status === 'render') {
			console.debug('Status update: render -> done');
			status = 'done';
			return true;
		}
		console.warn('Cannot stop rendering from state', status);
		return false;
	},
	error: (err: string) => {
		status = 'error';
		console.error(err);
	},
	reset: () => {
		if (status === 'done' || status === 'error') {
			console.debug('Status update: done/error -> config');
			status = 'config';
			return true;
		}
		console.warn('Cannot reset from state', status);
		return false;
	},
	loadingImage: () => {
		if(status === 'config') {
			console.debug('Status update: config -> loading');
			status = 'loading';
			return true;
		}
		console.warn('Cannot start loading image from state', status);
		return false;
	},
	imageLoaded: () => {
		if(status === 'loading') {
			console.debug('Status update: loading -> config');
			status = 'config';
			return true;
		}
		console.warn('Cannot finish loading image from state', status);
		return false;
	}
};
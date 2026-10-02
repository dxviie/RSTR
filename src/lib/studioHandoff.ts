// Hands a file picked on the landing page over to the studio, in memory
// only. The landing page parks the File object right before a client-side
// navigation to /studio, and the studio takes it once as it starts.
// Nothing is uploaded or stored; a full page load simply drops it.

let pending: File | null = null;

export const handOffFile = (file: File) => {
	pending = file;
};

/** the parked file, once: taking it clears it */
export const takeHandedOffFile = (): File | null => {
	const file = pending;
	pending = null;
	return file;
};

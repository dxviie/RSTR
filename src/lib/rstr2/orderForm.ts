// Tally order-form wiring: lazy widget loading and the popup handoff.
//
// The studio page ships no third-party scripts. Tally's widget is fetched the
// moment someone actually orders — and if it can't load (offline, blocked),
// the caller falls back to the plain form URL in a new tab.

/** The RSTR order form (kept as a draft on Tally while in development). */
export const ORDER_FORM_ID = 'NpQY5G';

const TALLY_WIDGET_SRC = 'https://tally.so/widgets/embed.js';

interface TallyPopupOptions {
	layout?: 'default' | 'modal';
	width?: number;
	overlay?: boolean;
	autoClose?: number;
	hiddenFields?: Record<string, string>;
	onClose?: () => void;
	onSubmit?: (payload: unknown) => void;
}

interface TallyWidget {
	openPopup(formId: string, options?: TallyPopupOptions): void;
	closePopup(formId: string): void;
}

declare global {
	interface Window {
		Tally?: TallyWidget;
	}
}

let widgetPromise: Promise<TallyWidget | null> | null = null;

const loadWidget = (): Promise<TallyWidget | null> => {
	if (typeof window === 'undefined') return Promise.resolve(null);
	if (window.Tally) return Promise.resolve(window.Tally);
	widgetPromise ??= new Promise((resolve) => {
		const script = document.createElement('script');
		script.src = TALLY_WIDGET_SRC;
		script.async = true;
		script.onload = () => resolve(window.Tally ?? null);
		script.onerror = () => {
			// leave the promise unset so a later attempt retries the load
			widgetPromise = null;
			script.remove();
			resolve(null);
		};
		document.head.appendChild(script);
	});
	return widgetPromise;
};

/** The plain form URL with the payload as query params — new-tab fallback. */
export const orderFormUrl = (hiddenFields: Record<string, string>): string => {
	const query = new URLSearchParams(hiddenFields).toString();
	return `https://tally.so/r/${ORDER_FORM_ID}${query ? `?${query}` : ''}`;
};

/**
 * Open the order form as a Tally popup over the studio. Resolves false when
 * the widget can't load — the caller should offer orderFormUrl instead.
 */
export const openOrderPopup = async (
	hiddenFields: Record<string, string>,
	onClose?: () => void
): Promise<boolean> => {
	const tally = await loadWidget();
	if (!tally) return false;
	tally.openPopup(ORDER_FORM_ID, {
		layout: 'modal',
		width: 480,
		overlay: true,
		// give the thank-you page a beat, then tidy up after submission
		autoClose: 5000,
		hiddenFields,
		onClose
	});
	return true;
};

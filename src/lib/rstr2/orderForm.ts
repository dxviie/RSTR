// Tally order-form wiring: embed URL construction and the postMessage protocol.
//
// The studio used to hand off to Tally's widget script, but the widget loads
// its popup from a `tally.so/popup/…` URL — a path adblock filter lists block
// on sight, which left blocked visitors staring at an endless spinner. So no
// third-party script at all anymore: the studio renders its own modal around
// a plain iframe on the standard `/embed/` path and drives the spinner, the
// auto-close and the blocked fallback off the messages the embedded form
// posts to its parent window (the same events the widget listened for).

/** The RSTR order form on Tally. */
export const ORDER_FORM_ID = 'NpQY5G';

/** Only messages from this origin count as signals from the embedded form. */
export const TALLY_ORIGIN = 'https://tally.so';

/** How long the embed gets to show a sign of life before the fallback shows. */
export const ORDER_EMBED_TIMEOUT_MS = 8000;

/** How long the thank-you page stays up after submission before auto-close. */
export const ORDER_AUTOCLOSE_MS = 5000;

/** The plain form URL with the payload as query params — new-tab fallback. */
export const orderFormUrl = (hiddenFields: Record<string, string>): string => {
	const query = new URLSearchParams(hiddenFields).toString();
	return `${TALLY_ORIGIN}/r/${ORDER_FORM_ID}${query ? `?${query}` : ''}`;
};

/**
 * The iframe src for the in-studio order modal: the standard embed path with
 * the payload as query params. alignLeft keeps the form flush in the modal
 * card, matching how the old widget popup rendered it.
 */
export const orderEmbedUrl = (hiddenFields: Record<string, string>): string => {
	const query = new URLSearchParams({ alignLeft: '1', ...hiddenFields });
	return `${TALLY_ORIGIN}/embed/${ORDER_FORM_ID}?${query.toString()}`;
};

/** What a window message means for the order modal. */
export type OrderFormSignal = 'alive' | 'submitted';

/**
 * Classify a window message arriving while the order modal is open. Only
 * frames served from tally.so can post with that origin, so any such message
 * proves the embed is up — height reports and page views count as much as the
 * official Tally.FormLoaded. A Tally.FormSubmitted for this form becomes
 * 'submitted' so the modal can auto-close after the thank-you page.
 */
export const orderFormSignal = (origin: string, data: unknown): OrderFormSignal | null => {
	if (origin !== TALLY_ORIGIN) return null;
	if (typeof data === 'string') {
		try {
			const message = JSON.parse(data) as { event?: unknown; payload?: { formId?: unknown } };
			if (message?.event === 'Tally.FormSubmitted' && message.payload?.formId === ORDER_FORM_ID)
				return 'submitted';
		} catch {
			// not JSON — an iframe-resizer heartbeat, still proof of life
		}
	}
	return 'alive';
};

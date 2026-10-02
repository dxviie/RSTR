// Tally form wiring for the plot funnel: embed URL construction and the
// postMessage protocol. Two forms share it. The order form takes a priced
// studio design straight to payment; the inquiry form starts a free chat
// about a plot instead, from the landing page or the studio. The landing
// page's #madewithrstr share form ($lib/landing/share) uses it too.
//
// The studio used to hand off to Tally's widget script, but the widget loads
// its popup from a `tally.so/popup/…` URL — a path adblock filter lists block
// on sight, which left blocked visitors staring at an endless spinner. So no
// third-party script at all anymore: pages render their own modal around a
// plain iframe on the standard `/embed/` path (see TallyEmbed.svelte) and
// drive the spinner, the auto-close and the blocked fallback off the messages
// the embedded form posts to its parent window (the same events the widget
// listened for).

/** The RSTR order form on Tally: a priced design, straight to payment. */
export const ORDER_FORM_ID = 'NpQY5G';

/** The inquiry form: a free chat about a plot, before or instead of an order. */
export const INQUIRY_FORM_ID = '44e0Ko';

/** Only messages from this origin count as signals from the embedded form. */
export const TALLY_ORIGIN = 'https://tally.so';

/** How long the embed gets to show a sign of life before the fallback shows. */
export const EMBED_TIMEOUT_MS = 8000;

/** How long the thank-you page stays up after submission before auto-close. */
export const EMBED_AUTOCLOSE_MS = 5000;

/** The plain form URL with the payload as query params — new-tab fallback. */
export const formUrl = (formId: string, hiddenFields: Record<string, string>): string => {
	const query = new URLSearchParams(hiddenFields).toString();
	return `${TALLY_ORIGIN}/r/${formId}${query ? `?${query}` : ''}`;
};

/**
 * The iframe src for an in-page form modal: the standard embed path with
 * the payload as query params. alignLeft keeps the form flush in the modal
 * card, matching how the old widget popup rendered it.
 */
export const formEmbedUrl = (formId: string, hiddenFields: Record<string, string>): string => {
	const query = new URLSearchParams({ alignLeft: '1', ...hiddenFields });
	return `${TALLY_ORIGIN}/embed/${formId}?${query.toString()}`;
};

/** What a window message means for an open form modal. */
export type FormSignal = 'alive' | 'submitted';

/**
 * Classify a window message arriving while a form modal is open. Only
 * frames served from tally.so can post with that origin, so any such message
 * proves the embed is up — height reports and page views count as much as the
 * official Tally.FormLoaded. A Tally.FormSubmitted for the open form becomes
 * 'submitted' so the modal can auto-close after the thank-you page.
 */
export const formSignal = (formId: string, origin: string, data: unknown): FormSignal | null => {
	if (origin !== TALLY_ORIGIN) return null;
	if (typeof data === 'string') {
		try {
			const message = JSON.parse(data) as { event?: unknown; payload?: { formId?: unknown } };
			if (message?.event === 'Tally.FormSubmitted' && message.payload?.formId === formId)
				return 'submitted';
		} catch {
			// not JSON — an iframe-resizer heartbeat, still proof of life
		}
	}
	return 'alive';
};

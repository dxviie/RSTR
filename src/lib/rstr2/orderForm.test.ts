import { describe, it, expect } from 'vitest';
import {
	orderEmbedUrl,
	orderFormSignal,
	orderFormUrl,
	ORDER_FORM_ID,
	TALLY_ORIGIN
} from './orderForm';

describe('order form urls', () => {
	it('builds the plain form url with the payload as query params', () => {
		expect(orderFormUrl({ price: '45', tier: 'A5' })).toBe(
			`https://tally.so/r/${ORDER_FORM_ID}?price=45&tier=A5`
		);
	});

	it('leaves the plain url bare when there is no payload', () => {
		expect(orderFormUrl({})).toBe(`https://tally.so/r/${ORDER_FORM_ID}`);
	});

	it('embeds via the standard embed path, never the widget popup path', () => {
		const url = new URL(orderEmbedUrl({ price: '45', inks: 'Copic Fineliner 0.4mm' }));
		expect(url.origin).toBe(TALLY_ORIGIN);
		expect(url.pathname).toBe(`/embed/${ORDER_FORM_ID}`);
		expect(url.searchParams.get('price')).toBe('45');
		expect(url.searchParams.get('inks')).toBe('Copic Fineliner 0.4mm');
		expect(url.searchParams.get('alignLeft')).toBe('1');
		// '/popup/' URLs sit on adblock filter lists — the bug that killed the widget
		expect(url.pathname).not.toContain('popup');
	});
});

describe('orderFormSignal', () => {
	const submitted = JSON.stringify({
		event: 'Tally.FormSubmitted',
		payload: { formId: ORDER_FORM_ID }
	});

	it('ignores messages from other origins', () => {
		expect(orderFormSignal('https://evil.example', submitted)).toBeNull();
		expect(orderFormSignal('https://tally.so.evil.example', submitted)).toBeNull();
	});

	it('treats any tally.so message as proof the embed is alive', () => {
		const loaded = JSON.stringify({
			event: 'Tally.FormLoaded',
			payload: { formId: ORDER_FORM_ID }
		});
		expect(orderFormSignal(TALLY_ORIGIN, loaded)).toBe('alive');
		// iframe-resizer heartbeats are plain strings, not JSON
		expect(orderFormSignal(TALLY_ORIGIN, '[iFrameSizer]iFrameResizer0:0:0:init')).toBe('alive');
		expect(orderFormSignal(TALLY_ORIGIN, { event: 'not-a-string-payload' })).toBe('alive');
	});

	it('reports a submission of this form', () => {
		expect(orderFormSignal(TALLY_ORIGIN, submitted)).toBe('submitted');
	});

	it("keeps another form's submission as merely alive", () => {
		const other = JSON.stringify({ event: 'Tally.FormSubmitted', payload: { formId: 'xyz123' } });
		expect(orderFormSignal(TALLY_ORIGIN, other)).toBe('alive');
	});
});

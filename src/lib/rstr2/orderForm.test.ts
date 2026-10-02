import { describe, it, expect } from 'vitest';
import {
	formEmbedUrl,
	formSignal,
	formUrl,
	INQUIRY_FORM_ID,
	ORDER_FORM_ID,
	TALLY_ORIGIN
} from './orderForm';

describe('form urls', () => {
	it('builds the plain form url with the payload as query params', () => {
		expect(formUrl(ORDER_FORM_ID, { price: '45', tier: 'A5' })).toBe(
			`https://tally.so/r/${ORDER_FORM_ID}?price=45&tier=A5`
		);
	});

	it('leaves the plain url bare when there is no payload', () => {
		expect(formUrl(ORDER_FORM_ID, {})).toBe(`https://tally.so/r/${ORDER_FORM_ID}`);
	});

	it('embeds via the standard embed path, never the widget popup path', () => {
		const url = new URL(
			formEmbedUrl(ORDER_FORM_ID, { price: '45', inks: 'Copic Fineliner 0.4mm' })
		);
		expect(url.origin).toBe(TALLY_ORIGIN);
		expect(url.pathname).toBe(`/embed/${ORDER_FORM_ID}`);
		expect(url.searchParams.get('price')).toBe('45');
		expect(url.searchParams.get('inks')).toBe('Copic Fineliner 0.4mm');
		expect(url.searchParams.get('alignLeft')).toBe('1');
		// '/popup/' URLs sit on adblock filter lists — the bug that killed the widget
		expect(url.pathname).not.toContain('popup');
	});

	it('points each url at the form it is asked for', () => {
		expect(formUrl(INQUIRY_FORM_ID, { from: 'landing' })).toBe(
			`https://tally.so/r/${INQUIRY_FORM_ID}?from=landing`
		);
		expect(new URL(formEmbedUrl(INQUIRY_FORM_ID, {})).pathname).toBe(`/embed/${INQUIRY_FORM_ID}`);
		expect(INQUIRY_FORM_ID).not.toBe(ORDER_FORM_ID);
	});
});

describe('formSignal', () => {
	const submittedBy = (formId: string) =>
		JSON.stringify({ event: 'Tally.FormSubmitted', payload: { formId } });
	const submitted = submittedBy(ORDER_FORM_ID);

	it('ignores messages from other origins', () => {
		expect(formSignal(ORDER_FORM_ID, 'https://evil.example', submitted)).toBeNull();
		expect(formSignal(ORDER_FORM_ID, 'https://tally.so.evil.example', submitted)).toBeNull();
	});

	it('treats any tally.so message as proof the embed is alive', () => {
		const loaded = JSON.stringify({
			event: 'Tally.FormLoaded',
			payload: { formId: ORDER_FORM_ID }
		});
		expect(formSignal(ORDER_FORM_ID, TALLY_ORIGIN, loaded)).toBe('alive');
		// iframe-resizer heartbeats are plain strings, not JSON
		expect(formSignal(ORDER_FORM_ID, TALLY_ORIGIN, '[iFrameSizer]iFrameResizer0:0:0:init')).toBe(
			'alive'
		);
		expect(formSignal(ORDER_FORM_ID, TALLY_ORIGIN, { event: 'not-a-string-payload' })).toBe(
			'alive'
		);
	});

	it('reports a submission of the open form', () => {
		expect(formSignal(ORDER_FORM_ID, TALLY_ORIGIN, submitted)).toBe('submitted');
		expect(formSignal(INQUIRY_FORM_ID, TALLY_ORIGIN, submittedBy(INQUIRY_FORM_ID))).toBe(
			'submitted'
		);
	});

	it("keeps another form's submission as merely alive", () => {
		expect(formSignal(ORDER_FORM_ID, TALLY_ORIGIN, submittedBy('xyz123'))).toBe('alive');
		// the two funnel forms never close each other's modal
		expect(formSignal(INQUIRY_FORM_ID, TALLY_ORIGIN, submitted)).toBe('alive');
	});
});

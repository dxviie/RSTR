import { describe, it, expect } from 'vitest';
import { INQUIRY_FORM_ID, ORDER_FORM_ID } from '../rstr2/orderForm';
import { SHARE_FORM_ID, SHARE_PAYLOAD_VERSION, shareFormFields } from './share';

describe('share form', () => {
	it('is a form of its own, apart from the plot funnel', () => {
		expect([ORDER_FORM_ID, INQUIRY_FORM_ID]).not.toContain(SHARE_FORM_ID);
	});

	it('only says where it was opened from', () => {
		expect(shareFormFields()).toEqual({ from: 'landing', v: SHARE_PAYLOAD_VERSION });
	});
});

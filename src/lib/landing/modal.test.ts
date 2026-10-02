import { describe, it, expect, vi } from 'vitest';
import { opensDialog } from './modal';

type Modifiers = Partial<
	Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>
>;

/** A stand-in click carrying only what opensDialog reads. */
const click = (modifiers: Modifiers = {}) => {
	const preventDefault = vi.fn();
	const event = {
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		preventDefault,
		...modifiers
	} as unknown as MouseEvent;
	return { event, preventDefault };
};

describe('opensDialog', () => {
	it('opens the dialog instead of following the link on a plain click', () => {
		const open = vi.fn();
		const { event, preventDefault } = click();
		opensDialog(open)(event);
		expect(open).toHaveBeenCalledOnce();
		expect(preventDefault).toHaveBeenCalledOnce();
	});

	it('lets modified clicks follow the link to a new tab or window', () => {
		const modified: Modifiers[] = [
			{ metaKey: true },
			{ ctrlKey: true },
			{ shiftKey: true },
			{ altKey: true },
			{ button: 1 }
		];
		for (const modifiers of modified) {
			const open = vi.fn();
			const { event, preventDefault } = click(modifiers);
			opensDialog(open)(event);
			expect(open).not.toHaveBeenCalled();
			expect(preventDefault).not.toHaveBeenCalled();
		}
	});
});

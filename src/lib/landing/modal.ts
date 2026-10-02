// Page manners for the landing's modals (the lightbox, the inquiry dialog):
// lock the page behind the overlay, move focus into it, and hand focus back
// to whatever opened it once it closes. Hiding the scrollbar would widen the
// page and shift it sideways, so the body is padded by the scrollbar's width
// for as long as it's gone.

/** Lock the page and focus `target`. Returns the matching unlock. */
export const lockPage = (target?: HTMLElement): (() => void) => {
	const opener = document.activeElement as HTMLElement | null;
	const { overflow, paddingRight } = document.body.style;
	const scrollbar = window.innerWidth - document.documentElement.clientWidth;
	document.body.style.overflow = 'hidden';
	if (scrollbar > 0) {
		const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
		document.body.style.paddingRight = `${padding + scrollbar}px`;
	}
	target?.focus();
	return () => {
		document.body.style.overflow = overflow;
		document.body.style.paddingRight = paddingRight;
		opener?.focus?.({ preventScroll: true });
	};
};

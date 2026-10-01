// #madewithrstr: the hashtag and where people can tag or send their work.

export const HASHTAG = '#madewithrstr';

export interface ShareLink {
	id: 'instagram' | 'bluesky' | 'mastodon';
	label: string;
	handle: string;
	href: string;
	/** the platform's page for the hashtag */
	tagHref: string;
}

export const SHARE_LINKS: ShareLink[] = [
	{
		id: 'instagram',
		label: 'Instagram',
		handle: '@d17e.dev',
		href: 'https://www.instagram.com/d17e.dev/',
		tagHref: 'https://www.instagram.com/explore/tags/madewithrstr/'
	},
	{
		id: 'bluesky',
		label: 'Bluesky',
		handle: '@d17e.bsky.social',
		href: 'https://bsky.app/profile/d17e.bsky.social',
		tagHref: 'https://bsky.app/hashtag/madewithrstr'
	},
	{
		id: 'mastodon',
		label: 'Mastodon',
		handle: '@d17e@mastodon.social',
		href: 'https://mastodon.social/@d17e',
		tagHref: 'https://mastodon.social/tags/madewithrstr'
	}
];

/** for people who'd rather not post publicly */
export const CONTACT_FORM = 'https://forms.d17e.dev/contact';

/**
 * Copy text to the clipboard. Falls back to a hidden textarea where the
 * async clipboard API is missing or blocked (older Safari, http previews).
 */
export const copyText = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		let ok: boolean;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		area.remove();
		return ok;
	}
};

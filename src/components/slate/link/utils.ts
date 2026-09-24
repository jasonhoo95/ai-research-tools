export function normalizeLinkUrl(url: string) {
	const trimmed = url.trim();
	if (!trimmed) return "";
	if (/^(https?:\/\/|mailto:|tel:|#)/i.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

export function getLinkLabel(url: string) {
	try {
		const base =
			typeof window !== "undefined"
				? window.location.origin
				: "https://example.com";
		const parsed = new URL(url, base);
		return (
			parsed.hostname.replace(/^www\./, "") || url
		);
	} catch {
		return url;
	}
}

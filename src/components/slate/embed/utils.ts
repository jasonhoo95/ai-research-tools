import {
	isListablePlaylist,
	parseYoutubeUrl,
} from "@/components/slate/lib/youtube";

export function extractIframeSrc(input: string) {
	const trimmed = input.trim();
	const match = trimmed.match(
		/src=["']([^"']+)["']/i,
	);
	return match?.[1] ?? null;
}

export function normalizeEmbedUrl(input: string): string | null {
	const iframeSrc = extractIframeSrc(input);
	const candidate = iframeSrc ?? input.trim();
	if (!candidate) return null;

	const normalized = candidate.startsWith("http")
		? candidate
		: `https://${candidate}`;

	const youtube = parseYoutubeUrl(normalized);
	if (youtube?.videoId) {
		return `https://www.youtube.com/embed/${encodeURIComponent(youtube.videoId)}`;
	}

	if (
		youtube?.playlistId &&
		isListablePlaylist(youtube.playlistId)
	) {
		return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(youtube.playlistId)}`;
	}

	try {
		const parsed = new URL(normalized);
		const hostname = parsed.hostname.replace(
			/^www\./,
			"",
		);

		if (hostname === "open.spotify.com") {
			const path = parsed.pathname.startsWith(
				"/embed/",
			)
				? parsed.pathname
				: `/embed${parsed.pathname}`;
			return `https://open.spotify.com${path}${parsed.search}`;
		}

		if (hostname === "player.vimeo.com") {
			return normalized;
		}

		if (
			hostname === "youtube.com" ||
			hostname === "youtube-nocookie.com"
		) {
			if (parsed.pathname.startsWith("/embed/")) {
				return normalized;
			}
		}
	} catch {
		return null;
	}

	return normalized;
}

export function getEmbedLabel(url: string) {
	try {
		const parsed = new URL(url);
		return (
			parsed.hostname.replace(/^www\./, "") ||
			"Embed"
		);
	} catch {
		return "Embed";
	}
}

export type YoutubeParseResult = {
	videoId?: string;
	playlistId?: string;
};

const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"youtube-nocookie.com",
	"m.youtube.com",
	"youtu.be",
]);

function getYoutubeHostname(url: URL) {
	return url.hostname.replace(/^www\./, "");
}

export function parseYoutubeUrl(input: string): YoutubeParseResult | null {
	try {
		const url = new URL(input);
		const hostname = getYoutubeHostname(url);

		if (!YOUTUBE_HOSTS.has(hostname)) {
			return null;
		}

		if (hostname === "youtu.be") {
			const videoId = url.pathname.slice(1).split("/")[0] || undefined;
			const playlistId = url.searchParams.get("list") ?? undefined;
			if (!videoId && !playlistId) return null;
			return { videoId, playlistId };
		}

		const playlistId = url.searchParams.get("list") ?? undefined;
		let videoId = url.searchParams.get("v") ?? undefined;

		if (!videoId && url.pathname.startsWith("/embed/")) {
			videoId = url.pathname.split("/")[2] || undefined;
		}

		if (!videoId && url.pathname.startsWith("/shorts/")) {
			videoId = url.pathname.split("/")[2] || undefined;
		}

		if (!videoId && !playlistId) {
			return null;
		}

		return { videoId, playlistId };
	} catch {
		return null;
	}
}

export function isListablePlaylist(playlistId: string) {
	return /^[A-Za-z0-9_-]{10,}$/.test(playlistId.trim());
}

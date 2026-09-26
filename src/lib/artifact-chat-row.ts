import type { ArtifactChatRow } from "@/lib/chat-repo";
import type {
	Artifact,
	ArtifactKind,
	GeneratedArtifact,
} from "@/lib/chat-types";

const KNOWN_KINDS: ReadonlySet<string> = new Set([
	"chart",
	"table",
	"slide",
	"notesboard",
	"notes",
	"bio",
	"quiz",
	"mindmap",
	"highlight",
]);

function isKnownKind(
	value: unknown,
): value is ArtifactKind {
	return (
		typeof value === "string" &&
		KNOWN_KINDS.has(value)
	);
}

function parseMaybeJson(value: unknown): unknown {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

/** Coerce backend / API payloads into a GeneratedArtifact. */
export function normalizeGeneratedArtifact(
	raw: unknown,
	fallback?: GeneratedArtifact,
): GeneratedArtifact | null {
	const parsed = parseMaybeJson(raw);
	if (!parsed || typeof parsed !== "object") {
		return fallback ?? null;
	}

	const record = parsed as Record<
		string,
		unknown
	>;

	// Full GeneratedArtifact: { id, artifact: { kind, ... } }
	if (
		record.artifact &&
		typeof record.artifact === "object" &&
		isKnownKind(
			(
				record.artifact as {
					kind?: unknown;
				}
			).kind,
		)
	) {
		return record as unknown as GeneratedArtifact;
	}

	// Flat inner artifact stored as content: { kind, title, ... }
	if (isKnownKind(record.kind)) {
		const inner =
			record as unknown as Artifact & {
				id?: string;
				createdAt?: string;
				prompt?: string;
			};
		return {
			id:
				(typeof record.id === "string"
					? record.id
					: undefined) ??
				fallback?.id ??
				crypto.randomUUID(),
			createdAt:
				(typeof record.createdAt ===
				"string"
					? record.createdAt
					: undefined) ??
				fallback?.createdAt ??
				new Date().toISOString(),
			prompt:
				(typeof record.prompt === "string"
					? record.prompt
					: undefined) ??
				fallback?.prompt ??
				"",
			artifact: inner,
		};
	}

	return fallback ?? null;
}

export function normalizeArtifactChatRow(
	row: ArtifactChatRow,
	fallbackContent?: GeneratedArtifact,
): ArtifactChatRow | null {
	const content = normalizeGeneratedArtifact(
		row.content,
		fallbackContent,
	);
	if (!content) return null;

	return {
		...row,
		content,
	};
}

export function artifactHref(
	artifact: { id: string; kind: ArtifactKind },
	chatbotId?: string,
): string {
	// Pinned notesboards are not attached to a message row.

	return chatbotId
		? `/chat/${chatbotId}/artifacts/${artifact.id}`
		: `/artifacts/${artifact.id}`;
}

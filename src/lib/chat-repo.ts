"use client";

import { ApiError, appApi } from "@/lib/api";
import { normalizeArtifactChatRow } from "@/lib/artifact-chat-row";
import type {
	Artifact,
	CitationSource,
	GeneratedArtifact,
	MessageAttachment,
	SearchProvider,
} from "@/lib/chat-types";

export interface MessageArtifactResult {
	artifactId: string;
	chatbotId: string;
	messageId: string;
	messageCreatedAt: string;
	/** Inner artifact ({ kind, title, ... }) — ready to render. */
	artifact: Artifact;
	/** Raw content.artifact as stored on the chatbot_message row. */
	storedArtifact: Record<string, unknown>;
}

export interface ChatRow {
	id: string;
	title: string;
	description: string | null;
	created_at: string;
	updated_at: string;
}

export interface MessageContent {
	role: "user" | "assistant";
	text: string;
	/** Older messages: a single file. */
	attachment?: { name: string; kind: string };
	attachments?: MessageAttachment[];
	artifact?: {
		id: string;
		kind: GeneratedArtifact["artifact"]["kind"];
		title: string;
	};
	sources?: CitationSource[];
	searchProvider?: SearchProvider;
}

export interface MessageRow {
	id: string;
	parent_chatbot_id: string;
	content: MessageContent;
	/** Pinned by the user; null on rows from before the column existed. */
	pin_message?: boolean | null;
	created_at: string;
	updated_at: string;
}

/** One page of messages, oldest → newest. Cursors are opaque. */
export interface MessagePage {
	items: MessageRow[];
	hasMoreBefore: boolean;
	hasMoreAfter: boolean;
	beforeCursor: string | null;
	afterCursor: string | null;
}

export interface MessageSearchHit {
	id: string;
	role: "user" | "assistant";
	snippet: string;
	created_at: string;
}

/** Search hits, newest first. */
export interface MessageSearchPage {
	items: MessageSearchHit[];
	hasMore: boolean;
	nextCursor: string | null;
}

/**
 * A per-chatbot pinned artifact row. `content` carries the full
 * GeneratedArtifact JSON that was saved from a message bubble.
 */
export interface ArtifactChatRow {
	id: string;
	parent_chatbot_id: string;
	content: GeneratedArtifact;
	created_at: string;
	updated_at: string;
}

export const chatRepo = {
	async listChats(): Promise<ChatRow[]> {
		const { data } =
			await appApi.get<ChatRow[]>("/chats");
		return data;
	},

	async getChat(
		id: string,
	): Promise<ChatRow | null> {
		try {
			const { data } =
				await appApi.get<ChatRow>(
					`/chats/${id}`,
				);
			return data;
		} catch (error) {
			if (
				error instanceof ApiError &&
				error.status === 404
			) {
				return null;
			}
			throw error;
		}
	},

	async createChat(input: {
		title: string;
		description?: string;
	}): Promise<ChatRow> {
		const { data } =
			await appApi.post<ChatRow>(
				"/chats",
				input,
			);
		return data;
	},

	async deleteChat(id: string): Promise<void> {
		await appApi.delete(`/chats/${id}`);
	},

	/**
	 * Paginated messages. No cursor → newest page; `before` → older;
	 * `after` → newer; `around` → page centred on a message id.
	 */
	async listMessages(
		chatId: string,
		params: {
			limit?: number;
			before?: string;
			after?: string;
			around?: string;
		} = {},
	): Promise<MessagePage> {
		const { data } = await appApi.get<MessagePage>(
			`/chats/${chatId}/messages`,
			{ params },
		);
		return data;
	},

	async searchMessages(
		chatId: string,
		params: { q: string; limit?: number; cursor?: string },
	): Promise<MessageSearchPage> {
		const { data } = await appApi.get<MessageSearchPage>(
			`/chats/${chatId}/messages/search`,
			{ params },
		);
		return data;
	},

	/** Pinned messages in this chat, newest first. */
	async listPinnedMessages(chatId: string): Promise<MessageRow[]> {
		const { data } = await appApi.get<MessageRow[]>(
			`/chats/${chatId}/messages/pinned`,
		);
		return data;
	},

	/** Pin or unpin a message; returns the updated row. */
	async pinMessage(
		chatId: string,
		messageId: string,
		pinned: boolean,
	): Promise<MessageRow> {
		const { data } = await appApi.patch<MessageRow>(
			`/chats/${chatId}/messages/${messageId}/pin`,
			{ pinned },
		);
		return data;
	},

	async appendMessage(
		chatId: string,
		content: MessageContent,
	): Promise<MessageRow> {
		const { data } =
			await appApi.post<MessageRow>(
				`/chats/${chatId}/messages`,
				{ content },
			);
		return data;
	},

	async updateMessageArtifact(
		chatId: string,
		artifactId: string,
		artifact: Artifact,
	): Promise<MessageArtifactResult> {
		const { data } =
			await appApi.patch<MessageArtifactResult>(
				`/chats/${chatId}/messages/artifacts/${artifactId}`,
				artifact,
			);
		return data;
	},

	async getMessageArtifact(
		chatId: string,
		artifactId: string,
	): Promise<MessageArtifactResult | null> {
		try {
			const { data } =
				await appApi.get<MessageArtifactResult>(
					`/chats/${chatId}/messages/artifacts/${artifactId}`,
				);
			return data;
		} catch (err) {
			if (
				err instanceof ApiError &&
				err.status === 404
			)
				return null;
			throw err;
		}
	},

	async listArtifacts(
		chatId: string,
	): Promise<ArtifactChatRow[]> {
		const { data } = await appApi.get<
			ArtifactChatRow[]
		>(`/chats/${chatId}/artifacts`);
		return data;
	},

	async saveArtifact(
		chatId: string,
		content: GeneratedArtifact,
	): Promise<ArtifactChatRow> {
		const { data } =
			await appApi.post<ArtifactChatRow>(
				`/chats/${chatId}/artifacts`,
				{ content },
			);
		const normalized =
			normalizeArtifactChatRow(
				data,
				content,
			);
		if (!normalized) {
			return {
				id:
					data.id ??
					crypto.randomUUID(),
				parent_chatbot_id:
					data.parent_chatbot_id ??
					chatId,
				content,
				created_at:
					data.created_at ??
					new Date().toISOString(),
				updated_at:
					data.updated_at ??
					data.created_at ??
					new Date().toISOString(),
			};
		}
		return normalized;
	},

	async deleteArtifact(
		chatId: string,
		artifactId: string,
	): Promise<void> {
		await appApi.delete(
			`/chats/${chatId}/artifacts/${artifactId}`,
		);
	},
};

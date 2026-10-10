"use client";

import { create } from "zustand";
import {
	createJSONStorage,
	persist,
	type StateStorage,
} from "zustand/middleware";

import type {
	ArtifactChatRow,
	ChatRow,
} from "@/lib/chat-repo";
import type { ChatBubbleMessage } from "@/components/chat/message-bubble";
import type { PinnedMessageItem } from "@/components/chat/artifacts-panel";

/** What a chat thread shows when it opens: its latest messages and side panel. */
export type ThreadSnapshot = {
	chat: ChatRow;
	/** The latest messages, oldest first (as loaded and added since). */
	messages: ChatBubbleMessage[];
	hasMoreBefore: boolean;
	beforeCursor: string | null;
	artifacts: ArtifactChatRow[];
	pinned: PinnedMessageItem[];
	/** When it was last loaded from the server. */
	/** When it was last opened or changed, for evicting the oldest. */
	usedAt: number;
};

/** The user's chats, as the chat list last loaded them. */
export type ChatListSnapshot = {
	/** Every kind (chats and docs workspaces), newest first. */
	rows: ChatRow[];
	/** When it was last loaded from the server. */
};

/**
 * Opened again within this time, a thread (or the chat list) is shown
 * without asking the server.
 */
export const THREAD_FRESH_MS = 5 * 60 * 1000;
/** Threads kept; the least recently used go first. */
const MAX_THREADS = 12;

type ChatThreadStore = {
	threads: Record<string, ThreadSnapshot>;
	/** Null until the chat list has been loaded once. */
	chatList: ChatListSnapshot | null;
	save: (
		chatId: string,
		snapshot: Omit<ThreadSnapshot, "usedAt">,
	) => void;
	/** The list as just loaded from the server. */
	saveChatList: (rows: ChatRow[]) => void;
	/** A chat created or changed: added to the top, or updated in place. */
	upsertChat: (row: ChatRow) => void;
	/** A message was sent in a chat: the list shows it updated just now. */
	touchChat: (
		chatId: string,
		updatedAt?: string,
	) => void;
	/** A chat was deleted: forget its thread and drop it from the list. */
	remove: (chatId: string) => void;
	clear: () => void;
};

/** Keeps the `MAX_THREADS` most recently used threads. */
function trim(
	threads: Record<string, ThreadSnapshot>,
	max = MAX_THREADS,
) {
	const entries = Object.entries(threads);
	if (entries.length <= max) return threads;
	entries.sort(
		([, a], [, b]) => b.usedAt - a.usedAt,
	);
	return Object.fromEntries(
		entries.slice(0, max),
	);
}

/**
 * localStorage that never throws: when it's full (long threads with
 * artifacts add up), the oldest threads are dropped until the write fits.
 */
const safeLocalStorage: StateStorage = {
	getItem: (name) => {
		try {
			return localStorage.getItem(name);
		} catch {
			return null;
		}
	},
	setItem: (name, value) => {
		let next = value;
		for (;;) {
			try {
				localStorage.setItem(name, next);
				return;
			} catch {
				const parsed = JSON.parse(
					next,
				) as {
					state: {
						threads: Record<
							string,
							ThreadSnapshot
						>;
					};
				};
				const count = Object.keys(
					parsed.state.threads,
				).length;
				if (count <= 1) {
					// Even one thread doesn't fit: don't persist; it stays in memory.
					try {
						localStorage.removeItem(
							name,
						);
					} catch {}
					return;
				}
				parsed.state.threads = trim(
					parsed.state.threads,
					count - 1,
				);
				next = JSON.stringify(parsed);
			}
		}
	},
	removeItem: (name) => {
		try {
			localStorage.removeItem(name);
		} catch {}
	},
};

/**
 * Chat threads opened before, and the chat list, kept in localStorage so
 * opening them again is instant. ChatThread keeps each snapshot in step with
 * what it shows; creating, deleting and messaging update the list.
 */
export const useChatThreadStore =
	create<ChatThreadStore>()(
		persist(
			(set) => ({
				threads: {},
				chatList: null,
				save: (chatId, snapshot) =>
					set((state) => ({
						threads: trim({
							...state.threads,
							[chatId]: {
								...snapshot,
								usedAt: Date.now(),
							},
						}),
					})),
				saveChatList: (rows) =>
					set({
						chatList: {
							rows,
						},
					}),
				upsertChat: (row) =>
					set((state) => {
						if (!state.chatList)
							return state;
						const { rows } =
							state.chatList;
						const known = rows.some(
							(r) =>
								r.id === row.id,
						);
						return {
							chatList: {
								...state.chatList,
								rows: known
									? rows.map(
											(
												r,
											) =>
												r.id ===
												row.id
													? row
													: r,
										)
									: [
											row,
											...rows,
										],
							},
						};
					}),
				touchChat: (
					chatId,
					updatedAt = new Date().toISOString(),
				) =>
					set((state) => {
						if (!state.chatList)
							return state;
						return {
							chatList: {
								...state.chatList,
								rows: state.chatList.rows.map(
									(r) =>
										r.id ===
										chatId
											? {
													...r,
													updated_at:
														updatedAt,
												}
											: r,
								),
							},
						};
					}),
				remove: (chatId) =>
					set((state) => {
						const threads = {
							...state.threads,
						};
						delete threads[chatId];
						return {
							threads,
							chatList:
								state.chatList && {
									...state.chatList,
									rows: state.chatList.rows.filter(
										(r) =>
											r.id !==
											chatId,
									),
								},
						};
					}),
				clear: () =>
					set({
						threads: {},
						chatList: null,
					}),
			}),
			{
				name: "chat-threads",
				version: 1,
				storage: createJSONStorage(
					() => safeLocalStorage,
				),
				partialize: (state) => ({
					threads: state.threads,
					chatList: state.chatList,
				}),
			},
		),
	);

/** Forget every cached thread and the chat list (signing in or out). */
export function clearChatThreads() {
	useChatThreadStore.getState().clear();
	useChatThreadStore.persist.clearStorage();
}

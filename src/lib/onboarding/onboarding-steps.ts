/**
 * ------------------------------------------------------------------
 * Onboarding steps — the single source of truth.
 *
 * To add / remove / reorder a tooltip:
 *   1. Add an entry to ONBOARDING_STEPS below.
 *   2. Put `data-tour="your-id"` on the target UI element.
 *   3. Done — the provider auto-skips steps whose target isn't on
 *      screen, so steps that only exist on certain routes just work.
 *
 * To force the tour to re-run for everyone, bump ONBOARDING_VERSION.
 * ------------------------------------------------------------------
 */

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_KEY = `ai-research-tools.onboarding.v${ONBOARDING_VERSION}`;

export type OnboardingSide =
	| "top"
	| "right"
	| "bottom"
	| "left";
export type OnboardingAlign =
	| "start"
	| "center"
	| "end";

export interface OnboardingStep {
	/** Stable id — used as the data-tour value on the target element. */
	id: string;
	/** Short heading shown in the tooltip. */
	title: string;
	/** Body text. Plain string, keep it short — 1–2 sentences. */
	description: string;
	/** Where the tooltip sits relative to the target. */
	side?: OnboardingSide;
	/** Alignment of the tooltip along the side. */
	align?: OnboardingAlign;
	/**
	 * Optional CSS selector override. Default: `[data-tour="${id}"]`.
	 * Use this when the target is a shadcn component you don't want to
	 * modify, or you need to point at a nested child.
	 */
	selector?: string;
	/**
	 * When true, this step is shown even if the target isn't in the DOM
	 * (renders centered as a modal-style tooltip). Good for intros.
	 */
	showEvenIfTargetMissing?: boolean;
}

/** The ordered list of steps. */
export const ONBOARDING_STEPS: OnboardingStep[] =
	[
		{
			id: "new-chat",
			title: "Start a new chat",
			description:
				"Click here any time to spin up a fresh conversation. You can give it a title and a short description so it's easy to find later.",
			side: "bottom",
			align: "end",
		},
		{
			id: "create-artifact",
			title: "Create an artifact",
			description:
				"Turn the conversation into a chart, table, slide deck or notes board. Pick a type and the assistant will build it from what you've discussed.",
			side: "bottom",
			align: "end",
		},
		// {
		//   id: "pin-message",
		//   title: "Pin important replies",
		//   description:
		//     "Hover any assistant reply and click the pin to save it. Pinned messages stay accessible from the side panel for the whole chat.",
		//   side: "left",
		//   align: "start",
		// },
		{
			id: "search-message",
			title: "Search this chat",
			description:
				"Jump to any earlier message by keyword. Click a hit to scroll it into view.",
			side: "bottom",
			align: "end",
		},
		{
			id: "artifact-prompt",
			title: "Prompt with an artifact",
			description:
				'After selecting an artifact, keep the conversation going here — anything you type will reference it, so you can ask follow-ups like "summarize row 3" or "redesign slide 2".',
			side: "top",
			align: "center",
		},
	];

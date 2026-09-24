import {
	NextRequest,
	NextResponse,
} from "next/server";

import api, {
	headersFromIncoming,
	proxyErrorPayload,
	proxyValidateStatus,
} from "@/lib/api";

export async function GET(
	request: NextRequest,
	ctx: {
		params: Promise<{
			id: string;
			artifactId: string;
		}>;
	},
) {
	const { id, artifactId } = await ctx.params;

	try {
		const upstream = await api.get(
			`/chats/${id}/messages/artifacts/${artifactId}`,
			{
				headers: headersFromIncoming(
					request.headers,
				),
			},
		);

		return NextResponse.json(
			upstream.data ?? null,
			{ status: upstream.status },
		);
	} catch (error) {
		const { payload, status } =
			proxyErrorPayload(
				error,
				"Failed to reach chats service",
			);
		return NextResponse.json(payload, {
			status,
		});
	}
}

export async function PATCH(
	request: NextRequest,
	ctx: {
		params: Promise<{
			id: string;
			artifactId: string;
		}>;
	},
) {
	const { id, artifactId } = await ctx.params;

	try {
		const body = await request.json();
		// Resolves panel row ids and message artifact ids alike.
		const upstream = await api.patch(
			`/chats/${id}/messages/artifacts/${artifactId}`,
			{ content: body },
			{
				headers: headersFromIncoming(
					request.headers,
				),
			},
		);

		return NextResponse.json(
			upstream.data ?? {},
			{ status: upstream.status },
		);
	} catch (error) {
		const { payload, status } =
			proxyErrorPayload(
				error,
				"Failed to reach chats service",
			);
		return NextResponse.json(payload, {
			status,
		});
	}
}

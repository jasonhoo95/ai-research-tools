import {
	NextRequest,
	NextResponse,
} from "next/server";

import api, {
	headersFromIncoming,
	proxyErrorPayload,
	proxyValidateStatus,
} from "@/lib/api";

export async function DELETE(
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
		const upstream = await api.delete(
			`/chats/${id}/artifacts/${artifactId}`,
			{
				headers: headersFromIncoming(
					request.headers,
				),
			},
		);

		if (upstream.status === 204) {
			return new NextResponse(null, {
				status: 204,
			});
		}

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

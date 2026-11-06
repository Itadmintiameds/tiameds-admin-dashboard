import { NextRequest } from "next/server";

// Same-origin proxy to the API gateway. The browser only talks to this Next server,
// so CORS never applies; Origin/Referer are dropped because the gateway rejects
// any Origin that isn't on its allow-list (e.g. localhost on a different port).
export const dynamic = "force-dynamic";

const TARGET = process.env.API_PROXY_TARGET;

const DROP_REQUEST = ["origin", "referer", "host", "connection", "content-length", "accept-encoding"];
const DROP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie"];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (!TARGET) {
    return Response.json({ message: "API_PROXY_TARGET is not set" }, { status: 500 });
  }

  const { path } = await ctx.params;
  const url = `${TARGET}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  DROP_REQUEST.forEach(h => headers.delete(h));

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (err) {
    return Response.json(
      { message: `Upstream unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.includes(key.toLowerCase())) out.set(key, value);
  });
  upstream.headers.getSetCookie().forEach(c => out.append("set-cookie", c.replace(/;\s*Domain=[^;]*/i, "")));

  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

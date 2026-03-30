import { NextResponse } from "next/server";
import {
  createTunnel,
  configureTunnelIngress,
  createDnsCname,
  getTunnelToken,
  findDnsRecord,
  deleteTunnel,
  deleteDnsRecord,
} from "@/lib/cloudflare";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getDomain(): string {
  const d = process.env.DOMAIN;
  if (!d) throw new Error("Missing env var: DOMAIN");
  return d;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { port?: number };
    const { port = 18789 } = body;

    if (typeof port !== "number" || port < 1 || port > 65535) {
      return NextResponse.json(
        { error: "port must be a number between 1 and 65535" },
        { status: 400 }
      );
    }

    const domain = getDomain();
    const tunnelName = `claw-${Date.now()}`;

    const { tunnelId } = await createTunnel(tunnelName);
    const hostname = `${tunnelId}.gw.${domain}`;

    await configureTunnelIngress(tunnelId, hostname, port);
    await createDnsCname(`${tunnelId}.gw`, tunnelId);
    const tunnelToken = await getTunnelToken(tunnelId);

    const gatewayUrl = `wss://${hostname}`;

    return NextResponse.json({ tunnelId, tunnelToken, gatewayUrl });
  } catch (err) {
    console.error("[provision] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { tunnelId?: string };
    const { tunnelId } = body;

    if (!tunnelId || !UUID_RE.test(tunnelId)) {
      return NextResponse.json(
        { error: "tunnelId must be a valid UUID" },
        { status: 400 }
      );
    }

    const domain = getDomain();
    const dnsName = `${tunnelId}.gw.${domain}`;

    const dnsRecord = await findDnsRecord(dnsName);
    if (dnsRecord) {
      await deleteDnsRecord(dnsRecord.recordId);
    }

    try {
      await deleteTunnel(tunnelId);
    } catch (err) {
      if (!dnsRecord) {
        return NextResponse.json(
          { error: "No tunnel or DNS record found for this tunnelId" },
          { status: 404 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[provision] DELETE error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

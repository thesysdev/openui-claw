import Cloudflare from "cloudflare";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function getClient(): Cloudflare {
  return new Cloudflare({ apiToken: env("CF_API_TOKEN") });
}

// ── Tunnel operations ───────────────────────────────────────────────────────

export async function createTunnel(
  name: string,
): Promise<{ tunnelId: string }> {
  const cf = getClient();
  const tunnel = await cf.zeroTrust.tunnels.cloudflared.create({
    account_id: env("CF_ACCOUNT_ID"),
    name,
    tunnel_secret: Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64"),
  });
  return { tunnelId: tunnel.id! };
}

export async function configureTunnelIngress(
  tunnelId: string,
  hostname: string,
  localPort: number,
): Promise<void> {
  const cf = getClient();
  await cf.zeroTrust.tunnels.cloudflared.configurations.update(tunnelId, {
    account_id: env("CF_ACCOUNT_ID"),
    config: {
      ingress: [
        { hostname, service: `http://localhost:${localPort}` },
        { hostname: "", service: "http_status:404" },
      ],
    },
  });
}

export async function getTunnelToken(tunnelId: string): Promise<string> {
  const cf = getClient();
  const result = await cf.zeroTrust.tunnels.cloudflared.token.get(tunnelId, {
    account_id: env("CF_ACCOUNT_ID"),
  });
  return result as unknown as string;
}

export async function findTunnelByName(
  name: string,
): Promise<{ tunnelId: string } | null> {
  const cf = getClient();
  const tunnels = await cf.zeroTrust.tunnels.cloudflared.list({
    account_id: env("CF_ACCOUNT_ID"),
    name,
    is_deleted: false,
  });
  for await (const tunnel of tunnels) {
    if (tunnel.name === name) return { tunnelId: tunnel.id! };
  }
  return null;
}

export async function deleteTunnel(tunnelId: string): Promise<void> {
  const cf = getClient();
  await cf.zeroTrust.tunnels.cloudflared.delete(tunnelId, {
    account_id: env("CF_ACCOUNT_ID"),
  });
}

// ── DNS operations ──────────────────────────────────────────────────────────

export async function createDnsCname(
  subdomain: string,
  tunnelId: string,
): Promise<{ dnsRecordId: string }> {
  const cf = getClient();
  const record = await cf.dns.records.create({
    zone_id: env("CF_ZONE_ID"),
    type: "CNAME",
    name: subdomain,
    content: `${tunnelId}.cfargotunnel.com`,
    proxied: true,
    ttl: 1,
  });
  return { dnsRecordId: record.id };
}

export async function findDnsRecord(
  fqdn: string,
): Promise<{ recordId: string } | null> {
  const cf = getClient();
  const records = await cf.dns.records.list({
    zone_id: env("CF_ZONE_ID"),
    name: { exact: fqdn },
    type: "CNAME",
  });
  for await (const record of records) {
    return { recordId: record.id };
  }
  return null;
}

export async function deleteDnsRecord(recordId: string): Promise<void> {
  const cf = getClient();
  await cf.dns.records.delete(recordId, {
    zone_id: env("CF_ZONE_ID"),
  });
}

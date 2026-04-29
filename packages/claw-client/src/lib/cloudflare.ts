const CF_API = "https://api.cloudflare.com/client/v4";

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${env("CF_TUNNELS_API_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

async function cfFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, { ...init, headers: headers() });
  const body = (await res.json()) as {
    success: boolean;
    result: T;
    errors?: { message: string }[];
  };
  if (!body.success) {
    const msg = body.errors?.map((e) => e.message).join("; ") ?? res.statusText;
    throw new Error(`Cloudflare API error (${res.status}): ${msg}`);
  }
  return body.result;
}

// ── Tunnel operations ───────────────────────────────────────────────────────

export async function createTunnel(name: string): Promise<{ tunnelId: string }> {
  const accountId = env("CF_TUNNELS_ACCOUNT_ID");
  const tunnelSecret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const result = await cfFetch<{ id: string }>(`/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    body: JSON.stringify({ name, tunnel_secret: tunnelSecret }),
  });
  return { tunnelId: result.id };
}

export async function configureTunnelIngress(
  tunnelId: string,
  hostname: string,
  localPort: number,
): Promise<void> {
  const accountId = env("CF_TUNNELS_ACCOUNT_ID");
  await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({
      config: {
        ingress: [
          { hostname, service: `http://localhost:${localPort}` },
          { hostname: "", service: "http_status:404" },
        ],
      },
    }),
  });
}

export async function getTunnelToken(tunnelId: string): Promise<string> {
  const accountId = env("CF_TUNNELS_ACCOUNT_ID");
  return cfFetch<string>(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
}

export async function findTunnelByName(name: string): Promise<{ tunnelId: string } | null> {
  const accountId = env("CF_TUNNELS_ACCOUNT_ID");
  const tunnels = await cfFetch<{ id: string; name: string }[]>(
    `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  );
  const match = tunnels.find((t) => t.name === name);
  return match ? { tunnelId: match.id } : null;
}

export async function deleteTunnel(tunnelId: string): Promise<void> {
  const accountId = env("CF_TUNNELS_ACCOUNT_ID");
  await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, {
    method: "DELETE",
  });
}

// ── DNS operations ──────────────────────────────────────────────────────────

export async function createDnsCname(
  subdomain: string,
  tunnelId: string,
): Promise<{ dnsRecordId: string }> {
  const zoneId = env("CF_TUNNELS_ZONE_ID");
  const record = await cfFetch<{ id: string }>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: subdomain,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    }),
  });
  return { dnsRecordId: record.id };
}

export async function findDnsRecord(fqdn: string): Promise<{ recordId: string } | null> {
  const zoneId = env("CF_TUNNELS_ZONE_ID");
  const records = await cfFetch<{ id: string }[]>(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(fqdn)}&type=CNAME`,
  );
  const first = records[0];
  return first ? { recordId: first.id } : null;
}

export async function deleteDnsRecord(recordId: string): Promise<void> {
  const zoneId = env("CF_TUNNELS_ZONE_ID");
  await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: "DELETE",
  });
}

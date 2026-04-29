"use client";

import { saveSettings } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "configuring" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("configuring");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setStatus("error");
      setErrorMsg("No configuration found in the URL.");
      return;
    }

    const params = new URLSearchParams(hash);
    const gateway = params.get("gateway");
    const token = params.get("token");

    if (!gateway) {
      setStatus("error");
      setErrorMsg("Missing gateway URL in the setup link.");
      return;
    }

    saveSettings({ gatewayUrl: gateway, token: token || undefined });
    router.replace("/");
  }, [router]);

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center p-ml">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-text-neutral-primary mb-2">Setup Failed</h1>
          <p className="text-sm text-text-neutral-tertiary mb-4">{errorMsg}</p>
          <a
            href="/"
            className="text-sm font-medium text-text-neutral-primary underline underline-offset-2 hover:text-text-neutral-secondary"
          >
            Go to Claw
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-ml">
      <p className="text-sm text-text-neutral-tertiary">Configuring...</p>
    </div>
  );
}

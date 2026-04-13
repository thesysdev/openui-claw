"use client";

import { useEffect, useState } from "react";

export type Route =
  | { view: "chat"; sessionId: string }
  | { view: "artifacts" }
  | { view: "artifact"; artifactId: string }
  | { view: "app"; appId: string };

function parseHash(hash: string): Route | null {
  const path = hash.replace(/^#/, "");
  if (path.startsWith("/chat/")) {
    const sessionId = decodeURIComponent(path.slice("/chat/".length));
    if (sessionId) return { view: "chat", sessionId };
  }
  if (path === "/artifacts") return { view: "artifacts" };
  if (path.startsWith("/artifacts/")) {
    const artifactId = decodeURIComponent(path.slice("/artifacts/".length));
    if (artifactId) return { view: "artifact", artifactId };
  }
  if (path.startsWith("/apps/")) {
    const appId = decodeURIComponent(path.slice("/apps/".length));
    if (appId) return { view: "app", appId };
  }
  return null;
}

export function chatHash(sessionId: string): string {
  return `#/chat/${encodeURIComponent(sessionId)}`;
}

export function artifactsHash(): string {
  return "#/artifacts";
}

export function artifactHash(artifactId: string): string {
  return `#/artifacts/${encodeURIComponent(artifactId)}`;
}

export function appHash(appId: string): string {
  return `#/apps/${encodeURIComponent(appId)}`;
}

export function navigate(route: Route): void {
  if (route.view === "chat") {
    window.location.hash = `/chat/${encodeURIComponent(route.sessionId)}`;
  } else if (route.view === "artifacts") {
    window.location.hash = "/artifacts";
  } else if (route.view === "app") {
    window.location.hash = `/apps/${encodeURIComponent(route.appId)}`;
  } else {
    window.location.hash = `/artifacts/${encodeURIComponent(route.artifactId)}`;
  }
}

export function useHashRoute(): Route | null {
  const [route, setRoute] = useState<Route | null>(() =>
    typeof window !== "undefined" ? parseHash(window.location.hash) : null
  );

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return route;
}

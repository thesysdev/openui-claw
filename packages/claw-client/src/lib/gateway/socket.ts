import type { EventFrame, GatewayError, GatewayFrame, HelloOk } from "./types";
import type { Settings } from "../storage";
import type { DeviceIdentity } from "./device-identity";
import { buildConnectParams } from "./handshake";

// WebSocket close codes that indicate non-retryable auth failures
const AUTH_CLOSE_CODES = new Set([4001, 4003, 4401]);

// recommendedNextStep values that mean "your credentials are wrong, stop retrying"
const AUTH_FATAL_STEPS = new Set([
  "update_auth_configuration",
  "update_auth_credentials",
  "review_auth_configuration",
]);

// Connect challenge timeout before we proceed without a nonce
const CHALLENGE_TIMEOUT_MS = 2000;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

const log = (...args: unknown[]) => console.log("[claw:socket]", ...args);
const warn = (...args: unknown[]) => console.warn("[claw:socket]", ...args);
const err = (...args: unknown[]) => console.error("[claw:socket]", ...args);

export interface GatewaySocketOptions {
  getSettings: () => Settings | null;
  getDevice: () => Promise<DeviceIdentity>;
  onHelloOk: (hello: HelloOk) => void;
  onAuthFailed: () => void;
  onEvent: (frame: EventFrame) => void;
  onStateChange: (connecting: boolean) => void;
}

export class GatewaySocket {
  private ws: WebSocket | null = null;
  private stopped = false;
  private reconnectDelay = RECONNECT_BASE_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRpcs = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }
  >();
  private challengeResolve: ((nonce: string) => void) | null = null;
  private rpcCounter = 0;

  constructor(private opts: GatewaySocketOptions) {}

  start(): void {
    log("start()");
    this.stopped = false;
    this.scheduleConnect(0);
  }

  stop(): void {
    log("stop()");
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeWs();
  }

  async request<T>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }
    const id = `rpc-${++this.rpcCounter}`;
    const frame: GatewayFrame = { type: "req", id, method, params };
    log(`→ req  ${method} (${id})`);
    return new Promise<T>((resolve, reject) => {
      this.pendingRpcs.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        method,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  private scheduleConnect(delayMs: number): void {
    if (this.stopped) return;
    if (delayMs > 0) {
      log(`reconnect in ${delayMs}ms`);
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  private connect(): void {
    if (this.stopped) return;
    const settings = this.opts.getSettings();
    if (!settings?.gatewayUrl) {
      warn("no gatewayUrl configured — skipping connect");
      return;
    }

    log(`connecting to ${settings.gatewayUrl}`);
    this.opts.onStateChange(true);

    try {
      this.ws = new WebSocket(settings.gatewayUrl);
    } catch (e) {
      err("WebSocket constructor threw:", e);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (e) => this.handleMessage(e.data as string);
    this.ws.onclose = (e) => this.handleClose(e.code, e.reason);
    this.ws.onerror = (e) => {
      warn("onerror (close will follow):", e);
    };
  }

  private async handleOpen(): Promise<void> {
    log("ws open — waiting for connect.challenge");
    const nonce = await this.waitForChallenge();
    log(`challenge nonce: ${nonce.slice(0, 12)}…`);

    const settings = this.opts.getSettings();
    if (!settings || this.stopped) return;

    let device: DeviceIdentity;
    try {
      device = await this.opts.getDevice();
      log(`device id: ${device.deviceId.slice(0, 12)}…`);
    } catch (e) {
      err("failed to get device identity:", e);
      this.closeWs();
      this.scheduleReconnect();
      return;
    }

    const authMethod = settings.deviceToken
      ? "deviceToken"
      : settings.token
      ? "token"
      : "none";
    log(`sending connect (auth=${authMethod})`);

    let hello: HelloOk;
    try {
      const params = await buildConnectParams(nonce, settings, device);
      hello = await this.request<HelloOk>("connect", params);
    } catch (e) {
      warn(`connect RPC failed — raw error:`, e);
      const error = this.parseError(e instanceof Error ? e.cause ?? e.message : e);
      if (this.isAuthFatal(error)) {
        warn("auth fatal — invoking onAuthFailed");
        this.handleAuthError(settings);
        return;
      }
      this.closeWs();
      this.scheduleReconnect();
      return;
    }

    this.reconnectDelay = RECONNECT_BASE_MS;
    const gotDeviceToken = !!(hello as { auth?: { deviceToken?: string } }).auth?.deviceToken;
    log(`hello-ok  protocol=${hello.protocol}  newDeviceToken=${gotDeviceToken}`);
    this.opts.onHelloOk(hello);
  }

  private waitForChallenge(): Promise<string> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        warn("connect.challenge timeout — using random nonce");
        this.challengeResolve = null;
        resolve(crypto.randomUUID());
      }, CHALLENGE_TIMEOUT_MS);

      this.challengeResolve = (nonce) => {
        clearTimeout(timer);
        resolve(nonce);
      };
    });
  }

  private handleMessage(raw: string): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw) as GatewayFrame;
    } catch {
      warn("failed to parse frame:", raw.slice(0, 100));
      return;
    }

    if (frame.type === "event") {
      if (frame.event === "connect.challenge" && this.challengeResolve) {
        const payload = frame.payload as { nonce: string } | undefined;
        log("← event connect.challenge");
        this.challengeResolve(payload?.nonce ?? "");
        this.challengeResolve = null;
        return;
      }
      // Only log non-streaming events to avoid log spam during agent runs
      if (frame.event !== "agent" && frame.event !== "chat") {
        log(`← event ${frame.event}`);
      }
      this.opts.onEvent(frame);
      return;
    }

    if (frame.type === "res") {
      const pending = this.pendingRpcs.get(frame.id);
      if (!pending) return;
      this.pendingRpcs.delete(frame.id);
      if (frame.ok) {
        log(`← res   ${pending.method} (${frame.id}) ok`);
        pending.resolve(frame.payload);
      } else {
        const error = this.parseError(frame.error);
        warn(`← res   ${pending.method} (${frame.id}) error:`, error);
        const rejection = new Error(error.message ?? "RPC error");
        rejection.cause = error;
        pending.reject(rejection);
      }
    }
  }

  private handleClose(code: number, reason: string): void {
    const label = AUTH_CLOSE_CODES.has(code) ? " [AUTH]" : "";
    warn(`ws closed  code=${code}${label}  reason="${reason}"`);
    this.rejectAllPending(new Error(`WebSocket closed: ${code} ${reason}`));
    this.challengeResolve = null;

    if (this.stopped) return;

    if (AUTH_CLOSE_CODES.has(code)) {
      const settings = this.opts.getSettings();
      if (settings) this.handleAuthError(settings);
      return;
    }

    this.scheduleReconnect();
  }

  private handleAuthError(settings: Settings): void {
    if (settings.deviceToken && settings.token) {
      warn("deviceToken rejected — will retry with raw token");
    } else {
      warn("auth failed — no fallback token available");
    }
    this.opts.onAuthFailed();
  }

  private parseError(raw: unknown): GatewayError {
    if (typeof raw === "string") return { message: raw };
    if (typeof raw === "object" && raw !== null) return raw as GatewayError;
    return { message: String(raw) };
  }

  /** Returns true if the error means "stop retrying, credentials are wrong". */
  private isAuthFatal(error: GatewayError): boolean {
    const step = error.details?.recommendedNextStep;
    if (step) return AUTH_FATAL_STEPS.has(step);
    // Fallback: DEVICE_AUTH_* and AUTH_* detail codes are non-retryable
    const code = error.details?.code ?? "";
    return code.startsWith("AUTH_") || code.startsWith("DEVICE_AUTH_");
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.opts.onStateChange(true);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    warn(`scheduling reconnect in ${this.reconnectDelay}ms`);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
  }

  private closeWs(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingRpcs.values()) {
      warn(`rejecting pending RPC ${pending.method}: ${err.message}`);
    }
    for (const pending of this.pendingRpcs.values()) {
      pending.reject(err);
    }
    this.pendingRpcs.clear();
  }
}

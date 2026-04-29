"use client";

import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ConnectionState } from "@/lib/gateway/types";
import {
  Bell,
  Clock3,
  Cpu,
  FileText,
  Home,
  LayoutGrid,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";

const STATUS_LABEL: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Disconnected",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Connected",
  [ConnectionState.AUTH_FAILED]: "Auth failed",
  [ConnectionState.PAIRING]: "Pairing…",
  [ConnectionState.UNREACHABLE]: "Unreachable",
};

const STATUS_DOT: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "bg-status-muted",
  [ConnectionState.CONNECTING]: "bg-status-warning animate-pulse",
  [ConnectionState.CONNECTED]: "bg-status-online",
  [ConnectionState.AUTH_FAILED]: "bg-status-error",
  [ConnectionState.PAIRING]: "bg-status-warning animate-pulse",
  [ConnectionState.UNREACHABLE]: "bg-status-error",
};

import { HeaderIconButton } from "@/components/layout/HeaderIconButton";
import { CategoryTile, IconTile } from "@/components/layout/sidebar/Tile";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { navigate, type Route } from "@/lib/hooks/useHashRoute";

type TabKey = "home" | "agents" | "apps" | "artifacts";
type TileCategory = "agents" | "apps" | "artifacts";

interface TabDef {
  key: TabKey;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** When set, render a tinted CategoryTile; otherwise a neutral IconTile. */
  category?: TileCategory;
  /** Tailwind background class for the active accent line. */
  accent: string;
  /** Radial-gradient class painted under the active accent line as a spotlight. */
  spotlight: string;
}

const TABS: TabDef[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
    accent: "bg-text-neutral-primary",
    spotlight: "bg-[radial-gradient(ellipse_at_top,rgba(120,120,120,0.18),transparent_60%)]",
  },
  {
    key: "agents",
    label: "Agents",
    icon: Cpu,
    category: "agents",
    accent: "bg-cat-agent",
    spotlight: "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.2),transparent_60%)]",
  },
  {
    key: "apps",
    label: "Apps",
    icon: LayoutGrid,
    category: "apps",
    accent: "bg-cat-app",
    spotlight: "bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.2),transparent_60%)]",
  },
  {
    key: "artifacts",
    label: "Artifacts",
    icon: FileText,
    category: "artifacts",
    accent: "bg-cat-artifact",
    spotlight: "bg-[radial-gradient(ellipse_at_top,rgba(236,72,153,0.22),transparent_60%)]",
  },
];

function viewToTabKey(view: Route["view"]): TabKey | null {
  if (view === "home") return "home";
  if (view === "agents" || view === "chat") return "agents";
  if (view === "apps" || view === "app") return "apps";
  if (view === "artifacts" || view === "artifact") return "artifacts";
  // Crons isn't a top-level tab — show no active tab; the hamburger highlights it.
  return null;
}

export interface MobileShellProps {
  route: Route;
  unreadNotificationCount: number;
  connectionState: ConnectionState;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  themeMode: "light" | "dark";
  onToggleThemeMode: () => void;
  /** Page-specific top-bar content (e.g. chat header). When set, overrides the default title. */
  topBarOverride?: ReactNode;
  /** When true, the entire shell chrome (top header + bottom nav) is suppressed. */
  chromeless?: boolean;
  children: ReactNode;
}

export function MobileShell({
  route,
  unreadNotificationCount,
  connectionState,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettings,
  themeMode,
  onToggleThemeMode,
  topBarOverride,
  chromeless = false,
  children,
}: MobileShellProps) {
  const activeTab = viewToTabKey(route.view);
  // Chat renders its own AgentTopBar; chromeless routes (App/Artifact detail) take over fully.
  const hideDefaultTopBar = chromeless || route.view === "chat";
  const [navSheetOpen, setNavSheetOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {topBarOverride ??
        (hideDefaultTopBar ? null : (
          <header
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-xs px-ml pb-3xl [&_button]:pointer-events-auto"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <HeaderIconButton onClick={() => setNavSheetOpen(true)} label="Open navigation">
              <Menu size={18} />
            </HeaderIconButton>
            <div className="flex shrink-0 items-center gap-s">
              <HeaderIconButton onClick={onOpenSearch} label="Search">
                <Search size={18} />
              </HeaderIconButton>
              <HeaderIconButton
                onClick={onOpenNotifications}
                label="Notifications"
                badge={unreadNotificationCount > 0}
              >
                <Bell size={18} />
              </HeaderIconButton>
            </div>
          </header>
        ))}

      <main
        className={`min-h-0 flex-1 overflow-y-auto ${
          topBarOverride || hideDefaultTopBar ? "" : "pt-[calc(64px+env(safe-area-inset-top))]"
        }`}
      >
        {children}
      </main>

      {chromeless ? null : (
        <nav
          className="flex shrink-0 items-stretch border-t border-border-default/50 bg-background shadow-[0_-1px_4px_rgba(0,0,0,0.04)] dark:border-border-default/16 dark:shadow-[0_-1px_4px_rgba(0,0,0,0.4)]"
          aria-label="Primary"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            minHeight: "calc(56px + env(safe-area-inset-bottom))",
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const showUnread = tab.key === "home" && unreadNotificationCount > 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate({ view: tab.key } as Route)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-2xs transition-colors ${
                  isActive
                    ? "text-text-neutral-primary"
                    : "text-text-neutral-tertiary hover:text-text-neutral-primary"
                }`}
              >
                {isActive ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute left-1/2 top-0 z-0 h-12 w-24 -translate-x-1/2 ${tab.spotlight}`}
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 top-0 z-10 h-[2px] w-10 -translate-x-1/2 rounded-b-full ${tab.accent}`}
                    />
                  </>
                ) : null}
                <span className="relative z-10 inline-flex items-center justify-center">
                  {tab.category ? (
                    <CategoryTile icon={tab.icon} category={tab.category} />
                  ) : (
                    <IconTile icon={tab.icon} />
                  )}
                  {showUnread ? (
                    <span
                      aria-label={`${unreadNotificationCount} unread`}
                      className="absolute -right-1 -top-1 inline-flex h-2 w-2 rounded-full bg-text-info-primary ring-2 ring-background"
                    />
                  ) : null}
                </span>
                <span className="font-label text-sm">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <MobileNavSheet
        open={navSheetOpen}
        onClose={() => setNavSheetOpen(false)}
        currentView={route.view}
        unreadNotificationCount={unreadNotificationCount}
        connectionState={connectionState}
        onOpenSearch={onOpenSearch}
        onOpenNotifications={onOpenNotifications}
        onOpenSettings={onOpenSettings}
        themeMode={themeMode}
        onToggleThemeMode={onToggleThemeMode}
      />
    </div>
  );
}

interface NavSheetItem {
  key: TabKey | "crons";
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  category?: TileCategory | "crons";
  hash: string;
}

/** Group 1 — entry points (Home, Search). Search is action-only, no hash. */
const PRIMARY_NAV: NavSheetItem[] = [{ key: "home", label: "Home", icon: Home, hash: "#/home" }];

/** Group 2 — content categories. */
const CATEGORY_NAV: NavSheetItem[] = [
  { key: "agents", label: "Agents", icon: Cpu, category: "agents", hash: "#/agents" },
  { key: "apps", label: "Apps", icon: LayoutGrid, category: "apps", hash: "#/apps" },
  {
    key: "artifacts",
    label: "Artifacts",
    icon: FileText,
    category: "artifacts",
    hash: "#/artifacts",
  },
  { key: "crons", label: "Cron Jobs", icon: Clock3, category: "crons", hash: "#/crons" },
];

function MobileNavSheet({
  open,
  onClose,
  currentView,
  unreadNotificationCount,
  connectionState,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettings,
  themeMode,
  onToggleThemeMode,
}: {
  open: boolean;
  onClose: () => void;
  currentView: Route["view"];
  unreadNotificationCount: number;
  connectionState: ConnectionState;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  themeMode: "light" | "dark";
  onToggleThemeMode: () => void;
}) {
  useBodyScrollLock(open);
  if (!open) return null;

  const isItemActive = (key: NavSheetItem["key"]) =>
    key === currentView ||
    (key === "home" && currentView === "home") ||
    (key === "agents" && currentView === "chat") ||
    (key === "apps" && currentView === "app") ||
    (key === "artifacts" && currentView === "artifact") ||
    (key === "crons" && currentView === "crons");

  const renderNavItem = (item: NavSheetItem) => {
    const isActive = isItemActive(item.key);
    return (
      <li key={item.key}>
        <button
          type="button"
          onClick={() => {
            window.location.hash = item.hash.slice(1);
            onClose();
          }}
          className={`flex h-11 w-full items-center gap-m bg-transparent px-ml text-left font-body text-sm transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light sm:hover:bg-sunk-light dark:sm:hover:bg-elevated-light ${
            isActive ? "font-semibold text-text-neutral-primary" : "text-text-neutral-secondary"
          }`}
        >
          {item.category && item.category !== "crons" ? (
            <CategoryTile icon={item.icon} category={item.category} />
          ) : item.category === "crons" ? (
            <CategoryTile icon={item.icon} category="crons" />
          ) : (
            <IconTile icon={item.icon} />
          )}
          <span className="flex-1">{item.label}</span>
        </button>
      </li>
    );
  };

  const cardClass =
    "overflow-hidden rounded-2xl border border-border-default/50 bg-popover-background shadow-xl divide-y divide-border-default/50 dark:divide-border-default/16 dark:border-transparent dark:bg-foreground";
  return (
    <div className="fixed inset-0 z-[60] flex">
      <div
        className="claw-slide-in-left flex h-full w-[min(80vw,280px)] flex-col bg-background"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between bg-background px-ml py-m">
          <h2 className="font-heading text-lg font-bold text-text-neutral-primary">OpenUI shell</h2>
          <HeaderIconButton onClick={onClose} label="Close navigation">
            <X size={18} />
          </HeaderIconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-ml py-m">
          {/* Group 1 — Home + Search */}
          <ul className={cardClass}>
            {PRIMARY_NAV.map(renderNavItem)}
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSearch();
                }}
                className="flex h-11 w-full items-center gap-m bg-transparent px-ml text-left font-body text-sm text-text-neutral-secondary transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light sm:hover:bg-sunk-light dark:sm:hover:bg-elevated-light"
              >
                <IconTile icon={Search} />
                <span className="flex-1">Search</span>
              </button>
            </li>
          </ul>

          {/* Group 2 — Categories */}
          <ul className={`mt-m ${cardClass}`}>{CATEGORY_NAV.map(renderNavItem)}</ul>

          {/* Group 3 — System actions */}
          <ul className={`mt-m ${cardClass}`}>
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNotifications();
                }}
                className="flex h-11 w-full items-center gap-m bg-transparent px-ml text-left font-body text-sm text-text-neutral-secondary transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light sm:hover:bg-sunk-light dark:sm:hover:bg-elevated-light"
              >
                <IconTile icon={Bell} />
                <span className="flex-1">Notifications</span>
                {unreadNotificationCount > 0 ? (
                  <span className="inline-flex h-2 w-2 rounded-full bg-text-info-primary" />
                ) : null}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="flex h-11 w-full items-center gap-m bg-transparent px-ml text-left font-body text-sm text-text-neutral-secondary transition-colors first:rounded-t-2xl last:rounded-b-2xl active:bg-sunk-light dark:active:bg-elevated-light sm:hover:bg-sunk-light dark:sm:hover:bg-elevated-light"
              >
                <IconTile icon={Settings} />
                <span className="flex-1">Settings</span>
              </button>
            </li>
          </ul>
        </div>
        <div className="px-ml pb-ml">
          <SegmentedTabs
            value={themeMode}
            onChange={(v) => {
              if (v !== themeMode) onToggleThemeMode();
            }}
            options={[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
            ]}
            ariaLabel="Appearance"
          />
          <div className="my-m h-px bg-border-default/50 dark:bg-border-default/16" />
          <div className="flex items-center gap-s font-body text-sm text-text-neutral-tertiary">
            <span
              aria-hidden="true"
              className={`inline-flex h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[connectionState]}`}
            />
            <span className="truncate">{STATUS_LABEL[connectionState]}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close navigation"
        className="claw-fade-in flex-1 bg-overlay"
      />
    </div>
  );
}

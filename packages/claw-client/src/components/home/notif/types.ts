export type NotifType = "task" | "alert" | "needs_input";

/** Homepage notification view-model (derived from NotificationRecord). */
export interface HomeNotif {
  id: string;
  type: NotifType;
  title: string;
  desc: string;
  /** Timestamp in ms. */
  time: number;
  read: boolean;
  agent?: string;
  cta?: string;
}

export const TYPE_TAG: Record<NotifType, { label: string; bg: string; fg: string }> = {
  task: {
    label: "Task",
    bg: "bg-info-background",
    fg: "text-text-info-primary",
  },
  alert: {
    label: "Alert",
    bg: "bg-danger-background",
    fg: "text-text-danger-primary",
  },
  needs_input: {
    label: "Needs input",
    bg: "bg-alert-background",
    fg: "text-text-alert-primary",
  },
};

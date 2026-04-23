import { ExternalLink } from "lucide-react";
import type { JiraIssue } from "@/lib/jira";
import { getIssueUrl } from "@/lib/jira";
import { cn } from "@/lib/utils";

const PRIORITY_COLOR: Record<string, string> = {
  High: "text-destructive",
  Medium: "text-warning",
  Low: "text-info",
};

const STATUS_BADGE: Record<string, string> = {
  done: "bg-success/15 text-success border-success/30",
  indeterminate: "bg-warning/15 text-warning border-warning/30",
  new: "bg-info/15 text-info border-info/30",
};

export function TicketCard({
  issue,
  compact = false,
  highlight,
}: {
  issue: JiraIssue;
  compact?: boolean;
  highlight?: string;
}) {
  const priColor = PRIORITY_COLOR[issue.fields.priority?.name ?? ""] ?? "text-muted-foreground";
  const statusClass =
    STATUS_BADGE[issue.fields.status.statusCategory.key] ??
    "bg-muted/30 text-muted-foreground border-border";

  return (
    <a
      href={getIssueUrl(issue.key)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group block rounded-lg border border-border bg-card hover:border-primary/40 transition-all duration-200 p-3.5",
        "hover:shadow-[0_0_24px_-8px_oklch(0.68_0.20_255_/_0.3)] hover:-translate-y-0.5",
        highlight === "danger" && "border-destructive/40",
        highlight === "warning" && "border-warning/40",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono font-semibold text-primary">{issue.key}</span>
          <span
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-medium",
              statusClass,
            )}
          >
            {issue.fields.status.name}
          </span>
        </div>
        <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">
        {issue.fields.summary || <span className="italic text-muted-foreground">(no title)</span>}
      </p>

      {!compact && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 min-h-[1.5em]">
          {issue.fields.description || <span className="italic">No description</span>}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className={cn("font-medium", priColor)}>
            ● {issue.fields.priority?.name ?? "—"}
          </span>
          <span>·</span>
          <span>{issue.fields.issuetype.name}</span>
        </div>
        {issue.fields.assignee ? (
          <img
            src={issue.fields.assignee.avatarUrls["32x32"]}
            alt={issue.fields.assignee.displayName}
            title={issue.fields.assignee.displayName}
            className="size-5 rounded-full ring-1 ring-border"
          />
        ) : (
          <div className="size-5 rounded-full bg-muted/50 ring-1 ring-border" title="Unassigned" />
        )}
      </div>
    </a>
  );
}

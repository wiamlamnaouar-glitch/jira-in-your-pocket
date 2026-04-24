import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import { TicketCard } from "@/components/TicketCard";
import {
  getProblemTickets,
  rewriteTicket,
  approveAndPushToJira,
  type RewriteResult,
} from "@/server/jira.functions";
import type { JiraIssue } from "@/lib/jira";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/rewriter")({
  component: RewriterPage,
  head: () => ({ meta: [{ title: "AI Rewriter — AgileFlow AI" }] }),
});

function RewriterPage() {
  const { isManager } = useAuth();
  const [tickets, setTickets] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<JiraIssue | null>(null);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState(false);

  useEffect(() => {
    getProblemTickets()
      .then((d) => setTickets([...d.vague, ...d.misclassified].slice(0, 30)))
      .finally(() => setLoading(false));
  }, []);

  async function handleRewrite(t: JiraIssue) {
    setSelected(t);
    setResult(null);
    setError(null);
    setPushSuccess(false);
    setAiLoading(true);
    try {
      const r = await rewriteTicket({
        data: { key: t.key, summary: t.fields.summary, description: t.fields.description },
      });
      if (r.error) setError(r.error);
      setResult(r.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApprovePush() {
    if (!selected || !result) return;
    setPushing(true);
    setError(null);
    setPushSuccess(false);
    try {
      const r = await approveAndPushToJira({
        data: {
          key: selected.key,
          summary: result.newTitle,
          description: result.newDescription,
          labels: result.suggestedLabels,
          acceptanceCriteria: result.acceptanceCriteria,
          assigneeAccountId: selected.fields.assignee?.accountId ?? null,
          assigneeDisplayName: selected.fields.assignee?.displayName ?? null,
        },
      });
      if (!r.ok) {
        setError(r.error ?? "Push failed");
      } else {
        setPushSuccess(true);
        // remove from list
        setTickets((cur) => cur.filter((t) => t.id !== selected.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Push failed");
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">AI Module</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
          <Sparkles className="size-7 text-primary" />
          AI Ticket Rewriter
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Pick a vague ticket on the left. The AI generates a clean title, full description, acceptance
          criteria and labels — review then copy back to Jira.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Tickets needing rewrite ({tickets.length})
          </h2>
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => handleRewrite(t)}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                selected?.id === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono font-semibold text-primary">{t.key}</span>
                <span className="text-[9px] uppercase text-muted-foreground">{t.fields.issuetype.name}</span>
              </div>
              <p className="text-sm font-medium line-clamp-1">{t.fields.summary}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 italic">
                {t.fields.description || "No description"}
              </p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sticky top-6 self-start min-h-[400px]">
          {!selected && (
            <div className="text-center text-muted-foreground italic py-16">
              ← Select a ticket to generate an improved version
            </div>
          )}
          {selected && (
            <>
              <div className="text-xs text-muted-foreground mb-1">Original</div>
              <TicketCard issue={selected} compact />

              {aiLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-primary">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-sm">AI is rewriting…</span>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 space-y-4"
                >
                  <div className="flex items-center gap-2 text-xs text-success">
                    <Sparkles className="size-3.5" />
                    <span className="uppercase tracking-wider font-semibold">AI suggestion</span>
                  </div>

                  <Field label="New title" value={result.newTitle} />
                  <Field label="New description" value={result.newDescription} multiline />

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Acceptance criteria
                    </div>
                    <ul className="space-y-1.5">
                      {result.acceptanceCriteria.map((c, i) => (
                        <li key={i} className="text-xs bg-muted/30 rounded px-2.5 py-1.5 border border-border">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Suggested labels
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.suggestedLabels.map((l) => (
                        <span
                          key={l}
                          className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground italic border-t border-border pt-3">
                    {result.reasoning}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div
        className={`text-sm bg-muted/30 rounded-lg p-3 border border-border ${
          multiline ? "whitespace-pre-wrap leading-relaxed" : "font-medium"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

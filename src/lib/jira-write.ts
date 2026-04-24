/**
 * Jira write-back helpers — used by manager-only server functions.
 * Updates summary, description (ADF), labels for an issue.
 */

const CLOUD_ID = "1f9d6e41-cc9a-435f-8028-e85a57e97752";
const BASE_URL = `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest/api/3`;

function authHeader() {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!email || !token) {
    throw new Error("ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN not configured");
  }
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/** Convert plain text (with \n paragraphs) to ADF doc */
function textToAdf(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((p) => ({
    type: "paragraph",
    content: p
      .split("\n")
      .flatMap((line, idx, arr) => {
        const nodes: Array<{ type: string; text?: string }> = [{ type: "text", text: line }];
        if (idx < arr.length - 1) nodes.push({ type: "hardBreak" });
        return nodes;
      }),
  }));
  return {
    version: 1,
    type: "doc",
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }],
  };
}

export async function updateJiraIssue(opts: {
  key: string;
  summary?: string;
  description?: string;
  labels?: string[];
  acceptanceCriteria?: string[];
}) {
  const fields: Record<string, unknown> = {};
  if (opts.summary) fields.summary = opts.summary;

  if (opts.description) {
    let body = opts.description;
    if (opts.acceptanceCriteria && opts.acceptanceCriteria.length > 0) {
      body += `\n\nAcceptance Criteria:\n${opts.acceptanceCriteria.map((c) => `• ${c}`).join("\n")}`;
    }
    body += `\n\n— Updated by AgileFlow AI`;
    fields.description = textToAdf(body);
  }

  if (opts.labels && opts.labels.length > 0) {
    // Jira labels can't have spaces — sanitize
    fields.labels = opts.labels.map((l) => l.trim().replace(/\s+/g, "-"));
  }

  const res = await fetch(`${BASE_URL}/issue/${opts.key}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Jira update error", res.status, text);
    throw new Error(`Jira update failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return { ok: true };
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Item =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; label: string; done: boolean }
  | { kind: "error"; text: string };

type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "changed"; recipeId: string }
  | { type: "error"; message: string }
  | { type: "done" };

const SUGGESTIONS = [
  "Make a gluten-free version of the chocolate chip cookie and compare it with the original.",
  "Cut the sugar of the cookie by 20% without raising its cost per kg.",
  "Which recipe is the most expensive per kg, and what drives its cost?",
];

// Minimal rendering of the assistant's Markdown: paragraphs, bullet lists, **bold** and links.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/g).map((part, i) => {
    if (part.startsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer">open</a>;
    return part;
  });
}

function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-*] /.test(line))) {
          return <ul key={i}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\s*[-*] /, ""))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((line, j) => <span key={j}>{j > 0 && <br />}{inline(line.replace(/^#+ /, ""))}</span>)}</p>;
      })}
    </>
  );
}

export default function Assistant() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "smooth" });
  }, [items]);

  function apply(event: AgentEvent) {
    setItems((current) => {
      const next = current.map((item) => (item.kind === "tool" && !item.done && event.type !== "tool" ? { ...item, done: true } : item));
      const last = next[next.length - 1];
      switch (event.type) {
        case "text":
          if (last?.kind === "assistant") return [...next.slice(0, -1), { ...last, text: last.text + event.delta }];
          return [...next, { kind: "assistant", text: event.delta }];
        case "tool":
          return [...next.map((item) => (item.kind === "tool" ? { ...item, done: true } : item)), { kind: "tool", label: event.label, done: false }];
        case "error":
          return [...next, { kind: "error", text: event.message }];
        default:
          return next;
      }
    });
    if (event.type === "changed") {
      router.push(`/products/${event.recipeId}`);
      router.refresh();
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    setItems((current) => [...current, { kind: "user", text: message }]);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId.current, message }),
      });
      if (!response.body) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.filter(Boolean).forEach((line) => apply(JSON.parse(line) as AgentEvent));
      }
    } catch (error) {
      apply({ type: "error", message: error instanceof Error ? error.message : String(error) });
    } finally {
      setItems((current) => current.map((item) => (item.kind === "tool" ? { ...item, done: true } : item)));
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <section className="assistant">
      <header>
        <h2><span className="live" /> Product assistant</h2>
        <p>An AI agent works in beCPG through its API. beCPG computes every figure.</p>
      </header>
      <div className="thread" ref={thread}>
        {items.length === 0 && (
          <div className="suggestions">
            <p className="sub" style={{ margin: "0 0 4px" }}>Ask for a change, an analysis or a new recipe:</p>
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} className="suggestion" onClick={() => send(suggestion)}>{suggestion}</button>
            ))}
          </div>
        )}
        {items.map((item, i) => {
          if (item.kind === "user") return <div key={i} className="msg-user">{item.text}</div>;
          if (item.kind === "assistant") return <div key={i} className="msg-assistant"><Markdown text={item.text} /></div>;
          if (item.kind === "tool") {
            return (
              <div key={i} className="tool">
                {item.done ? <span className="check">✓</span> : <span className="spin" />}
                {item.label}
              </div>
            );
          }
          return <div key={i} className="error">{item.text}</div>;
        })}
      </div>
      <form className="composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <textarea
          value={draft}
          placeholder="Ask the assistant…"
          rows={1}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <button className="button petrol" disabled={busy || !draft.trim()}>Send</button>
      </form>
    </section>
  );
}

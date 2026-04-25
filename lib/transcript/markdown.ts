import MarkdownIt from "markdown-it";
import type { RenderRule } from "markdown-it/lib/renderer.mjs";

import { extractPatch, renderDiffBlock } from "./diff";
import { escapeHtml } from "./utils";

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

const defaultLinkOpen: RenderRule =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index]?.attrSet("target", "_blank");
  tokens[index]?.attrSet("rel", "noreferrer noopener");
  return defaultLinkOpen(tokens, index, options, env, self);
};

markdown.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  if (!token) return "";
  const info = token.info ? token.info.trim() : "";
  const langName = info ? escapeHtml(info.split(/\s+/)[0] ?? "") : "";
  const content = escapeHtml(token.content);
  const langAttr = langName ? ` class="language-${langName}"` : "";
  return `<pre class="code-block-plain"><code${langAttr}>${content}</code></pre>\n`;
};

type DeferredDiff = {
  html: string;
  token: string;
};

function wrapMarkdown(html: string): string {
  return `<div class="block markdown">${html}</div>`;
}

function replaceDeferredBlocks(html: string, deferredDiffs: DeferredDiff[]): string {
  let rendered = html;

  for (const deferred of deferredDiffs) {
    const paragraphPattern = new RegExp(`<p>${deferred.token}</p>`, "g");
    rendered = rendered.replace(paragraphPattern, deferred.html);
    rendered = rendered.replaceAll(deferred.token, deferred.html);
  }

  return rendered;
}

async function deferDiffFences(value: string): Promise<{ deferredDiffs: DeferredDiff[]; source: string }> {
  const fencePattern = /```(?:diff|patch)\s*\n[\s\S]*?\n```/gi;
  const matches = [...value.matchAll(fencePattern)];

  if (matches.length === 0) {
    return { deferredDiffs: [], source: value };
  }

  const deferredDiffs: DeferredDiff[] = [];
  let cursor = 0;
  let source = "";

  let deferredIndex = 0;

  for (const match of matches) {
    const start = match.index;

    if (start === undefined) {
      continue;
    }

    source += value.slice(cursor, start);

    const patch = extractPatch(match[0]);
    if (!patch) {
      source += match[0];
      cursor = start + match[0].length;
      continue;
    }

    const diffHtml =
      (await renderDiffBlock(patch)) ?? `<pre class="tool-payload">${escapeHtml(patch)}</pre>`;
    const token = `AGENT_THREAD_DIFF_BLOCK_${deferredIndex}_TOKEN`;
    deferredDiffs.push({ html: diffHtml, token });
    source += token;
    cursor = start + match[0].length;
    deferredIndex += 1;
  }

  source += value.slice(cursor);

  return { deferredDiffs, source };
}

export async function renderMarkdownInner(value: string): Promise<string> {
  const { deferredDiffs, source } = await deferDiffFences(value);
  const rendered = markdown.render(source);

  if (deferredDiffs.length === 0) {
    return rendered;
  }

  return replaceDeferredBlocks(rendered, deferredDiffs);
}

export async function renderMarkdownBlock(value: string): Promise<string> {
  return wrapMarkdown(await renderMarkdownInner(value));
}

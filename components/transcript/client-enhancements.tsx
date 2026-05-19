"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type LightboxState = {
  src: string;
  alt: string;
} | null;

export const TRANSCRIPT_CONTENT_APPENDED_EVENT = "agent-thread:transcript-content-appended";

function useCodeCollapse() {
  React.useEffect(() => {
    const collapseThreshold = 120;
    const collapsedHeight = 115;

    function restoreTarget(target: HTMLElement) {
      target.style.maxHeight = "";
      target.style.overflow = "";
      target.style.overflowX = "";
      target.style.overflowY = "";
      target.style.webkitMaskImage = "";
      target.style.maskImage = "";

      const wrapper = target.parentElement;
      if (!wrapper?.classList.contains("code-collapser")) {
        return;
      }

      wrapper.querySelector(":scope > [data-expand-btn]")?.remove();
      delete wrapper.dataset.collapsed;
      wrapper.parentElement?.insertBefore(target, wrapper);
      if (wrapper.childNodes.length === 0) {
        wrapper.remove();
      }
    }

    function makeExpandButton(wrapper: HTMLElement, target: HTMLElement) {
      const button = document.createElement("button");
      button.className = "code-expand-btn";
      button.setAttribute("aria-label", "Expand code block");
      button.dataset.expandBtn = "";

      const updateLabel = (collapsed: boolean) => {
        button.textContent = collapsed ? "+ expand" : "- collapse";
        button.setAttribute("aria-label", collapsed ? "Expand code block" : "Collapse code block");
      };

      updateLabel(true);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const isCollapsed = "collapsed" in wrapper.dataset;

        if (isCollapsed) {
          delete wrapper.dataset.collapsed;
          target.style.maxHeight = "";
          target.style.overflow = "";
          target.style.overflowX = "";
          target.style.overflowY = "";
          target.style.webkitMaskImage = "";
          target.style.maskImage = "";
        } else {
          wrapper.dataset.collapsed = "";
          target.style.maxHeight = `${collapsedHeight}px`;
          target.style.overflow = "";
          target.style.overflowX = "auto";
          target.style.overflowY = "hidden";
          target.style.webkitMaskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
          target.style.maskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
        }

        updateLabel(!isCollapsed);
      });

      return button;
    }

    function collapseTarget(target: HTMLElement, wrapper: HTMLElement) {
      if (wrapper.querySelector(":scope > [data-expand-btn]")) {
        return;
      }

      target.style.maxHeight = `${collapsedHeight}px`;
      target.style.overflow = "";
      target.style.overflowX = "auto";
      target.style.overflowY = "hidden";
      target.style.webkitMaskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
      target.style.maskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
      wrapper.dataset.collapsed = "";
      wrapper.appendChild(makeExpandButton(wrapper, target));
    }

    function collapseCodeBlocks() {
      document.querySelectorAll<HTMLElement>(".code-block-wrapper > pre").forEach((pre) => {
        if (pre.scrollHeight <= collapseThreshold) {
          return;
        }

        const parent = pre.parentElement;
        if (!parent) {
          return;
        }

        if (parent.classList.contains("code-block-wrapper") || parent.classList.contains("code-collapser")) {
          parent.style.position = "relative";
          collapseTarget(pre, parent);
          return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "code-collapser";
        parent.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        collapseTarget(pre, wrapper);
      });

      document.querySelectorAll<HTMLElement>(".block.markdown .diff-view").forEach((diffView) => {
        if (diffView.scrollHeight <= collapseThreshold) {
          return;
        }

        const parent = diffView.parentElement;
        if (!parent || parent.classList.contains("code-collapser")) {
          return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "code-collapser";
        parent.insertBefore(wrapper, diffView);
        wrapper.appendChild(diffView);
        collapseTarget(diffView, wrapper);
      });
    }

    collapseCodeBlocks();
    window.addEventListener(TRANSCRIPT_CONTENT_APPENDED_EVENT, collapseCodeBlocks);

    return () => {
      window.removeEventListener(TRANSCRIPT_CONTENT_APPENDED_EVENT, collapseCodeBlocks);
      document.querySelectorAll<HTMLElement>("pre.tool-payload, .toolcall .diff-view, .tool-result-disclosure .diff-view").forEach(
        restoreTarget,
      );
    };
  }, []);
}

export function TranscriptClientEnhancements() {
  const [lightbox, setLightbox] = React.useState<LightboxState>(null);
  useCodeCollapse();

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const imageTrigger = target.closest("[data-lightbox-src]");
      if (!(imageTrigger instanceof HTMLElement)) {
        return;
      }

      const src = imageTrigger.dataset.lightboxSrc;
      if (!src) {
        return;
      }

      setLightbox({ src, alt: imageTrigger.dataset.lightboxAlt ?? "" });
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  React.useEffect(() => {
    document.body.classList.toggle("lightbox-open", Boolean(lightbox));
    return () => document.body.classList.remove("lightbox-open");
  }, [lightbox]);

  return (
    <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
      <DialogContent className="max-w-[min(96vw,1120px)] border-border bg-popover p-3 sm:p-4" showCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Expanded image</DialogTitle>
          <DialogDescription>{lightbox?.alt || "Attached image"}</DialogDescription>
        </DialogHeader>
        {lightbox ? (
          <figure className="grid gap-3">
            <img
              className="mx-auto max-h-[calc(100vh-180px)] max-w-full rounded-md"
              src={lightbox.src}
              alt={lightbox.alt}
            />
            {lightbox.alt.trim().length > 0 ? (
              <figcaption className="text-center text-sm text-muted-foreground">{lightbox.alt}</figcaption>
            ) : null}
          </figure>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

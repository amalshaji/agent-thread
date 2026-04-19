const themeStorageKey = "agent-thread-theme";

export function renderThemeBootScript(): string {
  return `
    (() => {
      try {
        const stored = localStorage.getItem("${themeStorageKey}");
        const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const theme = stored === "light" || stored === "dark" ? stored : system;
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = "light";
      }
    })();
  `;
}

export function renderViewClientScript(): string {
  return `
    (() => {
      const root = document.documentElement;
      const toggle = document.querySelector("[data-theme-toggle]");
      const toggleLabel = document.querySelector("[data-theme-toggle-label]");
      const lightbox = document.querySelector("[data-image-lightbox]");
      const lightboxImage = document.querySelector("[data-lightbox-image]");
      const lightboxCaption = document.querySelector("[data-lightbox-caption]");

      const isTheme = (value) => value === "light" || value === "dark";

      const applyTheme = (theme) => {
        if (!isTheme(theme)) {
          return;
        }

        root.dataset.theme = theme;

        if (toggleLabel instanceof HTMLElement) {
          toggleLabel.textContent = theme === "dark" ? "Dark" : "Light";
        }

        if (toggle instanceof HTMLButtonElement) {
          toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
          toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
        }
      };

      const currentTheme = isTheme(root.dataset.theme) ? root.dataset.theme : "light";
      applyTheme(currentTheme);

      toggle?.addEventListener("click", () => {
        const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
        applyTheme(nextTheme);

        try {
          localStorage.setItem("${themeStorageKey}", nextTheme);
        } catch {}
      });

      const closeLightbox = () => {
        if (!(lightbox instanceof HTMLElement) || !(lightboxImage instanceof HTMLImageElement)) {
          return;
        }

        lightbox.hidden = true;
        document.body.classList.remove("lightbox-open");
        lightboxImage.removeAttribute("src");
        lightboxImage.alt = "";

        if (lightboxCaption instanceof HTMLElement) {
          lightboxCaption.hidden = true;
          lightboxCaption.textContent = "";
        }
      };

      const openLightbox = (src, alt) => {
        if (!(lightbox instanceof HTMLElement) || !(lightboxImage instanceof HTMLImageElement)) {
          return;
        }

        lightbox.hidden = false;
        document.body.classList.add("lightbox-open");
        lightboxImage.src = src;
        lightboxImage.alt = alt;

        if (lightboxCaption instanceof HTMLElement) {
          if (alt.trim().length > 0) {
            lightboxCaption.hidden = false;
            lightboxCaption.textContent = alt;
          } else {
            lightboxCaption.hidden = true;
            lightboxCaption.textContent = "";
          }
        }
      };

      document.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
          return;
        }

        const imageTrigger = target.closest("[data-lightbox-src]");
        if (imageTrigger instanceof HTMLElement) {
          const src = imageTrigger.dataset.lightboxSrc;
          const alt = imageTrigger.dataset.lightboxAlt ?? "";

          if (src) {
            openLightbox(src, alt);
          }

          return;
        }

        if (target.closest("[data-lightbox-dismiss]")) {
          closeLightbox();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          closeLightbox();
        }
      });

      // ── Code block collapse ──────────────────────────────────────────────
      // Threshold: 6 lines × 1.5 line-height × 10.5px font + 20px padding ≈ 115px
      const COLLAPSE_THRESHOLD = 120;
      const COLLAPSED_HEIGHT = 115;

      function makeExpandBtn(wrapper, target) {
        const btn = document.createElement("button");
        btn.className = "code-expand-btn";
        btn.setAttribute("aria-label", "Expand code block");
        btn.dataset.expandBtn = "";

        const updateLabel = (collapsed) => {
          btn.textContent = collapsed ? "+ expand" : "− collapse";
          btn.setAttribute("aria-label", collapsed ? "Expand code block" : "Collapse code block");
        };
        updateLabel(true);

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isCollapsed = "collapsed" in wrapper.dataset;
          if (isCollapsed) {
            delete wrapper.dataset.collapsed;
            target.style.maxHeight = "";
            target.style.webkitMaskImage = "";
            target.style.maskImage = "";
          } else {
            wrapper.dataset.collapsed = "";
            target.style.maxHeight = COLLAPSED_HEIGHT + "px";
            target.style.webkitMaskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
            target.style.maskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
          }
          updateLabel(!isCollapsed);
        });

        return btn;
      }

      function collapseTarget(target, wrapperEl) {
        target.style.maxHeight = COLLAPSED_HEIGHT + "px";
        target.style.overflow = "hidden";
        target.style.webkitMaskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
        target.style.maskImage = "linear-gradient(to bottom, #000 45%, transparent 100%)";
        wrapperEl.dataset.collapsed = "";
        const btn = makeExpandBtn(wrapperEl, target);
        wrapperEl.appendChild(btn);
      }

      // pre.tool-payload and pre inside .code-block-wrapper
      document.querySelectorAll("pre.tool-payload, .code-block-wrapper > pre").forEach((pre) => {
        if (pre.scrollHeight <= COLLAPSE_THRESHOLD) return;

        const parent = pre.parentElement;
        if (!parent) return;

        const isInWrapper = parent.classList.contains("code-block-wrapper");

        if (isInWrapper) {
          // Use the existing .code-block-wrapper as the positioning parent
          parent.style.position = "relative";
          collapseTarget(pre, parent);
        } else {
          // Wrap the standalone pre
          const wrapper = document.createElement("div");
          wrapper.className = "code-collapser";
          parent.insertBefore(wrapper, pre);
          wrapper.appendChild(pre);
          collapseTarget(pre, wrapper);
        }
      });

      // .diff-view blocks
      document.querySelectorAll(".diff-view").forEach((diffView) => {
        if (diffView.scrollHeight <= COLLAPSE_THRESHOLD) return;

        const parent = diffView.parentElement;
        if (!parent) return;

        const wrapper = document.createElement("div");
        wrapper.className = "code-collapser";
        parent.insertBefore(wrapper, diffView);
        wrapper.appendChild(diffView);
        collapseTarget(diffView, wrapper);
      });
    })();
  `;
}

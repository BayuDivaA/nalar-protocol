/* ==========================================================================
   NALAR PROTOCOL · THEME (script half)
   ==========================================================================

   The extension has one design system split across two files by what each
   side can actually consume:

     theme.css  the values. Every colour, radius, space step and type size,
                declared as CSS custom properties for both themes.
     theme.js   the same system for scripts: the token names (so JS writes
                `NALAR_THEME.color.danger`, never a hex), plus the timings a
                script has to hold as numbers because they drive setTimeout
                and animation-delay.

   Keeping values out of JS is deliberate, not an omission: the in-page
   overlay has to render on pages whose CSP blocks injected stylesheets, so
   the stylesheet ships as a file, and a colour defined in two places drifts.
   `color.*` are var() references, resolved by the browser at paint time.

   Loaded by popup.html only. The MAIN world overlay keeps its own constants
   inside injected.js so no page can reach in and rewrite an explorer URL.
   ========================================================================== */

(() => {
  "use strict";

  const css = (name) => `var(--nalar-${name})`;

  const NALAR_THEME = {
    /* Token names, mirroring the custom properties in theme.css. */
    color: {
      background: css("bg"),
      deep: css("bg-deep"),
      surface: css("surface"),
      raised: css("raised"),
      text: css("text"),
      textSecondary: css("text-secondary"),
      textMuted: css("text-muted"),
      border: css("border"),
      borderStrong: css("border-strong"),
      accent: css("accent"),
      accentHover: css("accent-hover"),
      accentText: css("accent-text"),
      accentSoft: css("accent-soft"),
      success: css("success"),
      successSoft: css("success-soft"),
      warning: css("warning"),
      warningSoft: css("warning-soft"),
      danger: css("danger"),
      dangerSoft: css("danger-soft"),
      focus: css("focus"),
    },

    /* Milliseconds. Mirrors the --nalar-motion-* custom properties. */
    motion: {
      instant: 120,
      fast: 160,
      normal: 220,
      enter: 300,
      slow: 420,
      exit: 160,
    },

    /* Section reveal offsets for the decision result, in ms. */
    stagger: [0, 80, 140, 200, 260],

    themes: ["dark", "light"],

    /* Writes the theme onto an element. One attribute switches every token
       in theme.css, so nothing else in the codebase needs to know which
       theme is active. */
    apply(element, theme) {
      const next = NALAR_THEME.themes.includes(theme) ? theme : "dark";
      element.setAttribute("data-nalar-theme", next);
      return next;
    },

    prefersReducedMotion() {
      return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
  };

  if (typeof window !== "undefined") {
    window.NALAR_THEME = NALAR_THEME;
  }
})();

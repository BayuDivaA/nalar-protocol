import { animate } from "framer-motion/dom/mini";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = [0.2, 0.8, 0.2, 1];

window.NALAR_MOTION = {
  enter(element) {
    if (!element || reduced()) return;
    element.classList.add("nalar-motion-driven");
    animate(element, { opacity: [0, 1], transform: ["translateY(4px)", "translateY(0)"] }, { duration: 0.15, ease });
  },
  status(element, active) {
    if (!element || reduced()) return;
    animate(element, { opacity: active ? [0.65, 1] : [1, 0.65], scale: active ? [0.96, 1] : [1, 0.98] }, { duration: 0.2, ease });
  },
  pulse(element) {
    if (!element || reduced()) return;
    animate(element, { opacity: [0.35, 0.9, 1], scale: [0.7, 1.35, 1] }, { duration: 0.3, ease });
  },
};

import { PROTOCOL } from "./constants.js";

export async function getStoredIntent() {
  return new Promise((resolve) => {
    window.postMessage(
      {
        source: PROTOCOL.PAGE_SOURCE,
        type: PROTOCOL.GET_INTENT,
      },
      "*",
    );

    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve("");
    }, 1000);

    function handler(event) {
      if (event.source !== window) {
        return;
      }

      const message = event.data;

      if (!message || message.source !== PROTOCOL.EXTENSION_SOURCE || message.type !== PROTOCOL.INTENT_RESULT) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener("message", handler);

      resolve(message.intent || "");
    }

    window.addEventListener("message", handler);
  });
}

export async function saveIntent(intent) {
  window.postMessage(
    {
      source: PROTOCOL.PAGE_SOURCE,
      type: PROTOCOL.SAVE_INTENT,
      intent,
    },
    "*",
  );
}

export async function getProtectionStatus() {
  return new Promise((resolve) => {
    let completed = false;

    const timeout = setTimeout(() => {
      if (completed) {
        return;
      }

      completed = true;
      window.removeEventListener("message", handler);

      resolve(true);
    }, 1000);

    function handler(event) {
      if (event.source !== window) {
        return;
      }

      const message = event.data;

      if (!message || message.source !== PROTOCOL.EXTENSION_SOURCE || message.type !== PROTOCOL.PROTECTION_STATUS) {
        return;
      }

      clearTimeout(timeout);
      window.removeEventListener("message", handler);

      completed = true;
      resolve(message.enabled !== false);
    }

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: PROTOCOL.PAGE_SOURCE,
        type: PROTOCOL.GET_PROTECTION_STATUS,
      },
      "*",
    );
  });
}

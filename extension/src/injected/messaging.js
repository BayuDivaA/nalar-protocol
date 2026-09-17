import { PROTOCOL } from "./constants.js";

export function sendTransactionRequest({ id, chainId, transaction }) {
  window.postMessage(
    {
      source: PROTOCOL.PAGE_SOURCE,
      type: PROTOCOL.TX_REQUEST,
      id,
      chainId,
      transaction,
    },
    "*",
  );
}

export function listenForTransactionResult(callback) {
  function handler(event) {
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    if (!message || message.source !== PROTOCOL.EXTENSION_SOURCE || message.type !== PROTOCOL.TX_RESULT) {
      return;
    }

    callback(message);
  }

  window.addEventListener("message", handler);

  return () => {
    window.removeEventListener("message", handler);
  };
}

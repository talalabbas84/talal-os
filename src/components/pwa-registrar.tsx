"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let refreshed = false;
    const reloadFlagReset = window.setTimeout(() => {
      window.sessionStorage.removeItem("talal-os-action-reload");
    }, 10_000);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      registration.update().catch(() => {
        // Update failure should not block the app.
      });
    }).catch(() => {
      // Registration failure should not block the app.
    });

    const recoverFromStaleServerAction = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Server Action") || !message.includes("was not found on the server")) return;
      if (window.sessionStorage.getItem("talal-os-action-reload") === "1") return;

      window.sessionStorage.setItem("talal-os-action-reload", "1");
      caches.keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .finally(() => window.location.reload());
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverFromStaleServerAction(event.reason);
    };

    const onError = (event: ErrorEvent) => {
      recoverFromStaleServerAction(event.error ?? event.message);
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);

    return () => {
      window.clearTimeout(reloadFlagReset);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}

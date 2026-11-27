import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "./ui";

/**
 * Registers the service worker (offline app shell) and tells the user when
 * the app is ready offline or when a new version can be loaded.
 */
export function UpdatePrompt() {
  const toast = useToast();
  const shown = useRef({ offline: false, update: false });
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (offlineReady && !shown.current.offline) {
      shown.current.offline = true;
      toast({ tone: "success", title: "Ready to work offline", body: "Life Tracker will open even without a connection." });
    }
  }, [offlineReady, toast]);

  useEffect(() => {
    if (needRefresh && !shown.current.update) {
      shown.current.update = true;
      toast({
        tone: "info",
        title: "Update available",
        body: "A new version of Life Tracker is ready.",
        duration: 0,
        action: { label: "Reload now", onClick: () => updateServiceWorker(true) },
      });
    }
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}

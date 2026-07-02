import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createElement } from "react";

const DISMISS_KEY = "hatchery:pwa-install-dismissed";
const UPVOTE_KEY = "hatchery:pwa-install-upvoted";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: string }>;
}

export interface InstallPromptContextValue {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  shouldShowSnackbar: boolean;
  notifyScrolledPast: () => void;
  notifyFirstUpvote: () => void;
  dismissSnackbar: () => void;
  promptInstall: () => Promise<void>;
}

const fallbackContextValue: InstallPromptContextValue = {
  isInstallable: false,
  isInstalled: false,
  isIOS: false,
  shouldShowSnackbar: false,
  notifyScrolledPast: () => {},
  notifyFirstUpvote: () => {},
  dismissSnackbar: () => {},
  promptInstall: async () => {},
};

const InstallPromptContext = createContext<InstallPromptContextValue>(fallbackContextValue);

function detectIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function storageGet(key: string): string | null {
  return window.localStorage?.getItem(key) ?? null;
}

function storageSet({ key, value }: { key: string; value: string }): void {
  window.localStorage?.setItem(key, value);
}

interface InstallPromptProviderProps {
  children: ReactNode;
}

export function InstallPromptProvider({ children }: InstallPromptProviderProps) {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const isIOS = detectIOS();

  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => isStandalone());
  const [scrolledPastCount, setScrolledPastCount] = useState(0);
  const [hasUpvotedOnce, setHasUpvotedOnce] = useState(
    () => storageGet(UPVOTE_KEY) === "true",
  );
  const [isSnackbarDismissed, setIsSnackbarDismissed] = useState(
    () => storageGet(DISMISS_KEY) === "true",
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setHasDeferredPrompt(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isInstallable = hasDeferredPrompt || isIOS;
  const shouldShowSnackbar =
    isInstallable &&
    !isInstalled &&
    !isSnackbarDismissed &&
    (scrolledPastCount >= 3 || hasUpvotedOnce);

  const notifyScrolledPast = useCallback(() => {
    setScrolledPastCount((prev) => prev + 1);
  }, []);

  const notifyFirstUpvote = useCallback(() => {
    setHasUpvotedOnce(true);
    storageSet({ key: UPVOTE_KEY, value: "true" });
  }, []);

  const dismissSnackbar = useCallback(() => {
    setIsSnackbarDismissed(true);
    storageSet({ key: DISMISS_KEY, value: "true" });
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
    }
  }, []);

  const value: InstallPromptContextValue = {
    isInstallable,
    isInstalled,
    isIOS,
    shouldShowSnackbar,
    notifyScrolledPast,
    notifyFirstUpvote,
    dismissSnackbar,
    promptInstall,
  };

  return createElement(InstallPromptContext.Provider, { value }, children);
}

export function useInstallPrompt(): InstallPromptContextValue {
  return useContext(InstallPromptContext);
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppRoot } from "./AppRoot";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("ルート要素 #root が index.html に見つかりません");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);

// @vitest-environment node
// HTMLRewriter mock that processes HTML text (Cloudflare Workers API is unavailable in Node.js)

export type MockElement = {
  remove: () => void;
  // eslint-disable-next-line max-params
  append: (content: string, opts?: { html?: boolean }) => void;
};

export type MockHandler = {
  element?: (el: MockElement) => void;
};

export class MockHTMLRewriter {
  private _rules: Array<{ selector: string; handler: MockHandler }> = [];

  // eslint-disable-next-line max-params
  on(selector: string, handler: MockHandler) {
    this._rules.push({ selector, handler });
    return this;
  }

  transform(response: Response): Response {
    const rules = this._rules;
    const body = new ReadableStream({
      start(ctrl) {
        response
          .text()
          .then((html) => {
            let result = html;

            for (const { selector, handler } of rules) {
              if (!handler.element) continue;

              if (selector === "head") {
                let appended = "";
                handler.element({ remove: () => {}, append: (c) => { appended += c; } });
                result = result.replace("</head>", appended + "</head>");
              } else {
                const m = selector.match(/^meta\[(property|name)="([^"]+)"\]$/);
                if (!m) continue;
                const [, attr, val] = m;
                const esc = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const re = new RegExp(`<meta\\s[^>]*${attr}="${esc}"[^>]*/?>`, "gi");
                result = result.replace(re, (match) => {
                  let removed = false;
                  handler.element!({ remove: () => { removed = true; }, append: () => {} });
                  return removed ? "" : match;
                });
              }
            }

            ctrl.enqueue(new TextEncoder().encode(result));
            ctrl.close();
          })
          .catch((err) => {
            ctrl.error(err);
          });
      },
    });

    return new Response(body, { status: response.status, headers: response.headers });
  }
}

// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/*
          Disable body scrolling on web to make ScrollView components work correctly.
          If you want to enable scrolling, remove `ScrollViewStyleReset` and
          set `overflow: auto` on the body style below.
        */}
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body > div:first-child { position: fixed !important; top: 0; left: 0; right: 0; bottom: 0; }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }

              /* ── CRT Scanlines ── */
              body::after {
                content: '';
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 3px,
                  rgba(0, 0, 0, 0.13) 3px,
                  rgba(0, 0, 0, 0.13) 4px
                );
                pointer-events: none;
                z-index: 99998;
              }

              /* ── Phosphor Vignette ── */
              body::before {
                content: '';
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(
                  ellipse at 50% 50%,
                  transparent 55%,
                  rgba(0, 0, 0, 0.72) 100%
                );
                pointer-events: none;
                z-index: 99997;
              }

              /* ── CRT Flicker ── */
              @keyframes crt-flicker {
                0%   { opacity: 1; }
                92%  { opacity: 1; }
                93%  { opacity: 0.88; }
                94%  { opacity: 1; }
                97%  { opacity: 1; }
                98%  { opacity: 0.92; }
                100% { opacity: 1; }
              }
              body {
                animation: crt-flicker 8s infinite;
              }

              /* ── Phosphor green glow on game text ── */
              canvas { image-rendering: pixelated; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#000",
        }}
      >
        {children}
      </body>
    </html>
  );
}

/**
 * Served as a route rather than a static file so the guest app can be added to a home
 * screen and open without browser chrome — the camera needs the full viewport.
 */
export function GET() {
  return Response.json({
    name: "MemoVue",
    short_name: "MemoVue",
    description: "The disposable camera for your event.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a090b",
    theme_color: "#0a090b",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}

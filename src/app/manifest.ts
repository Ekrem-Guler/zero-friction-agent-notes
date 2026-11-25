import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeroNote — AI Note & Research Agent",
    short_name: "ZeroNote",
    description:
      "Capture and go: Minimalist AI note agent that classifies, researches, and organizes your quick notes and voice memos.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

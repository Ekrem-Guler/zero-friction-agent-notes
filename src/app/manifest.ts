import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeroNote — AI Note & Research Agent",
    short_name: "ZeroNote",
    description:
      "Yaz ve çık: Yarım notları ve ses kayıtlarını otomatik anlamlandıran minimalist AI not ajanı.",
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

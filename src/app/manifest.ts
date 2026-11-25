import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeroNote — AI Note & Research Agent",
    short_name: "ZeroNote",
    description:
      "Yaz ve çık: Yarım notları ve ses kayıtlarını otomatik anlamlandıran minimalist AI not ajanı.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
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

const SPACE_GROTESK_FONT_URL = new URL(
  "../../assets/og-fonts/SpaceGrotesk-Bold.ttf",
  import.meta.url
);
const INTER_FONT_URL = new URL("../../assets/og-fonts/Inter-Bold.ttf", import.meta.url);
const SOURCE_CODE_PRO_FONT_URL = new URL(
  "../../assets/og-fonts/SourceCodePro-Bold.ttf",
  import.meta.url
);

interface OgFontDefinition {
  name: string;
  data: ArrayBuffer;
  style: "normal";
  weight: 700;
}

const fontDataPromise = Promise.all([
  fetch(SPACE_GROTESK_FONT_URL).then((response) => response.arrayBuffer()),
  fetch(INTER_FONT_URL).then((response) => response.arrayBuffer()),
  fetch(SOURCE_CODE_PRO_FONT_URL).then((response) => response.arrayBuffer()),
]);

export async function loadOgFonts(): Promise<OgFontDefinition[]> {
  const [spaceGrotesk, inter, sourceCodePro] = await fontDataPromise;

  return [
    {
      name: "Space Grotesk",
      data: spaceGrotesk,
      style: "normal",
      weight: 700,
    },
    {
      name: "Inter",
      data: inter,
      style: "normal",
      weight: 700,
    },
    {
      name: "Source Code Pro",
      data: sourceCodePro,
      style: "normal",
      weight: 700,
    },
  ];
}

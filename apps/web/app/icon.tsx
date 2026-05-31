import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Icon generation
export default function Icon() {
  return new ImageResponse(
    // ImageResponse render element
    <div
      style={{
        fontSize: 24,
        background: "black",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "24%",
        border: "1px solid rgba(255,255,255,0.1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Pink glow */}
      <div
        style={{
          position: "absolute",
          left: "-20%",
          top: "-20%",
          width: "80%",
          height: "80%",
          background: "rgba(236, 72, 153, 0.4)",
          filter: "blur(8px)",
          borderRadius: "50%",
        }}
      />
      {/* Purple glow */}
      <div
        style={{
          position: "absolute",
          right: "-20%",
          bottom: "-20%",
          width: "80%",
          height: "80%",
          background: "rgba(168, 85, 247, 0.4)",
          filter: "blur(8px)",
          borderRadius: "50%",
        }}
      />
      {/* Small central dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 0 10px white",
        }}
      />
    </div>,
    // ImageResponse options
    {
      ...size,
    }
  );
}

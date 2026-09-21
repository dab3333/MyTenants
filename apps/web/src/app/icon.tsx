import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#9C4526",
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M2 21V9L12 3L22 9V21H2Z" fill="white" />
          <rect x="9.5" y="14" width="2.2" height="2.2" fill="#9C4526" />
          <rect x="12.8" y="14" width="2.2" height="2.2" fill="#9C4526" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

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
          <path d="M3 21V10.5L12 3L21 10.5V21H3Z" fill="white" />
          <rect x="10" y="15" width="4" height="6" rx="1" fill="#9C4526" />
        </svg>
      </div>
    ),
    { ...size }
  );
}

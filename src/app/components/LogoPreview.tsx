"use client";

import { useEffect, useState } from "react";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

type LogoPreviewProps = {
  logoUrl?: string;
  appName?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const containerSize: Record<NonNullable<LogoPreviewProps["size"]>, string> = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

const imageSize: Record<NonNullable<LogoPreviewProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

export default function LogoPreview({
  logoUrl,
  appName,
  className = "",
  size = "md",
}: LogoPreviewProps) {
  const { settings } = useSystemSettings();
  const [src, setSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const finalLogo = logoUrl ?? settings.logoUrl ?? "/logo.png";
  const finalName = appName ?? settings.appName ?? "Imunia";

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setSrc(finalLogo);
      setHasError(false);
    };
    img.onerror = () => {
      setSrc("/logo.png");
      setHasError(true);
    };
    img.src = finalLogo;
  }, [finalLogo]);

  return (
    <div
      className={`inline-flex items-center justify-center bg-white rounded-full shadow-xl transition-transform duration-500 hover:scale-105 ${containerSize[size]} ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={finalName}
          className={`object-contain ${imageSize[size]} rounded`}
          onError={() => {
            if (!hasError) {
              setSrc("/logo.png");
              setHasError(true);
            }
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100">
          <div className="h-6 w-6 animate-pulse rounded-full bg-gray-300" />
        </div>
      )}
    </div>
  );
}










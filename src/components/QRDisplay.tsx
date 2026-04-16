import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRDisplayProps {
  value: string;
  size?: number;
}

export function QRDisplay({ value, size = 200 }: QRDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }, [value, size]);
  return <canvas ref={canvasRef} />;
}

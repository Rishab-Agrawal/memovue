"use client";

import { useSearchParams } from "next/navigation";

import { CameraScreen } from "./CameraScreen";

export default function Camera() {
  const autoCapture = useSearchParams().get("v") === "captured";
  return <CameraScreen autoCapture={autoCapture} />;
}

"use client";

import { useSearchParams } from "next/navigation";

import { RollBackdrop } from "./RollBackdrop";

export default function RollHome() {
  const revealed = useSearchParams().get("v") === "revealed";
  return <RollBackdrop revealed={revealed} />;
}

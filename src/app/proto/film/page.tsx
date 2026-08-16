"use client";

import { useSearchParams } from "next/navigation";

import { FilmBackdrop } from "./FilmBackdrop";

export default function FilmHome() {
  const revealed = useSearchParams().get("v") === "revealed";
  return <FilmBackdrop revealed={revealed} />;
}

"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mt-9 h-12 rounded-md bg-[#111] px-7 text-[15px] font-medium text-white print:hidden"
    >
      Print this card
    </button>
  );
}

/**
 * A QR code that isn't one.
 *
 * Deliberately not generated from the join URL: a scannable code in a prototype invites
 * someone to scan it, and there is nothing on the other end. This is a fixed 21x21 pattern
 * with the three finder squares in place, which reads as a QR at a glance and resolves to
 * nothing under a camera.
 */
const SIZE = 21;

function isFinder(row: number, col: number) {
  const inBox = (r0: number, c0: number) =>
    row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;

  if (!inBox(0, 0) && !inBox(0, SIZE - 7) && !inBox(SIZE - 7, 0)) return null;

  const r = row < 7 ? row : row - (SIZE - 7);
  const c = col < 7 ? col : col - (SIZE - 7);
  const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
  return ring === 3 || ring <= 1;
}

export function QrPlate({ className }: { className?: string }) {
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;

    const finder = isFinder(row, col);
    if (finder !== null) return finder;

    // A stable hash so the pattern never changes between renders.
    return (((row + 1) * 73856093) ^ ((col + 1) * 19349663)) % 7 < 3;
  });

  return (
    <div
      className={className}
      role="img"
      aria-label="Invitation QR code"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
        background: "#ffffff",
        padding: "8%",
      }}
    >
      {cells.map((on, index) => (
        <span key={index} style={{ aspectRatio: "1", background: on ? "#000000" : "#ffffff" }} />
      ))}
    </div>
  );
}

import { Notice, PillLink } from "@/components/roll/Chrome";

export const metadata = { title: "Not found" };

/**
 * Both kinds of 404 at once: a URL that matches no route, and `notFound()` thrown from a
 * segment — which is what the host's roll screen does for a roll that is somebody else's or
 * no longer there.
 *
 * Home rather than back. Whoever lands here arrived from a link that does not work, so the
 * one place guaranteed to still exist is the only offer worth making.
 */
export default function NotFound() {
  return (
    <Notice
      title={<>That page isn&rsquo;t here</>}
      actions={
        <PillLink href="/" className="mt-4">
          Go home
        </PillLink>
      }
    >
      The link may be old, or the roll it pointed at has since been deleted.
    </Notice>
  );
}

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="marking !mt-6">Last updated 16 August 2026</p>

      <p>
        This explains what MemoVue collects, why, and what you can do about it. The short
        version: we collect the minimum needed to run a shared photo roll, we don&rsquo;t track
        you across the internet, and we don&rsquo;t sell anything to anyone.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>If you host a roll:</strong> your name, email address and profile picture, as
        Google gives them to us when you sign in. <strong>We never see or store a
        password</strong> — sign-in happens on Google&rsquo;s side and we only receive the
        result. Plus the rolls you create, the coupon code you used to create them, and any
        cover image you upload for a roll.
      </p>
      <p>
        <strong>If you join a roll as a guest:</strong> the display name you type, the photos
        you take, and when you took them. We do not ask for your email, your phone number, or
        anything else, and you do not need an account. If you later choose to create one, the
        rolls you joined become linked to it.
      </p>
      <p>
        <strong>Automatically:</strong> your IP address, briefly, to rate-limit abuse, and
        ordinary server logs. We do not use analytics, advertising trackers, or third-party
        cookies. The only cookies we set are the ones that keep you signed in.
      </p>

      <h2>Who can see your photos</h2>
      <p>
        This depends on two choices the host makes when they create the roll, and both are
        shown to every guest on their own screen before they take a photo.
      </p>
      <ul>
        <li>
          <strong>When photos become visible.</strong> Either as they are taken, or when the
          roll closes, or a set number of hours after it closes. If the host chose to wait,
          then until that moment <strong>nobody</strong> can see a photo — not the other
          guests, not the host, and not the person who took it. The only thing anyone can see
          is a roughly 32-pixel blurred placeholder, which exists so the app can show that
          people are shooting.
        </li>
        <li>
          <strong>Who sees what, once visible.</strong> Either everyone who joined that roll
          sees all of it, or each guest sees only their own photos. The host sees all of it
          either way.
        </li>
      </ul>
      <p>
        Photos are stored privately on Cloudflare R2 and are never publicly accessible. Every
        image is served through a signed link that expires within an hour, so a copied link
        stops working rather than exposing the roll indefinitely.
      </p>

      <h2>Where your data lives</h2>
      <p>
        Photos are stored on <strong>Cloudflare R2</strong>. The application and its database
        run on <strong>Railway</strong>. Sign-in is handled by <strong>Google</strong>. Email
        notifications are sent through <strong>Resend</strong>. These are our only processors,
        and none of them are permitted to use your data for their own purposes.
      </p>

      <h2>How long we keep it</h2>
      <p>
        A roll and every photo in it is kept for <strong>30 days after the roll closes</strong>,
        then permanently deleted. We email the host <strong>7 days</strong> and again{" "}
        <strong>1 day</strong> beforehand, so there is time to download everything.
      </p>
      <p>
        When a host deletes a roll or their account, we delete the database records and the
        image files themselves. Backup copies age out within 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Hosts</strong> can delete any roll, or their entire account and every photo in
          it, from the Settings page.
        </li>
        <li>
          <strong>Guests</strong> can have their photos removed by emailing us with the roll
          name and the name they joined under.
        </li>
        <li>
          You can ask for a copy of the data we hold about you, ask us to correct it, or ask us
          to erase it. Email us and we&rsquo;ll do it within 30 days.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        MemoVue isn&rsquo;t intended for children under 13, and we don&rsquo;t knowingly collect
        their data. Children may of course appear in photos taken at an event — those photos
        belong to the roll and are governed by the same rules and the same deletion rights as
        everything else. If you&rsquo;re a parent or guardian and want a photo removed, email us
        and we will.
      </p>

      <h2>Security</h2>
      <p>
        There are no passwords to steal: sign-in is delegated to Google, and we store only the
        account identifier it returns. Sessions use signed tokens in HTTP-only cookies. Traffic
        is encrypted in transit, image storage is private, and no image is reachable without a
        short-lived signed link. No system is perfect, but we&rsquo;ve tried not to leave the
        obvious doors open.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a material change to this policy, we&rsquo;ll email hosts and update the date
        at the top.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, or a deletion request:{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>
      </p>
    </>
  );
}

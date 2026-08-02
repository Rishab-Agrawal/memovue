export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="marking !mt-6">Last updated 1 August 2026</p>

      <p>
        This explains what MemoVue collects, why, and what you can do about it. The short version:
        we collect the minimum needed to run a shared photo album, we don&rsquo;t track you across
        the internet, and we don&rsquo;t sell anything to anyone.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>If you host an event:</strong> your name, email address, and a hashed version of
        your password — we never store the password itself. Plus whatever you tell us in your beta
        access request, and the events you create.
      </p>
      <p>
        <strong>If you join an event as a guest:</strong> the display name you type, optionally how
        you know the host if they asked, the photos you take, and when you took them. We do not ask
        for your email, your phone number, or anything else. You do not get an account.
      </p>
      <p>
        <strong>Automatically:</strong> your IP address, briefly, to rate-limit abuse, and ordinary
        server logs. We do not use analytics, advertising trackers, or third-party cookies. The only
        cookie we set is the one that keeps you signed in.
      </p>

      <h2>Who can see your photos</h2>
      <ul>
        <li>
          <strong>Before the reveal time: nobody.</strong> Not other guests, not the host, not the
          person who took the photo. The only thing anyone can see is a roughly 32-pixel blurred
          placeholder, which exists so the app can show that people are shooting.
        </li>
        <li>
          <strong>After the reveal time:</strong> everyone who joined that specific event, and the
          host.
        </li>
        <li>
          <strong>The host</strong> can download the full album once it has been revealed.
        </li>
      </ul>
      <p>
        Photos are stored privately on Cloudflare R2 and are never publicly accessible. Every image
        is served through a signed link that expires within an hour, so a copied link stops working
        rather than exposing the album indefinitely.
      </p>

      <h2>Where your data lives</h2>
      <p>
        Photos are stored on <strong>Cloudflare R2</strong>. The application and its database run
        on <strong>Railway</strong>. If email notifications are enabled, we use{" "}
        <strong>Resend</strong> to send them. These are our only processors, and none of them are
        permitted to use your data for their own purposes.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Albums are kept for as long as the host&rsquo;s account exists. There&rsquo;s no expiry
        clock. If we ever need to change that, the host gets{" "}
        <strong>at least 30 days&rsquo; notice by email</strong> before anything is removed.
      </p>
      <p>
        When a host deletes an event or their account, we delete the database records and the image
        files themselves. Backup copies age out within 30 days.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Hosts</strong> can delete any event, or their entire account and every photo in
          it, from the Account page.
        </li>
        <li>
          <strong>Guests</strong> can have their photos removed by emailing us with the event name
          and the name they joined under.
        </li>
        <li>
          You can ask for a copy of the data we hold about you, ask us to correct it, or ask us to
          erase it. Email us and we&rsquo;ll do it within 30 days.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        MemoVue isn&rsquo;t intended for children under 13, and we don&rsquo;t knowingly collect
        their data. Children may of course appear in photos taken at an event — those photos belong
        to the event and are governed by the same rules and the same deletion rights as everything
        else. If you&rsquo;re a parent or guardian and want a photo removed, email us and we will.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with bcrypt. Sessions use signed tokens in HTTP-only cookies. Traffic
        is encrypted in transit, image storage is private, and no image is reachable without a
        short-lived signed link. No system is perfect, but we&rsquo;ve tried not to leave the
        obvious doors open.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a material change to this policy, we&rsquo;ll email hosts and update the date at
        the top.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, or a deletion request:{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>
      </p>
    </>
  );
}

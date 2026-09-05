export const metadata = { title: "Privacy Policy" };

/**
 * Every fact in here is checked against the code, not against the roadmap, and the code wins
 * whenever the two disagree. Section 5 promises a warning email seven days before a roll ages
 * out because `retention.ts` now sends one; while it did not, this page promised nothing.
 *
 * Section 1's paragraph on automatic collection is the one people expect to be a lie, so it
 * names exactly what the `Metric` table holds — a few daily counters with no identifier
 * anywhere in the row — rather than hiding behind "we collect usage data".
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="marking !mt-6">Last updated 6 September 2026</p>

      <p>
        This explains what MemoVue collects, why, and what you can do about it. It covers{" "}
        <strong>memovue.com</strong> and everything you reach from it, whether you host a roll
        or join one as a guest.
      </p>
      <p>
        The short version: we collect the minimum needed to run a shared photo roll, we do not
        track you across the internet, we run no advertising, and we do not sell or share your
        data with anyone who is not helping us deliver the service.
      </p>

      <h2>1. Data we collect</h2>
      <p>
        <strong>If you host a roll.</strong> Your name, email address and profile picture, as
        Google gives them to us when you sign in. <strong>We never see or store a
        password</strong>{" "}
        — sign-in happens on Google&rsquo;s side and we receive only the
        result. We also store the rolls you create and their settings, and any cover image you
        upload. If you ask for beta access, we keep what you put in that form — your name, your
        event type, and the phone number and remarks if you give them — alongside the email
        address you signed in with, so we can get back to you.
      </p>
      <p>
        <strong>If you join a roll as a guest.</strong> The display name you type, the photos
        you take, and when you took them. We do not ask for your email address, your phone
        number, or anything else, and you do not need an account. If you later choose to create
        one, the rolls you joined become linked to it.
      </p>
      <p>
        <strong>Automatically.</strong> Your IP address, held briefly in memory to rate-limit
        abuse, and ordinary server logs. We also keep a <strong>daily count</strong> of a
        handful of totals — how many invitation screens were shown, how many uploads failed,
        how many errors happened — and when something goes wrong we record the error message
        and which page it happened on, so that we can fix it. Those counts are numbers in a
        table with nothing attached to them: no identifier, no profile, no record of who did
        what, and nothing that can be traced back to you.{" "}
        <strong>We use no advertising trackers, no third-party analytics, no third-party
        cookies and no session recording.</strong>{" "}
        The only cookies we set are the ones that keep you signed in as a host or attached to
        a roll as a guest.
      </p>
      <p>
        <strong>Camera and photo access.</strong> Your browser asks before MemoVue may use your
        camera, and only on the screen where you are taking a photo. We cannot reach it in the
        background, and we never read your camera roll — a MemoVue photo is one you took inside
        MemoVue.
      </p>

      <h2>2. How we use it</h2>
      <ul>
        <li>To run the service: creating rolls, letting guests in, storing photos, and opening
          an album at the time the host chose.</li>
        <li>To keep it working: diagnosing errors, and limiting abuse of the join and upload
          routes.</li>
        <li>To contact you about something you did — a roll you created, or a support question
          you asked us.</li>
        <li>To meet legal obligations and enforce our terms.</li>
      </ul>
      <p>
        If you are in the EEA or UK, our legal bases are performance of a contract (running a
        roll you asked for), legitimate interests (security and abuse prevention), and legal
        obligation. If you are in India, we process your personal data for the lawful purpose
        of providing the service you signed up for.
      </p>
      <p>
        <strong>We do not train any model on your photos</strong>, our own or anybody
        else&rsquo;s, and we do not use them to advertise or promote MemoVue.
      </p>

      <h2>3. How we share it</h2>
      <p>
        <strong>We do not sell personal information, and we allow no cross-site tracking.</strong>
      </p>
      <p>
        <strong>Inside a roll.</strong> Your display name is shown to the other people in that
        roll beside the photos you took. What else they can see depends on the two settings in
        section 4 below.
      </p>
      <p>
        <strong>With our processors.</strong> These are the only companies that touch your data,
        each acting on our instructions and none permitted to use it for their own purposes:
      </p>
      <ul>
        <li>
          <strong>Cloudflare</strong> — photo and cover storage (R2), and the network in front
          of the site.
        </li>
        <li>
          <strong>Railway</strong> — hosting for the application and its PostgreSQL database.
        </li>
        <li>
          <strong>Google</strong> — sign-in for hosts.
        </li>
        <li>
          <strong>Resend</strong> — the emails we send you.
        </li>
        <li>
          <strong>Telegram</strong> — the private channel our own operational messages go to:
          crash reports, the daily totals above, and a note when somebody signs up or asks for
          beta access. Nobody outside MemoVue can read it, and no photograph is ever sent there.
        </li>
      </ul>
      <p>
        We may also disclose data where the law requires it, or to protect someone from harm.
        If MemoVue is ever acquired, your data would move with it and this policy would follow
        until replaced by one no less protective.
      </p>

      <h2>4. Who can see your photos</h2>
      <p>
        Two choices the host makes when they create the roll, both shown to every guest on their
        own screen before they take a single photo.
      </p>
      <ul>
        <li>
          <strong>When photos become visible.</strong> Either as they are taken, or when the
          roll closes, or a set number of hours after it closes. If the host chose to wait, then
          until that moment <strong>nobody</strong> can see a photo — not the other guests, not
          the host, and not the person who took it. The only thing anyone can see is a roughly
          32-pixel blurred placeholder, which exists so the app can show that people are
          shooting.
        </li>
        <li>
          <strong>Who sees what, once visible.</strong> Either everyone who joined that roll
          sees all of it, or each guest sees only their own photos. The host sees all of it
          either way.
        </li>
      </ul>
      <p>
        Photos are stored privately on Cloudflare R2 and are never publicly readable. Every
        image is served through a signed link that expires within an hour, so a copied link
        stops working rather than exposing a roll indefinitely.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        <strong>Rolls and photos.</strong> Kept for <strong>30 days after the roll
        closes</strong>, then deleted along with the image files themselves. The exact date is
        printed on the roll and on every guest&rsquo;s album screen, as &ldquo;Photos available
        until&hellip;&rdquo;, and we email the host <strong>7 days</strong> beforehand.{" "}
        <strong>Download what you want to keep before then.</strong>
      </p>
      <p>
        <strong>Account data.</strong> Kept while your account exists.
      </p>
      <p>
        <strong>Deletion.</strong> When a host deletes a roll or their account, we remove the
        database records and the stored image files. Backup copies age out within 30 days.
      </p>
      <p>
        <strong>Logs.</strong> Ordinary server logs are short-lived. Rate-limit records live
        only in memory and disappear within minutes.
      </p>

      <h2>6. Security</h2>
      <p>
        There are no passwords to steal: sign-in is delegated to Google, and we store only the
        account identifier it returns. Sessions use signed tokens in HTTP-only cookies. Traffic
        is encrypted in transit, storage is encrypted at rest by our providers and is private,
        and no image is reachable without a short-lived signed link.
      </p>
      <p>
        Security is never total, and we would rather say so than imply otherwise. If a breach
        affects your personal data we will tell you, and the relevant authority, where the law
        requires it.
      </p>

      <h2>7. Your choices and rights</h2>
      <ul>
        <li>
          <strong>Hosts</strong> can delete any roll, or their entire account and every photo in
          it, from within the app.
        </li>
        <li>
          <strong>Guests</strong> can have their photos removed by emailing us with the roll
          name and the name they joined under. We confirm the request with the host before
          removing anything, so that nobody can delete another guest&rsquo;s photos.
        </li>
        <li>
          Anyone can ask for a copy of the data we hold about them, ask us to correct it, or ask
          us to erase it. Email us and we will act within 30 days. You can also withdraw your
          consent at any time by emailing us, which ends your use of MemoVue and deletes your
          rolls.
        </li>
      </ul>
      <p>
        <strong>India (DPDP Act, 2023).</strong> You have the right to access a summary of your
        personal data, to correction and erasure, to nominate someone to exercise your rights,
        and to a grievance procedure. Write to the address in section 11 and we will respond;
        if you are not satisfied you may complain to the Data Protection Board of India.
      </p>
      <p>
        <strong>EEA and UK (GDPR).</strong> Access, rectification, erasure, portability,
        objection and restriction, and the right to complain to your local supervisory
        authority.
      </p>
      <p>
        <strong>California (CCPA/CPRA).</strong> Rights to know, delete, correct, and to opt out
        of sale or sharing — we do neither. We will never discriminate against you for
        exercising any of these rights.
      </p>

      <h2>8. Children</h2>
      <p>
        MemoVue is not intended for anyone under 18 and we do not knowingly collect their
        personal data. Children may of course appear in photos taken at an event — those photos
        belong to the roll and are governed by the same rules and the same deletion rights as
        everything else. If you are a parent or guardian and want a photo removed, email us and
        we will remove it.
      </p>

      <h2>9. International transfers</h2>
      <p>
        MemoVue is operated from India. Our providers store and process data in facilities
        outside India, including in the European Union and the United States. Where a transfer
        requires a safeguard, we rely on the terms our providers offer for it, including the
        European Commission&rsquo;s standard contractual clauses.
      </p>

      <h2>10. Changes</h2>
      <p>
        If we make a material change to this policy we will email hosts and update the date at
        the top. Continuing to use MemoVue after a change takes effect means you accept it.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions, requests, and grievances all go to the same place:{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>. We aim to reply within{" "}
        <strong>48 hours</strong>. For anything time-critical, put <strong>PRIORITY</strong> at
        the start of the subject line.
      </p>
      <p>
        MemoVue is operated from Bengaluru, India. Postal address available on request.
      </p>
    </>
  );
}

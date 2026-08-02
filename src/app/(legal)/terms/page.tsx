export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="marking !mt-6">Last updated 1 August 2026</p>

      <p>
        MemoVue lets a host set up a shared photo album for an event. Guests take photos on their
        own phones, and nobody — including the host and the photographer — can see any of them
        until the reveal time the host chose. These terms cover both hosts and guests. By creating
        an event or joining one, you agree to them.
      </p>

      <h2>1. The service is in beta</h2>
      <p>
        MemoVue is free while in beta, and hosting an event currently requires approval from us.
        Beta means exactly what it sounds like: features may change, and we can&rsquo;t promise
        uninterrupted service. Please don&rsquo;t make MemoVue the only record of something
        irreplaceable.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Only hosts need an account. You&rsquo;re responsible for keeping your password to yourself
        and for everything done through your account. Guests never create accounts — they&rsquo;re
        identified by the name they enter and a token stored in their browser.
      </p>

      <h2>3. Your photos stay yours</h2>
      <p>
        Guests keep full ownership and copyright of every photo they take. By submitting a photo to
        an event, a guest grants MemoVue a limited licence to store it and display it to the other
        people in that event, and grants the host permission to download it. That licence exists
        only to run the service and ends when the photo is deleted.
      </p>
      <p>
        <strong>We will never sell your photos, use them to advertise, publish them, or train any
        model on them.</strong>
      </p>

      <h2>4. Hosts are responsible for their event</h2>
      <ul>
        <li>
          You must have the right to invite the people you invite, and to share a QR code that
          gives them access.
        </li>
        <li>
          You&rsquo;re responsible for the conduct of your event and for anything your guests
          upload to it.
        </li>
        <li>
          Downloading the album gives you a copy — it doesn&rsquo;t transfer copyright from your
          guests. Ask before publishing someone else&rsquo;s photo.
        </li>
      </ul>

      <h2>5. What you may not do</h2>
      <ul>
        <li>Upload anything unlawful, sexually explicit involving minors, or designed to harass.</li>
        <li>Photograph people who have asked you not to.</li>
        <li>
          Attempt to reach photos before their reveal time, access an event you weren&rsquo;t
          invited to, or interfere with the service.
        </li>
        <li>Impersonate another guest to take over their name or their remaining shots.</li>
      </ul>
      <p>
        We may remove content or close an account that breaks these rules, usually without notice
        where there&rsquo;s a risk to someone.
      </p>

      <h2>6. How long we keep photos</h2>
      <p>
        By default we keep an album for as long as the account exists — there&rsquo;s no expiry
        date and no countdown. If we ever have to change that for your event, for example because
        of storage costs or because we&rsquo;re shutting down, we will{" "}
        <strong>email the host at least 30 days before anything is deleted</strong>, so there is
        time to download everything.
      </p>
      <p>
        A host can delete an event or their whole account at any time. That removes the photos from
        our database and our storage permanently, for every guest. Backups are cycled out within 30
        days.
      </p>

      <h2>7. Deleting your own photos</h2>
      <p>
        Guests can ask us to remove photos they took by emailing{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a> from a contactable address with
        the event name and the name they joined under. We&rsquo;ll remove them, and they&rsquo;ll
        disappear for everyone in that event.
      </p>

      <h2>8. Liability</h2>
      <p>
        MemoVue is provided as-is. To the fullest extent the law allows, we&rsquo;re not liable for
        lost photos, missed moments, or any indirect or consequential loss. Because the service is
        currently free, our total liability to you is limited to any amount you have actually paid
        us, which for now is nothing. Nothing here limits liability that can&rsquo;t legally be
        limited.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. If a change materially affects you, we&rsquo;ll tell hosts by
        email. Continuing to use MemoVue after a change means you accept it.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of Bengaluru, Karnataka have
        exclusive jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>
      </p>
    </>
  );
}

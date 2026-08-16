export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="marking !mt-6">Last updated 16 August 2026</p>

      <p>
        MemoVue lets a host set up a shared photo roll for an event. Guests take photos on
        their own phones, and when the photos become visible is a choice the host makes when
        they create the roll. These terms cover both hosts and guests. By creating a roll or
        joining one, you agree to them.
      </p>

      <h2>1. The service is in beta</h2>
      <p>
        MemoVue is free while in beta, and creating a roll currently requires a coupon code
        from us. Beta means exactly what it sounds like: features may change, and we
        can&rsquo;t promise uninterrupted service. Please don&rsquo;t make MemoVue the only
        record of something irreplaceable.
      </p>

      <h2>2. Accounts</h2>
      <p>
        Hosts sign in with Google — we never see or store a password. You&rsquo;re
        responsible for everything done through your account. Guests don&rsquo;t need an
        account: they&rsquo;re identified by the name they enter and a token stored in their
        browser. A guest may optionally create an account later so the rolls they joined stay
        attached to them.
      </p>

      <h2>3. Your photos stay yours</h2>
      <p>
        Guests keep full ownership and copyright of every photo they take. By submitting a
        photo to a roll, a guest grants MemoVue a limited licence to store it and display it
        to the other people in that roll, and grants the host permission to download it. That
        licence exists only to run the service and ends when the photo is deleted.
      </p>
      <p>
        <strong>We will never sell your photos, use them to advertise, publish them, or train
        any model on them.</strong>
      </p>

      <h2>4. When photos become visible</h2>
      <p>
        The host chooses this when they create the roll, and every guest can see which choice
        was made on their own screen before they take a single photo:
      </p>
      <ul>
        <li>
          <strong>During the event</strong> — photos are visible as they are taken. Nothing is
          ever hidden.
        </li>
        <li>
          <strong>When the roll closes</strong>, or <strong>a set number of hours after it
          closes</strong> — until that moment nobody can see a photo. Not the other guests,
          not the host, and not the person who took it. The only thing anyone can see is a
          roughly 32-pixel blurred placeholder, which exists so the app can show that people
          are shooting.
        </li>
      </ul>
      <p>
        A host can also open a roll early. They cannot close one again — once photos have been
        seen, they have been seen.
      </p>
      <p>
        Separately, the host chooses whether guests see the whole roll or only their own
        photos. The host can always see the whole roll once it is open.
      </p>

      <h2>5. Hosts are responsible for their roll</h2>
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
          Downloading the roll gives you a copy — it doesn&rsquo;t transfer copyright from your
          guests. Ask before publishing someone else&rsquo;s photo.
        </li>
      </ul>

      <h2>6. What you may not do</h2>
      <ul>
        <li>Upload anything unlawful, sexually explicit involving minors, or designed to harass.</li>
        <li>Photograph people who have asked you not to.</li>
        <li>
          Attempt to reach photos before they become visible, access a roll you weren&rsquo;t
          invited to, or interfere with the service.
        </li>
        <li>Impersonate another guest to take over their name or their remaining shots.</li>
      </ul>
      <p>
        We may remove content or close an account that breaks these rules, usually without
        notice where there&rsquo;s a risk to someone.
      </p>

      <h2>7. How long we keep photos</h2>
      <p>
        A roll and everything in it is kept for{" "}
        <strong>30 days after the roll closes</strong>, then permanently deleted. We email the
        host <strong>7 days</strong> and again <strong>1 day</strong> before that happens, so
        there is time to download everything.
      </p>
      <p>
        Download the photos you want to keep. MemoVue is a way to collect them, not a place to
        store them.
      </p>
      <p>
        A host can delete a roll or their whole account at any time, which removes the photos
        from our database and our storage permanently, for every guest. Backups are cycled out
        within 30 days.
      </p>

      <h2>8. Deleting your own photos</h2>
      <p>
        Guests can ask us to remove photos they took by emailing{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a> from a contactable address
        with the roll name and the name they joined under. We&rsquo;ll remove them, and
        they&rsquo;ll disappear for everyone in that roll.
      </p>

      <h2>9. Liability</h2>
      <p>
        MemoVue is provided as-is. To the fullest extent the law allows, we&rsquo;re not liable
        for lost photos, missed moments, or any indirect or consequential loss. Because the
        service is currently free, our total liability to you is limited to any amount you have
        actually paid us, which for now is nothing. Nothing here limits liability that
        can&rsquo;t legally be limited.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these terms. If a change materially affects you, we&rsquo;ll tell hosts by
        email. Continuing to use MemoVue after a change means you accept it.
      </p>

      <h2>11. Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts of Bengaluru, Karnataka
        have exclusive jurisdiction.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>
      </p>
    </>
  );
}

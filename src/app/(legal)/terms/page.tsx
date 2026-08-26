export const metadata = { title: "Terms of Service" };

/**
 * Structured after once.film's terms, section for section, with three deliberate departures.
 *
 * There are no app-store clauses, because MemoVue is a website and no store is party to
 * anything here. Arbitration is not imposed: the reference app is a Delaware company sending
 * disputes to JAMS, and a JAMS clause against Indian consumers is both unenforceable and
 * hostile, so this keeps the courts named in section 16. And the content licence is narrower
 * than theirs — no "back up", no blanket processing right — because the whole product promise
 * is that we cannot look.
 */
export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="marking !mt-6">Last updated 23 August 2026</p>

      <p>
        MemoVue lets a host set up a shared photo roll for an event. Guests take photos on their
        own phones, and when those photos become visible is a choice the host makes when they
        create the roll. These terms cover both hosts and guests. By creating a roll or joining
        one, you agree to them.
      </p>

      <h2>1. Who may use MemoVue</h2>
      <p>
        You must be at least <strong>13</strong>. If you are under the age of majority where you
        live, you may use MemoVue only with a parent or guardian&rsquo;s consent, and they agree
        to these terms on your behalf. If you are using MemoVue for a company or another
        organisation, you confirm you are authorised to bind it.
      </p>

      <h2>2. The service is in beta</h2>
      <p>
        MemoVue is free while in beta, and creating a roll currently requires a coupon code from
        us. Beta means what it sounds like: features may change, and we cannot promise
        uninterrupted service. <strong>Please do not make MemoVue the only record of something
        irreplaceable.</strong>
      </p>

      <h2>3. Your account</h2>
      <p>
        Hosts sign in with Google — we never see or store a password. You are responsible for
        keeping access to that Google account secure and for everything done through yours. Tell
        us immediately if you think someone else has reached it.
      </p>
      <p>
        Guests do not need an account: they are identified by the name they enter and a signed
        token stored in their own browser. A guest may create an account later so the rolls they
        joined stay attached to them.
      </p>
      <p>
        A name in a roll belongs to whoever claimed it first. Reclaiming a name from another
        device signs that device out, which is by design — it makes an attempted takeover
        obvious to the person it is taken from.
      </p>

      <h2>4. Coupons, pricing and refunds</h2>
      <p>
        A coupon is issued to a person, may be spent on exactly one roll, and cannot be
        transferred, resold or redeemed for cash. We may decline or withdraw one.
      </p>
      <p>
        <strong>We currently take no payment.</strong> If MemoVue introduces paid rolls, the
        price and the refund terms will be shown before you pay, they will apply only to rolls
        created afterwards, and nothing you have already created will retroactively start
        costing money.
      </p>

      <h2>5. Permissions and device access</h2>
      <p>
        Your browser asks before MemoVue may use your camera, and only on the screen where you
        are taking a photo. We cannot reach it in the background and we do not read your camera
        roll. You are responsible for your own mobile data charges.
      </p>

      <h2>6. Your photos stay yours</h2>
      <p>
        Guests keep full ownership and copyright of every photo they take. By submitting a photo
        to a roll, a guest grants MemoVue a <strong>limited, non-exclusive, royalty-free
        licence to store that photo and to display it to the other people in that roll under
        that roll&rsquo;s settings</strong>, and grants the host permission to download it. The
        licence exists only to run the service and ends when the photo is deleted.
      </p>
      <p>
        A host receives, from every guest in their roll, a non-exclusive licence to view,
        download and share that roll&rsquo;s photos for personal, event or internal purposes.{" "}
        <strong>Commercial use needs the photographer&rsquo;s permission.</strong>{" "}
        Downloading a
        roll gives you a copy; it does not transfer anyone&rsquo;s copyright.
      </p>
      <p>
        The same applies to a cover image a host uploads: it stays yours, and you grant us only
        what is needed to show it to the people you invite. Upload one you have the right to
        use.
      </p>
      <p>
        <strong>We will never sell your photos, use them to advertise, publish them, or train
        any model on them.</strong>
      </p>

      <h2>7. When photos become visible</h2>
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
          closes</strong> — until that moment nobody can see a photo. Not the other guests, not
          the host, and not the person who took it. The only thing anyone can see is a roughly
          32-pixel blurred placeholder, which exists so the app can show that people are
          shooting.
        </li>
      </ul>
      <p>
        A host can open a roll early. They cannot close one again — once photos have been seen,
        they have been seen.
      </p>
      <p>
        Separately, the host chooses whether guests see the whole roll or only their own photos.
        The host can always see the whole roll once it is open.
      </p>

      <h2>8. Hosts are responsible for their roll</h2>
      <ul>
        <li>
          You must have the right to invite the people you invite, and to share a QR code that
          gives them access.
        </li>
        <li>
          A QR code is a key. Anyone who can photograph it can join your roll, so put it where
          your guests are and nowhere else.
        </li>
        <li>
          You are responsible for the conduct of your event and for what your guests upload to
          it.
        </li>
        <li>Ask before publishing someone else&rsquo;s photograph.</li>
      </ul>

      <h2>9. What you may not do</h2>
      <ul>
        <li>Upload anything unlawful, sexually explicit involving minors, or designed to harass.</li>
        <li>Photograph people who have asked you not to.</li>
        <li>
          Attempt to reach photos before they become visible, access a roll you were not invited
          to, or interfere with the service.
        </li>
        <li>Impersonate another guest to take over their name or their remaining shots.</li>
        <li>
          Scrape, crawl, reverse-engineer, or run automated clients against MemoVue, or work
          around any limit we apply.
        </li>
      </ul>
      <p>
        We may remove content or close an account that breaks these rules, usually without
        notice where there is a risk to someone.
      </p>

      <h2>10. Our own material, and your suggestions</h2>
      <p>
        The MemoVue name, mark, interface and software are ours and stay ours. Nothing here
        gives you a licence to them beyond using the service as intended.
      </p>
      <p>
        If you send us an idea or a suggestion, we may act on it without owing you anything and
        without obligation to keep it confidential. You keep whatever rights you already had in
        it.
      </p>

      <h2>11. Third-party services</h2>
      <p>
        MemoVue runs on Cloudflare, Railway, Google and Resend, each under its own terms. We are
        not responsible for their acts or outages, though we chose them and we will tell you if
        one of them affects your roll.
      </p>

      <h2>12. Copyright complaints</h2>
      <p>
        If you believe something on MemoVue infringes your copyright, email{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a> with: your contact details, an
        identification of the work, the roll and photo concerned, a statement that you believe
        in good faith the use is not authorised, and a statement that the information you have
        given is accurate. We remove infringing material and close the accounts of repeat
        infringers.
      </p>

      <h2>13. How long we keep photos</h2>
      <p>
        A roll and everything in it is kept for{" "}
        <strong>30 days after the roll closes</strong>, then deleted. The exact date is shown on
        the roll and on every guest&rsquo;s album screen, and we email the host{" "}
        <strong>7 days</strong> before it arrives so there is time to download everything.
      </p>
      <p>
        <strong>Download the photos you want to keep.</strong> MemoVue is a way to collect them,
        not a place to store them, and we do not offer a backup service.
      </p>
      <p>
        A host can delete a roll or their whole account at any time, which removes the photos
        from our database and our storage permanently, for every guest. Backups cycle out within
        30 days.
      </p>

      <h2>14. Deleting your own photos</h2>
      <p>
        Guests can ask us to remove photos they took by emailing{" "}
        <a href="mailto:hello@memovue.com">hello@memovue.com</a> from a contactable address with
        the roll name and the name they joined under. We will remove them, and they will
        disappear for everyone in that roll.
      </p>

      <h2>15. Disclaimers</h2>
      <p>
        MemoVue is provided <strong>as is</strong> and <strong>as available</strong>. To the
        fullest extent the law allows, we disclaim all warranties, express or implied, including
        merchantability, fitness for a particular purpose and non-infringement. We do not
        warrant that the service will be uninterrupted, error-free, or that no photograph will
        ever be lost.
      </p>

      <h2>16. Liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for lost photos, missed moments,
        or any indirect, incidental or consequential loss. Our total liability to you is limited
        to what you have actually paid us in the six months before the claim — which, while
        MemoVue is free, is nothing. Nothing here limits liability that cannot legally be
        limited, including for death, personal injury, or fraud.
      </p>

      <h2>17. Indemnity</h2>
      <p>
        You will defend and indemnify MemoVue against claims arising from what you upload, how
        you use the service, or your breach of these terms — including a claim brought by
        someone who appears in a photograph you took or published.
      </p>

      <h2>18. Termination</h2>
      <p>
        You may stop using MemoVue and delete your account at any time. We may suspend or close
        an account that breaks these terms. Sections 6, 10 and 15 to 21 survive termination.
      </p>

      <h2>19. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Before filing anything, email us and give
        us <strong>30 days</strong> to sort it out — most things end there. If that fails, the
        courts of <strong>Bengaluru, Karnataka</strong> have exclusive jurisdiction. Nothing
        here removes a consumer protection you have where you live.
      </p>

      <h2>20. Changes, and everything else</h2>
      <p>
        We may update these terms. If a change materially affects you we will tell hosts by
        email, and continuing to use MemoVue after it takes effect means you accept it.
      </p>
      <p>
        If any part of these terms is unenforceable, the rest stands. We may assign these terms
        as part of a merger or sale of the business; you may not assign them without our
        consent. This English version controls.
      </p>

      <h2>21. Contact</h2>
      <p>
        <a href="mailto:hello@memovue.com">hello@memovue.com</a>. We aim to reply within 48
        hours.
      </p>
    </>
  );
}

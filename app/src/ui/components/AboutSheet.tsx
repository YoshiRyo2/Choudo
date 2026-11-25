import { Sheet } from './Sheet';
import './AboutSheet.css';

/** What Choudo is, that the user's data stays on this device, and what is counted. */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About Choudo" onClose={onClose}>
      <div className="about">
        <p>
          Choudo shows how each size of a shirt or pair of pants would fit you before you buy. Enter your height
          and weight, and it compares each size’s real measurements, from the brand’s size chart, with yours, zone
          by zone, in centimetres.
        </p>
        <h3>Your data stays on this device</h3>
        <p>
          There’s no account and none of it is uploaded: your body, likes, folders and outfits are saved in this
          browser only. Clearing the site’s data removes them.
        </p>
        <p>
          We count anonymous visits, and which screens are opened, with GoatCounter. No cookies, and never your
          measurements, sizes or the clothes you pick.
        </p>
        <p className="about__disclosure">Affiliate disclosure: to come.</p>
      </div>
    </Sheet>
  );
}

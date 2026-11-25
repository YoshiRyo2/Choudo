import { Sheet } from './Sheet';
import './AboutSheet.css';

/** What Choudo is, and that the user's data stays on this device. */
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
          There’s no account and nothing is uploaded: your body, likes, folders and outfits are saved in this browser
          only. Clearing the site’s data removes them.
        </p>
        <p>
          <a href="privacy.html">Privacy policy</a>
        </p>
        <p className="about__disclosure">Affiliate disclosure: to come.</p>
      </div>
    </Sheet>
  );
}

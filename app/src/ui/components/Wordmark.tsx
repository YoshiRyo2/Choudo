/** The Choudo logo lockup: the app icon next to the name. The icon is decorative; the name is the text. */
export function Wordmark() {
  return (
    <p className="wordmark">
      <img className="wordmark__icon" src={`${import.meta.env.BASE_URL}icon-192.png`} width={28} height={28} alt="" />
      Choudo
    </p>
  );
}

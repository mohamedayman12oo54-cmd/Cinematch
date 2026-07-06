/**
 * Deliberately minimal auth background: solid dark base, two soft breathing
 * glows, a hint of grain. No photography — just clean, calm atmosphere.
 */
export default function AuthBackground() {
  return (
    <>
      <div className="ab-base" />
      <div className="ab-glow ab-glow--one" />
      <div className="ab-glow ab-glow--two" />
      <div className="ab-grain" />
    </>
  );
}

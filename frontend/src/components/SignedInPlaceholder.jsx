export default function SignedInPlaceholder({ name, onLogout }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="nf-signedin">
      <div className="nf-signedin__avatar">{initial}</div>
      <h2 className="nf-signedin__title">You're signed in</h2>
      <p className="nf-signedin__subtitle">
        Hook this screen up to your real dashboard / home route once it's ready.
      </p>
      <button type="button" className="nf-link" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

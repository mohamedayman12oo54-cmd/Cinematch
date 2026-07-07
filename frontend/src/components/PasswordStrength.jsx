function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export default function PasswordStrength({ password }) {
  const score = scorePassword(password);
  if (!password) return null;

  return (
    <div className="nf-strength">
      <div className="nf-strength__bars">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className={`nf-strength__bar ${i < score ? `nf-strength__bar--${score}` : ''}`} />
        ))}
      </div>
      <span className="nf-strength__label">{LABELS[score]}</span>
    </div>
  );
}

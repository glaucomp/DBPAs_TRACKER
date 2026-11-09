export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  const styles = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700',
    secondary: 'border border-line bg-white text-ink hover:bg-paper',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    ghost: 'text-ink hover:bg-white',
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export const controlClass = 'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal text-ink outline-none transition placeholder:text-muted/70 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/15';

export function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export function Alert({ tone = 'error', children }) {
  const styles = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-sky-100 bg-sky-100 text-navy-800';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <h2 className="font-display text-xl text-navy-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

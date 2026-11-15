// FaZe HQ UI kit. SHARED (Joe owns the design). Restyle in ui.css; keep these props stable so pages don't break.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'default' | 'primary' | 'ghost';
interface BtnBase { variant?: Variant; size?: 'md' | 'sm'; arrow?: boolean; children: ReactNode }

/** Notched button. Pass `href` to render a link. */
export function Button(props: BtnBase & ((ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }) | (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }))) {
  const { variant = 'default', size = 'md', arrow, children, className, ...rest } = props;
  const cls = cx('ui-btn', variant !== 'default' && `ui-btn--${variant}`, size === 'sm' && 'ui-btn--sm', className);
  const inner = (
    <>
      {children}
      {arrow && <span className="ui-btn__arrow" aria-hidden>→</span>}
    </>
  );
  if ('href' in rest && rest.href !== undefined) return <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>;
  return <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{inner}</button>;
}

/** Bracketed card. Pass `href` to make the whole card a link. */
export function Card({ href, dark, className, children }: { href?: string; dark?: boolean; className?: string; children: ReactNode }) {
  const cls = cx('ui-card', dark && 'ui-card--dark', className);
  return href ? <a className={cls} href={href}>{children}</a> : <div className={cls}>{children}</div>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="ui-kicker">{children}</p>;
}

/** Page title block: kicker, big condensed heading, optional lede and actions. */
export function PageHeader({ kicker, title, lede, actions }: { kicker?: ReactNode; title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ui-header">
      <div className="ui-header__text">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1 className="ui-display ui-h1">{title}</h1>
        {lede && <p className="ui-lede">{lede}</p>}
      </div>
      {actions && <div className="ui-header__actions">{actions}</div>}
    </header>
  );
}

export function Badge({ tone, live, children }: { tone?: 'red' | 'ink'; live?: boolean; children: ReactNode }) {
  return <span className={cx('ui-badge', tone && `ui-badge--${tone}`, live && 'ui-badge--live')}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-empty">
      <h2 className="ui-empty__title">{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="ui-loading" role="status">
      <span className="ui-loading__bar" aria-hidden />
      {label}…
    </div>
  );
}

/** Page wrapper with the standard max width + gutters. */
export function Page({ narrow, children }: { narrow?: boolean; children: ReactNode }) {
  return <main className={cx('ui-page', narrow && 'ui-page--narrow')}>{children}</main>;
}

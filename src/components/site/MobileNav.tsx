import {MenuIcon} from 'lucide-react';
import {useState} from 'react';

import {Button} from '@/components/ui/button';
import {Separator} from '@/components/ui/separator';
import {Spinner} from '@/components/ui/spinner';
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger} from '@/components/ui/sheet';
import {cn} from '@/lib/utils';
import type {NavItem} from '../../content/site';
import {logout} from '../../platform/browser';

/**
 * The header's menu on small screens: a side sheet with every page, and the
 * community's own pages (log in, join, the community) as plain links: they
 * are the App's, never client routes.
 */

interface Props {
  items: NavItem[];
  current: string;
  /** The page to come back to after signing in (a PATH, URL-encoded). */
  back: string;
  brand: string;
}

export default function MobileNav({items, current, back, brand}: Props) {
  const [open, setOpen] = useState(false);
  // The static pages learn the visitor after load (`data-viewer` on <body>).
  const [viewer, setViewer] = useState('guest');
  // The editor Preview's stand-in member has no session to sign out of (its header shows a chip).
  const [preview, setPreview] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const active = (href: string) => (href === '/' ? current === '/' : current.startsWith(href));

  return (
    <Sheet
      open={open}
      onOpenChange={next => {
        if (next) {
          setViewer(document.body.dataset.viewer ?? 'guest');
          setPreview(Boolean(document.querySelector('[data-session] .chip')));
        }
        setOpen(next);
      }}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open the menu" className="md:hidden">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,85vw)]">
        <SheetHeader className="pb-0">
          <SheetTitle className="font-heading text-xl normal-case tracking-normal">{brand}</SheetTitle>
          <SheetDescription>OkayDokey, every Sunday.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile" className="flex flex-col px-8">
          {items.map(item => (
            <a
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? 'page' : undefined}
              className={cn(
                'border-b py-3 font-heading text-lg',
                active(item.href) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 p-8">
          <Separator />
          {viewer === 'member' ? (
            <>
              <Button asChild variant="outline">
                <a href="/feeds">Open the community</a>
              </Button>
              <Button asChild variant="ghost">
                <a href="/portal">Dashboard</a>
              </Button>
              {!preview && (
                <Button
                  variant="ghost"
                  disabled={signingOut}
                  aria-busy={signingOut || undefined}
                  onClick={() => {
                    setSigningOut(true);
                    void logout();
                  }}>
                  {signingOut && <Spinner data-icon="inline-start" aria-hidden="true" />}
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Button>
              )}
            </>
          ) : viewer === 'applicant' ? (
            <Button asChild>
              <a href="/join">Finish joining</a>
            </Button>
          ) : (
            <>
              <Button asChild>
                <a href="/subscribe">Subscribe</a>
              </Button>
              <Button asChild variant="outline">
                <a href="/join">Join the community</a>
              </Button>
              <Button asChild variant="ghost">
                <a href={`/login?redirectTo=${back}`}>Log in</a>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

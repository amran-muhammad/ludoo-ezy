// Site content for the Ludo game.

export interface NavItem {
  label: string;
  href: string;
}

export const NAV: NavItem[] = [
  {label: 'Play', href: '/'},
  {label: 'How to play', href: '/#how-to-play'},
];

export const SITE = {
  name: 'Ludo',
  tagline: 'Classic board game. Play with friends or bots.',
  description: 'Play Ludo online — share a link with up to 3 friends or let bots fill in. No account needed.',
} as const;

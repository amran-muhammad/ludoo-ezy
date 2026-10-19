/**
 * The site's own words: navigation and the copy of every page.
 *
 * Edit freely. The community's NAME and LOGO are not here: they come from the
 * platform (`GET /site-api/site`), so a rename in the community dashboard shows
 * up here without a Publish. Use `{name}` in any string below for the
 * community name.
 *
 * Anything marked `PLACEHOLDER` is made up for the first version: replace it
 * with your real numbers, prices and reader quotes before you publish.
 */

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Header and footer navigation. Every href is a page of THIS site; the App's
 * pages (`/login`, `/join`, `/feeds`) are linked separately, as plain links.
 */
export const NAV: NavItem[] = [
  {label: 'Home', href: '/'},
  {label: 'Archive', href: '/archive'},
  {label: 'About', href: '/about'},
  {label: 'Subscribe', href: '/subscribe'},
  {label: 'Contact', href: '/contact'},
];

/** The newsletter itself. */
export const NEWSLETTER = {
  name: 'OkayDokey',
  tagline: 'A weekly newsletter about AI products, for people who actually use them.',
  cadence: 'Every Sunday morning',
  /** PLACEHOLDER: your real reader count. */
  readers: '4,200',
  /** PLACEHOLDER: your real price. Free stays free. */
  paidPrice: '$8',
  paidPeriod: 'a month',
  /** PLACEHOLDER: your real yearly price, or set to null to hide it. */
  paidYearly: '$80 a year (two months free)' as string | null,
};

/** Shown under every sign-up box. */
export const SIGNUP_NOTE = 'One email a week. No spam, no selling your address. Unsubscribe in one click.';

const PHOTO = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

/** Replace these with your own photos (any https image URL works). */
export const PHOTOS = {
  /** A writer's desk: laptop, coffee, notepad. */
  home: {src: PHOTO('photo-1499750310107-5fef28a66643'), alt: 'A wooden desk with a laptop, a mug of coffee and a notepad by the window'},
  /** An open notebook and glasses. */
  about: {src: PHOTO('photo-1517842645767-c639042777db', 1400), alt: 'An open notebook with a fountain pen and reading glasses'},
  /** A fountain pen on lined paper. */
  subscribe: {src: PHOTO('photo-1455390582262-044cdead277a', 1400), alt: 'A fountain pen writing on lined paper'},
};

export const HOME = {
  hero: {
    eyebrow: '{name} presents',
    title: 'The AI products worth your Sunday',
    body: 'Every week I spend real hours with new AI tools — the launches, the updates, the quiet little apps nobody is talking about yet — and write down what is actually useful. One email. Ten minutes. No hype.',
  },
  features: {
    title: 'What you’ll get every Sunday',
    lede: 'Each issue follows the same shape, so you always know where to look.',
    items: [
      {
        title: 'The deep dive',
        body: 'One AI product I used for a full week on real work. What it is good at, where it breaks, and who should pay for it.',
      },
      {
        title: 'The five-minute roundup',
        body: 'The launches, model updates and price changes that matter, each in two sentences, with a link if you want more.',
      },
      {
        title: 'The honest verdict',
        body: 'Try it, skip it or wait. A clear call on every product I cover — including the ones from companies with big ad budgets.',
      },
      {
        title: 'One useful prompt',
        body: 'A prompt or workflow from the week that saved me time, ready to copy into the tool you already use.',
      },
    ],
  },
  /** PLACEHOLDER: these quotes are made up. Replace them with real ones from your readers. */
  quotes: [
    {
      text: 'The only newsletter I read the moment it arrives. It has saved me from paying for at least three tools I didn’t need.',
      author: 'Priya N.',
      role: 'Product designer',
    },
    {
      text: 'Finally someone who actually uses the products before writing about them. The verdicts are blunt and they’re usually right.',
      author: 'Marcus L.',
      role: 'Freelance copywriter',
    },
    {
      text: 'I forward it to my whole team on Monday morning. It’s become our shortlist for what to try next.',
      author: 'Hannah K.',
      role: 'Operations lead',
    },
  ],
  cta: {
    title: 'Your Sunday read starts here',
    body: 'Join {readers} readers who get the week in AI products, tested and explained.',
  },
};

export const ABOUT = {
  title: 'Hi, I write OkayDokey',
  lede: 'A newsletter for people who are curious about AI products — and tired of the noise around them.',
  sections: [
    {
      heading: 'Who I am',
      body: [
        // PLACEHOLDER: your own introduction.
        'I’m a freelance writer and a member of {name}. For years I wrote about software for other people’s blogs; now I spend most of my week trying the AI tools that land in my inbox and writing about the few that deserve your attention.',
        'I’m not an engineer and I don’t work for an AI company. I’m the person in the group chat who gets asked “is this one any good?” — OkayDokey is my long answer.',
      ],
    },
    {
      heading: 'Why I write it',
      body: [
        'Every week brings a hundred launches and a thousand hot takes. Most of them are written before anyone has used the product for more than ten minutes.',
        'I wanted the opposite: slow, first-hand reviews, written in plain language, that tell you whether something will change how you work — or whether you can safely ignore it.',
      ],
    },
    {
      heading: 'How I review',
      body: [
        'I use every product on real work for at least a week before I write about it. I pay for my own subscriptions. When a company sponsors an issue, it says so at the top, and sponsors never see or shape a review.',
      ],
    },
  ],
  principles: [
    {title: 'First-hand, always', body: 'If I haven’t used it, I don’t review it.'},
    {title: 'Plain language', body: 'No jargon you need a glossary for.'},
    {title: 'Sponsors are labelled', body: 'Clearly, at the top, every time.'},
  ],
};

export const SUBSCRIBE = {
  title: 'Choose how you read OkayDokey',
  lede: 'Most readers start free. Go paid when the newsletter starts saving you money — and it usually does.',
  free: {
    name: 'Free',
    price: '$0',
    period: 'forever',
    summary: 'The Sunday issue, in your inbox.',
    items: [
      'The full Sunday issue, every week',
      'The deep dive, roundup and verdicts',
      'One useful prompt per issue',
      'The public archive of past issues',
    ],
  },
  paid: {
    name: 'Paid',
    summary: 'For people who buy, build or recommend AI tools.',
    /** PLACEHOLDER: what your paid tier really includes. */
    items: [
      'Everything in Free',
      'A second issue every Wednesday: the tools I’m testing right now',
      'The full comparison tables behind every verdict',
      'Monthly “ask me anything” thread in the {name} community',
      'Early access to deals and trials I negotiate for readers',
    ],
  },
  faq: [
    {
      q: 'When does the newsletter arrive?',
      a: 'Every Sunday morning, around 8 a.m. in your time zone. Paid readers also get a shorter issue on Wednesdays.',
    },
    {
      q: 'Can I switch from free to paid later?',
      a: 'Yes. Start free, and upgrade whenever you like. Your email address stays the same.',
    },
    {
      q: 'How do I unsubscribe?',
      a: 'Every email has an unsubscribe link at the bottom. One click, no questions.',
    },
    {
      q: 'Do you sell or share my email address?',
      a: 'Never. It is used only to send you OkayDokey.',
    },
  ],
};

export const CONTACT = {
  title: 'Get in touch',
  lede: 'Questions, product tips, corrections or sponsorship — I read every message.',
  notes: [
    {
      title: 'Product tips',
      body: 'Building or using an AI product you think I should try? Tell me what it does and why you love it.',
    },
    {
      title: 'Sponsorship',
      body: 'Sponsored issues are labelled and limited to one a month. Tell me about your product and your timing.',
    },
    {
      title: 'Replies',
      body: 'I answer within three working days. Corrections are fixed in the archive and noted in the next issue.',
    },
  ],
};

/** Fill `{name}` with the community's name and `{readers}` with the reader count. */
export function withName(text: string, name: string): string {
  return text.replaceAll('{name}', name).replaceAll('{readers}', NEWSLETTER.readers);
}

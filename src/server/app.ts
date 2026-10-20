import {Hono} from 'hono';

import type {Abilities} from '../lib/types';
import {config} from '../platform/config';
import {problem, sameOrigin} from '../platform/guards';
import {isPreview} from '../platform/api';
import {ludoRoutes} from './routes/ludo';
import {memberRoutes} from './routes/members';
import {siteRoutes} from './routes/site';
import {uploadRoutes} from './routes/uploads';
import {getViewer, getViewerPermissions} from '../platform/viewer';

/**
 * The Site API: this site's ONLY backend, one Hono app at `/site-api/*`.
 *
 * Everything reads and writes through it: the Astro pages call it IN-PROCESS
 * (`src/server/backend.ts`), the portal calls it from the browser (typed `hc`,
 * `src/portal/api.ts`). Mounted by ONE catch-all page,
 * `src/pages/site-api/[...path].ts`. One Worker serves the pages, this API and
 * the portal: one build, one deploy.
 *
 *   GET  /health        what this site has been given (booleans only)
 *   GET  /me            the visitor + what they may do here
 *   GET  /site          the community's brand                  routes/site.ts
 *   *    /ludo          the Ludo game rooms                    routes/ludo.ts
 *   GET  /members      members directory (Community Key)       routes/members.ts
 *   *    /uploads       a member's files (Site Database)        routes/uploads.ts
 */
export const app = new Hono()
  .basePath('/site-api')
  .use(sameOrigin)

  .get('/health', c =>
    c.json({
      ok: true,
      preview: isPreview(),
      database: Boolean(config.databaseUrl),
      communityKey: Boolean(config.communityKey),
    })
  )

  .get('/me', async c => {
    const [viewer] = await Promise.all([
      getViewer(c.req.raw),
      getViewerPermissions(c.req.raw),
    ]);
    c.header('Cache-Control', 'private, no-store');
    const abilities: Abilities = {};
    return c.json({viewer, abilities});
  })

  .route('/site', siteRoutes)
  .route('/ludo', ludoRoutes)
  .route('/members', memberRoutes)
  .route('/uploads', uploadRoutes)

  .notFound(c => c.json(problem('not_found', 'No such Site API route.'), 404))
  .onError((err, c) => {
    console.error(`site-api ${c.req.method} ${c.req.path}: ${err.message}`);
    return c.json(problem('internal_error', 'Something went wrong.'), 500);
  });

export type AppType = typeof app;

import {createRootRoute, createRoute, createRouter, Outlet, Link, useRouter} from '@tanstack/react-router';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {hc} from 'hono/client';
import type {AppType} from '../server/app';
import type {Abilities, Viewer} from '../lib/types';
import {Button} from './ui';

const _api = hc<AppType>('/');

// ── Shell ─────────────────────────────────────────────────────────────────────

interface ShellProps {
  abilities: Abilities;
  viewer: Viewer;
  preview: boolean;
}

const NAV_GROUPS: {label: string; items: {label: string; to: string}[]}[] = [
  {label: 'Workspace', items: [{label: 'Overview', to: '/portal'}]},
  {label: 'Files', items: [{label: 'Uploads', to: '/portal/uploads'}]},
];

function Shell({abilities: _a, viewer, preview}: ShellProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useMutation({
    mutationFn: async () => {
      const {logout: lo} = await import('../platform/browser');
      await lo();
    },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r flex flex-col">
        <div className="h-14 flex items-center px-4 border-b">
          <a href="/" className="font-semibold text-sm">← Website</a>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-4">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">{group.label}</p>
              {group.items.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block rounded px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors [&.active]:text-foreground [&.active]:bg-muted [&.active]:font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1" />
          {preview && <span className="chip">Preview</span>}
          <span className="text-sm text-muted-foreground">{viewer.name ?? 'Member'}</span>
          <Button
            size="sm"
            variant="ghost"
            pending={logout.isPending}
            pendingLabel="Signing out…"
            onClick={() => logout.mutate()}
          >
            Sign out
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview() {
  return (
    <div className="flex flex-col gap-6">
      <div className="app-page-head">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your site dashboard.</p>
        </div>
      </div>
      <div className="app-card p-6 text-sm text-muted-foreground">
        Use the sidebar to manage uploads and other site content.
      </div>
    </div>
  );
}

// ── Uploads ───────────────────────────────────────────────────────────────────

function Uploads() {
  return (
    <div className="flex flex-col gap-6">
      <div className="app-page-head">
        <div>
          <h2 className="text-xl font-semibold">Uploads</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Files uploaded by members.</p>
        </div>
      </div>
      <div className="app-card p-6 text-sm text-muted-foreground">
        Upload management coming soon.
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({component: Outlet});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: () => {
    const ctx = shellRoute.useRouteContext() as unknown as {abilities: Abilities; viewer: Viewer; preview: boolean};
    return <Shell abilities={ctx.abilities} viewer={ctx.viewer} preview={ctx.preview} />;
  },
});

const overviewRoute = createRoute({getParentRoute: () => shellRoute, path: '/portal', component: Overview});
const uploadsRoute = createRoute({getParentRoute: () => shellRoute, path: '/portal/uploads', component: Uploads});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([overviewRoute, uploadsRoute]),
]);

export const router = createRouter({routeTree, basepath: '/portal', context: {} as any});

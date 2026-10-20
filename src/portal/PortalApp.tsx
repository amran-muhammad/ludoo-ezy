import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RouterProvider} from '@tanstack/react-router';

import {router} from './routes';

const queryClient = new QueryClient({defaultOptions: {queries: {retry: 1}}});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function PortalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

import { RouterProvider } from 'react-router';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { router } from './routes';
import { jobsRouter } from '../jobs-portal/routes';
import { eventsRouter } from '../events-portal/routes';
import { splitsubsRouter } from '../splitsubs-portal/routes';
import { ConfigProvider } from './context/ConfigContext';
import { ToastProvider } from './components/Toast';

// Support production subdomain matching AND local dev testing via ?mode=jobs or ?subdomain=jobs query param or jobs.localhost host
const getIsJobsSubdomain = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);

  return (
    hostname.startsWith('jobs.') ||
    hostname.includes('jobs.cortdevs.com') ||
    searchParams.get('mode') === 'jobs' ||
    searchParams.get('subdomain') === 'jobs'
  );
};

// Same pattern as getIsJobsSubdomain(), for events.cortdevs.com
const getIsEventsSubdomain = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);

  return (
    hostname.startsWith('events.') ||
    hostname.includes('events.cortdevs.com') ||
    searchParams.get('mode') === 'events' ||
    searchParams.get('subdomain') === 'events'
  );
};

// Same pattern again, for splitsubs.cortdevs.com
const getIsSplitsubsSubdomain = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const searchParams = new URLSearchParams(window.location.search);

  return (
    hostname.startsWith('splitsubs.') ||
    hostname.includes('splitsubs.cortdevs.com') ||
    searchParams.get('mode') === 'splitsubs' ||
    searchParams.get('subdomain') === 'splitsubs'
  );
};

export default function App() {
  const isJobs = getIsJobsSubdomain();
  const isEvents = getIsEventsSubdomain();
  const isSplitsubs = getIsSplitsubsSubdomain();

  const activeRouter = isJobs ? jobsRouter : isEvents ? eventsRouter : isSplitsubs ? splitsubsRouter : router;

  return (
    <ConfigProvider>
      <ToastProvider>
        <RouterProvider router={activeRouter} />
        <Analytics />
        <SpeedInsights />
      </ToastProvider>
    </ConfigProvider>
  );
}

import { RouterProvider } from 'react-router';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { router } from './routes';
import { jobsRouter } from '../jobs-portal/routes';
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

export default function App() {
  const isJobs = getIsJobsSubdomain();

  return (
    <ConfigProvider>
      <ToastProvider>
        <RouterProvider router={isJobs ? jobsRouter : router} />
        <Analytics />
        <SpeedInsights />
      </ToastProvider>
    </ConfigProvider>
  );
}

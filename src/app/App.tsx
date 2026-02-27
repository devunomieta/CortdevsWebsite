import { RouterProvider } from 'react-router';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { router } from './routes';
import { ConfigProvider } from './context/ConfigContext';

export default function App() {
  return (
    <ConfigProvider>
      <RouterProvider router={router} />
      <SpeedInsights />
    </ConfigProvider>
  );
}

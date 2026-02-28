import { RouterProvider } from 'react-router';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { router } from './routes';
import { ConfigProvider } from './context/ConfigContext';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ConfigProvider>
      <ToastProvider>
        <RouterProvider router={router} />
        <SpeedInsights />
      </ToastProvider>
    </ConfigProvider>
  );
}

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { LearnRoot, LazyAdminRoute } from './components/LearnRoot';
import { LearnLayout } from './components/LearnLayout';
import { LearnLogin } from './pages/Login';
import { RoadmapDashboard } from './pages/RoadmapDashboard';
import { LessonPlayer } from './pages/LessonPlayer';
import { LearnSettings } from './pages/Settings';
import { LearnCertificate } from './pages/Certificate';
import { VerifyCertificate } from './pages/VerifyCertificate';

export const learnRouter = createBrowserRouter([
    {
        element: <LearnRoot />,
        children: [
            { path: '/login', element: <LearnLogin /> },
            { path: '/signup', element: <Navigate to="/login" replace /> },
            // Public credential verification page (no login required)
            { path: '/verify/:code', element: <VerifyCertificate /> },
            {
                path: '/',
                element: <LearnLayout />,
                children: [
                    { index: true, element: <Navigate to="/dashboard" replace /> },
                    { path: 'dashboard', element: <RoadmapDashboard /> },
                    { path: 'lesson/:lessonId', element: <LessonPlayer /> },
                    { path: 'certificate', element: <LearnCertificate /> },
                    { path: 'settings', element: <LearnSettings /> },
                    { path: 'admin', element: <LazyAdminRoute /> },
                ],
            },
            { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
    },
]);

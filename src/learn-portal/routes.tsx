import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { LearnRoot, LazyAdminRoute } from './components/LearnRoot';
import { LearnLayout } from './components/LearnLayout';
import { LearnLogin } from './pages/Login';
import { RoadmapDashboard } from './pages/RoadmapDashboard';
import { LessonPlayer } from './pages/LessonPlayer';
import { LearnSettings } from './pages/Settings';

export const learnRouter = createBrowserRouter([
    {
        element: <LearnRoot />,
        children: [
            { path: '/login', element: <LearnLogin /> },
            { path: '/signup', element: <Navigate to="/login" replace /> },
            {
                path: '/',
                element: <LearnLayout />,
                children: [
                    { index: true, element: <Navigate to="/dashboard" replace /> },
                    { path: 'dashboard', element: <RoadmapDashboard /> },
                    { path: 'lesson/:lessonId', element: <LessonPlayer /> },
                    { path: 'settings', element: <LearnSettings /> },
                    { path: 'admin', element: <LazyAdminRoute /> },
                ],
            },
            { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
    },
]);

import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { LearnAuthProvider } from './context/LearnAuthContext';
import { LearnLayout } from './components/LearnLayout';
import { LearnLogin } from './pages/Login';
import { LearnSignup } from './pages/Signup';
import { RoadmapDashboard } from './pages/RoadmapDashboard';
import { LessonPlayer } from './pages/LessonPlayer';
import { LearnSettings } from './pages/Settings';
import { LearnAdminDashboard } from './admin/AdminDashboard';

function LearnRoot() {
    return (
        <LearnAuthProvider>
            <Outlet />
        </LearnAuthProvider>
    );
}

export const learnRouter = createBrowserRouter([
    {
        element: <LearnRoot />,
        children: [
            { path: '/login', element: <LearnLogin /> },
            { path: '/signup', element: <LearnSignup /> },
            {
                path: '/',
                element: <LearnLayout />,
                children: [
                    { index: true, element: <Navigate to="/dashboard" replace /> },
                    { path: 'dashboard', element: <RoadmapDashboard /> },
                    { path: 'lesson/:lessonId', element: <LessonPlayer /> },
                    { path: 'settings', element: <LearnSettings /> },
                    { path: 'admin', element: <LearnAdminDashboard /> },
                ],
            },
            { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
    },
]);

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { JobsHome } from './pages/JobsHome';
import { JobDetail } from './pages/JobDetail';
import { ApplySuccess } from './pages/ApplySuccess';
import { JobsAdminLogin } from './admin/JobsAdminLogin';
import { JobsAdminLayout } from './admin/JobsAdminLayout';
import { JobsAdminDashboard } from './admin/JobsAdminDashboard';
import { JobsAdminVacancies } from './admin/JobsAdminVacancies';
import { JobsAdminCandidates } from './admin/JobsAdminCandidates';

export const jobsRouter = createBrowserRouter([
    {
        path: '/',
        element: <JobsHome />
    },
    {
        path: '/job/:jobId',
        element: <JobDetail />
    },
    {
        path: '/apply/success',
        element: <ApplySuccess />
    },
    {
        path: '/admin/login',
        element: <JobsAdminLogin />
    },
    {
        path: '/admin',
        element: <JobsAdminLayout />,
        children: [
            {
                index: true,
                element: <JobsAdminDashboard />
            },
            {
                path: 'vacancies',
                element: <JobsAdminVacancies />
            },
            {
                path: 'candidates',
                element: <JobsAdminCandidates />
            }
        ]
    },
    {
        path: '*',
        element: <Navigate to="/" replace />
    }
]);

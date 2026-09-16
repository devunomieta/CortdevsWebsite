import { createBrowserRouter, Navigate } from "react-router";
import { PortalLayout } from "./components/PortalLayout";
import { EventsHome } from "./pages/Home";
import { EventsAbout } from "./pages/About";
import { EventsContact } from "./pages/Contact";
import { DashboardLogin } from "./dashboard/DashboardLogin";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardHome } from "./dashboard/DashboardHome";
import { EventsAdminLogin } from "./admin/AdminLogin";
import { EventsAdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminEventDetail } from "./admin/AdminEventDetail";
import { AdminNotifications } from "./admin/AdminNotifications";

export const eventsRouter = createBrowserRouter([
    {
        path: "/",
        element: <PortalLayout />,
        children: [
            { index: true, element: <EventsHome /> },
            { path: "about", element: <EventsAbout /> },
            { path: "contact", element: <EventsContact /> },
        ],
    },
    { path: "/e/:slug", element: <DashboardLogin /> },
    {
        path: "/e/:slug/dashboard",
        element: <DashboardLayout />,
        children: [{ index: true, element: <DashboardHome /> }],
    },
    { path: "/admin/login", element: <EventsAdminLogin /> },
    {
        path: "/admin",
        element: <EventsAdminLayout />,
        children: [
            { index: true, element: <AdminOverview /> },
            { path: "events/:eventId", element: <AdminEventDetail /> },
            { path: "notifications", element: <AdminNotifications /> },
        ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
]);

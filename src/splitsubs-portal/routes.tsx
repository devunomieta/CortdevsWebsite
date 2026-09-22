import { createBrowserRouter, Navigate } from "react-router";
import { PortalLayout } from "./components/PortalLayout";
import { SplitSubsHome } from "./pages/Home";
import { ListingDetail } from "./pages/ListingDetail";
import { HowItWorks } from "./pages/HowItWorks";
import { SplitSubsContact } from "./pages/Contact";

import { DashboardLogin } from "./dashboard/DashboardLogin";
import { VerifyOtp } from "./dashboard/VerifyOtp";
import { DashboardLayout } from "./dashboard/DashboardLayout";
import { DashboardOverview } from "./dashboard/DashboardOverview";
import { MySeats } from "./dashboard/MySeats";
import { MyListings } from "./dashboard/MyListings";
import { PayoutSettings } from "./dashboard/PayoutSettings";
import { Support } from "./dashboard/Support";
import { Profile } from "./dashboard/Profile";
import { Transactions } from "./dashboard/Transactions";

import { SplitSubsAdminLogin } from "./admin/AdminLogin";
import { SplitSubsAdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminCatalog } from "./admin/AdminCatalog";
import { AdminListings } from "./admin/AdminListings";
import { AdminHosts } from "./admin/AdminHosts";
import { AdminDisputes } from "./admin/AdminDisputes";
import { AdminSettlements } from "./admin/AdminSettlements";
import { AdminTransactions } from "./admin/AdminTransactions";
import { AdminTickets } from "./admin/AdminTickets";
import { AdminAuditLog } from "./admin/AdminAuditLog";
import { AdminSettings } from "./admin/AdminSettings";
import { AdminServiceRequests } from "./admin/AdminServiceRequests";

export const splitsubsRouter = createBrowserRouter([
    {
        path: "/",
        element: <PortalLayout />,
        children: [
            { index: true, element: <SplitSubsHome /> },
            { path: "listing/:id", element: <ListingDetail /> },
            { path: "how-it-works", element: <HowItWorks /> },
            { path: "contact", element: <SplitSubsContact /> },
        ],
    },
    { path: "/dashboard/login", element: <DashboardLogin /> },
    { path: "/dashboard/verify", element: <VerifyOtp /> },
    {
        path: "/dashboard",
        element: <DashboardLayout />,
        children: [
            { index: true, element: <DashboardOverview /> },
            { path: "seats", element: <MySeats /> },
            { path: "listings", element: <MyListings /> },
            { path: "transactions", element: <Transactions /> },
            { path: "payout", element: <PayoutSettings /> },
            { path: "profile", element: <Profile /> },
            { path: "support", element: <Support /> },
        ],
    },
    { path: "/admin/login", element: <SplitSubsAdminLogin /> },
    {
        path: "/admin",
        element: <SplitSubsAdminLayout />,
        children: [
            { index: true, element: <AdminOverview /> },
            { path: "catalog", element: <AdminCatalog /> },
            { path: "listings", element: <AdminListings /> },
            { path: "hosts", element: <AdminHosts /> },
            { path: "disputes", element: <AdminDisputes /> },
            { path: "transactions", element: <AdminTransactions /> },
            { path: "settlements", element: <AdminSettlements /> },
            { path: "tickets", element: <AdminTickets /> },
            { path: "audit-log", element: <AdminAuditLog /> },
            { path: "settings", element: <AdminSettings /> },
            { path: "service-requests", element: <AdminServiceRequests /> },
        ],
    },
    { path: "*", element: <Navigate to="/" replace /> },
]);

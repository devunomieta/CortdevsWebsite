import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { Services } from "./pages/Services";
import { Work } from "./pages/Work";
import { Contact } from "./pages/Contact";
import { Careers } from "./pages/Careers";
import { JobDetail } from "./pages/JobDetail";
import { Success } from "./pages/Success";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Dashboard } from "./pages/admin/Dashboard";
import { Leads } from "./pages/admin/Leads";
import { AdminCareers } from "./pages/admin/Careers";
import { AdminApplications } from "./pages/admin/Applications";
import { Clients } from "./pages/admin/Clients";
import { Communications as AdminComms } from "./pages/admin/Communications";
import { UserManagement as AdminUsers } from "./pages/admin/UserManagement";
import { Settings as AdminSettings } from "./pages/admin/Settings";
import { Transactions } from "./pages/admin/Transactions";
import { Analytics } from "./pages/admin/Analytics";
import { Notifications } from "./pages/admin/Notifications";
import { PopulateData } from "./pages/admin/PopulateData";
import { Profile as AdminProfile } from "./pages/admin/Profile";
import { ServerErrors as AdminErrors } from "./pages/admin/ServerErrors";
import { AdminLogin } from "./pages/admin/Login";
import { ForgotPassword as AdminForgot } from "./pages/admin/ForgotPassword";
import { ResetPassword as AdminReset } from "./pages/admin/ResetPassword";
import { NotFound } from "./pages/NotFound";
import { Maintenance } from "./pages/Maintenance";
import { ProjectPublic } from "./pages/ProjectPublic";
import { DocsPortal } from "./pages/DocsPortal";
import { AdminIssueManagement } from "./pages/admin/IssueManagement";
import { AdminSubmissions } from "./pages/admin/AdminSubmissions";
import { Navigate } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "portal",
        element: <ProjectPublic />,
      },
      {
        path: "about",
        element: <About />,
      },
      {
        path: "services",
        element: <Services />,
      },
      {
        path: "work",
        element: <Work />,
      },
      {
        path: "contact",
        element: <Contact />,
      },
      {
        path: "knowledge-base",
        element: <DocsPortal />,
      },
      {
        path: "docs",
        element: <Navigate to="/knowledge-base" replace />,
      },
      {
        path: "success",
        element: <Success />,
      },
      {
        path: "privacy",
        element: <Privacy />,
      },
      {
        path: "terms",
        element: <Terms />,
      },
      {
        path: "careers",
        element: <Careers />,
      },
      {
        path: "careers/:jobId",
        element: <JobDetail />,
      },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "leads",
        element: <Leads />,
      },
      {
        path: "careers",
        element: <AdminCareers />,
      },
      {
        path: "applications",
        element: <AdminApplications />,
      },
      {
        path: "clients",
        element: <Clients />,
      },
      {
        path: "comms",
        element: <AdminComms />,
      },
      {
        path: "transactions",
        element: <Transactions />,
      },
      {
        path: "analytics",
        element: <Analytics />,
      },
      {
        path: "notifications",
        element: <Notifications />,
      },
      {
        path: "populate",
        element: <PopulateData />,
      },
      {
        path: "users",
        element: <AdminUsers />,
      },
      {
        path: "profile",
        element: <AdminProfile />,
      },
      {
        path: "settings",
        element: <AdminSettings />,
      },
      {
        path: "errors",
        element: <AdminErrors />,
      },
      {
        path: "issues",
        element: <AdminIssueManagement />,
      },
      {
        path: "submissions",
        element: <AdminSubmissions />,
      },
    ],
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
  },
  {
    path: "/admin/forgot-password",
    element: <AdminForgot />,
  },
  {
    path: "/admin/reset-password",
    element: <AdminReset />,
  },
  {
    path: "/maintenance",
    element: <Maintenance />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

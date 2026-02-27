import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { Services } from "./pages/Services";
import { Work } from "./pages/Work";
import { Contact } from "./pages/Contact";
import { Success } from "./pages/Success";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Dashboard } from "./pages/admin/Dashboard";
import { Leads } from "./pages/admin/Leads";
import { Clients } from "./pages/admin/Clients";
import { Communications as AdminComms } from "./pages/admin/Communications";
import { UserManagement as AdminUsers } from "./pages/admin/UserManagement";
import { Settings as AdminSettings } from "./pages/admin/Settings";
import { Profile as AdminProfile } from "./pages/admin/Profile";
import { AdminLogin } from "./pages/admin/Login";

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
        path: "clients",
        element: <Clients />,
      },
      {
        path: "comms",
        element: <AdminComms />,
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
    ],
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
  },
]);

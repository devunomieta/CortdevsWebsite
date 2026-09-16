import { Outlet } from "react-router";
import { Helmet } from "react-helmet-async";
import { EventsNavbar } from "./EventsNavbar";
import { EventsFooter } from "./EventsFooter";

// Root layout for the public-facing events.cortdevs.com pages (Home/About/Contact).
// Dashboard and admin routes use their own layouts (DashboardLayout / AdminLayout) —
// this one is only for the public information pages.
export function PortalLayout() {
    return (
        <div className="bg-background text-foreground min-h-screen flex flex-col">
            <Helmet>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <EventsNavbar />
            <main className="flex-1 pt-20 lg:pt-24">
                <Outlet />
            </main>
            <EventsFooter />
        </div>
    );
}

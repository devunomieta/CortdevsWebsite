import { Outlet } from "react-router";
import { Helmet } from "react-helmet-async";
import { SplitSubsNavbar } from "./SplitSubsNavbar";
import { SplitSubsFooter } from "./SplitSubsFooter";

// Root layout for the public splitsubs.cortdevs.com pages. Dashboard and
// admin routes use their own layouts.
export function PortalLayout() {
    return (
        <div className="bg-background text-foreground min-h-screen flex flex-col">
            <Helmet>
                <title>SplitSubs — Share the cost of premium subscriptions | CortDevs</title>
                <meta
                    name="description"
                    content="Split the cost of Netflix, Spotify, YouTube Premium and more with escrow-protected, verified subscription sharing."
                />
            </Helmet>
            <SplitSubsNavbar />
            <main className="flex-1 pt-20 lg:pt-24">
                <Outlet />
            </main>
            <SplitSubsFooter />
        </div>
    );
}

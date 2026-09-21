import { Outlet } from "react-router";
import { SplitSubsNavbar } from "./SplitSubsNavbar";
import { SplitSubsFooter } from "./SplitSubsFooter";
import { SEO } from "./SEO";

// Root layout for the public splitsubs.cortdevs.com pages. Dashboard and
// admin routes use their own layouts. Every page under here renders its own
// <SEO> with a specific title/description — this one is only the fallback
// for the (currently nonexistent) page that forgets to.
export function PortalLayout() {
    return (
        <div className="bg-background text-foreground min-h-screen flex flex-col">
            <SEO
                title="SplitSubs — Share the Cost of Premium Subscriptions"
                description="Split Netflix, Spotify, YouTube Premium and more with real people — your money stays safe until access is confirmed working."
                path="/"
            />
            <SplitSubsNavbar />
            <main className="flex-1 pt-20 lg:pt-24">
                <Outlet />
            </main>
            <SplitSubsFooter />
        </div>
    );
}

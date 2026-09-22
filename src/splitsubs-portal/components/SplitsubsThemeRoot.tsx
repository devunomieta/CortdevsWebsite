import { Outlet } from "react-router";

// Scopes the SplitSubs-only color tokens (src/styles/splitsubs-theme.css) to
// exactly this router's DOM — every SplitSubs route, public or authenticated,
// renders inside it — without touching the shared :root tokens the main
// CortDevs site, Events portal, and Jobs portal also depend on.
export function SplitsubsThemeRoot() {
    return (
        <div className="splitsubs-app">
            <Outlet />
        </div>
    );
}

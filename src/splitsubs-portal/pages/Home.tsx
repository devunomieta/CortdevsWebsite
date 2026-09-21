import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Wallet, RefreshCw } from "lucide-react";
import { ssPublicFetch } from "../lib/api";
import { usePaginatedList } from "../lib/usePaginatedList";
import { SearchBar, SortButton, Pagination } from "../components/ListControls";
import { SEO } from "../components/SEO";

interface Listing {
    id: string;
    title: string;
    plan_cost: number;
    total_seats: number;
    openSeats: number;
    pricing: { seatBase: number; serviceCharge: number; totalPaid: number };
    ss_services: { id: string; name: string; category: string; icon_url: string | null };
}

interface Service {
    id: string;
    name: string;
    category: string;
}

const money = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;

export function SplitSubsHome() {
    const [services, setServices] = useState<Service[]>([]);
    const [serviceFilter, setServiceFilter] = useState<string>("");
    const list = usePaginatedList<Listing>("/api/splitsubs/listings", "listings", {
        extraParams: serviceFilter ? { service: serviceFilter } : {},
    });

    useEffect(() => {
        ssPublicFetch("/api/splitsubs/services").then((d) => setServices(d.services || [])).catch(() => { });
    }, []);

    return (
        <div>
            <SEO
                title="Stop Paying Full Price for Netflix, Spotify & More"
                description="Split Netflix, Spotify & more with real people — your money stays safe until access is confirmed. Join a seat or list yours today."
                path="/"
            />

            <section className="py-20 lg:py-28 bg-neutral-50 border-b border-border">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-6">CortDevs · SplitSubs</p>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
                            Stop paying full price. Split it.
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                            Grab a seat on Netflix, Spotify, YouTube Premium & more for less. Your money
                            stays safe with us until your access is confirmed working.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <a href="#listings" className="px-7 py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all">
                                Grab a Seat
                            </a>
                            <Link to="/dashboard/listings?create=1" className="px-7 py-4 border border-border text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-secondary transition-all">
                                List a Seat
                            </Link>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
                        {[
                            { icon: ShieldCheck, title: "Your money dey safe", body: "Held safe until you confirm your access is working." },
                            { icon: Users, title: "No fake hosts here", body: "Every host is bank-verified before their first payout." },
                            { icon: Wallet, title: "No hidden charges", body: "You see the exact price before you ever pay." },
                        ].map((item) => (
                            <div key={item.title} className="bg-card border border-border p-6">
                                <item.icon className="w-6 h-6 mb-3 text-primary" />
                                <h3 className="font-medium text-sm mb-1">{item.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="listings" className="py-20 lg:py-28">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-light tracking-tight">Available seats — dey go fast</h2>
                            <p className="text-sm text-muted-foreground mt-1">Popular plans finish quick. See one you like? Don't sleep on it.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => { setServiceFilter(""); list.setPage(1); }}
                                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${!serviceFilter ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                            >
                                All
                            </button>
                            {services.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => { setServiceFilter(s.id); list.setPage(1); }}
                                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border ${serviceFilter === s.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center mb-10">
                        <SearchBar value={list.searchInput} onChange={list.setSearchInput} placeholder="Search listings..." />
                        <SortButton label="Newest" active={list.sort === "created_at"} order={list.order} onClick={() => { list.setSort("created_at"); list.setOrder(list.sort === "created_at" && list.order === "asc" ? "desc" : "asc"); }} />
                        <SortButton label="Price" active={list.sort === "price"} order={list.order} onClick={() => { list.setSort("price"); list.setOrder(list.sort === "price" && list.order === "asc" ? "desc" : "asc"); }} />
                    </div>

                    {list.isLoading ? (
                        <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>
                    ) : list.items.length === 0 ? (
                        <div className="text-center py-20 border border-dashed border-border">
                            <p className="text-muted-foreground text-sm mb-4">No seats dey available right now — but new ones drop daily. Check back soon.</p>
                            <Link to="/dashboard/listings?create=1" className="inline-block px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                                Be the First to List One
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {list.items.map((listing) => (
                                <Link
                                    key={listing.id}
                                    to={`/listing/${listing.id}`}
                                    className="block border border-border p-6 hover:border-primary transition-colors bg-card group"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{listing.ss_services.category}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${listing.openSeats <= 2 ? "text-rose-500" : "text-primary"}`}>
                                            {listing.openSeats <= 2 ? `Only ${listing.openSeats} left!` : `${listing.openSeats} seats open`}
                                        </span>
                                    </div>
                                    <h3 className="font-medium text-lg mb-1 group-hover:text-primary transition-colors">{listing.ss_services.name}</h3>
                                    <p className="text-xs text-muted-foreground mb-4 truncate">{listing.title}</p>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Per seat, every month</p>
                                            <p className="text-2xl font-light">{money(listing.pricing.totalPaid)}</p>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">of {listing.total_seats} seats total</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                    <div className="mt-10">
                        <Pagination page={list.page} totalPages={list.totalPages} total={list.total} pageSize={list.pageSize} onPage={list.setPage} />
                    </div>
                </div>
            </section>
        </div>
    );
}

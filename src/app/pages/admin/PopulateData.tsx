import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Database, RefreshCw, CheckCircle2 } from "lucide-react";

export function PopulateData() {
    const [status, setStatus] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

    const runSeed = async () => {
        setIsLoading(true);
        setStatus("Starting sequence...");
        try {
            // 1. Leads
            setStatus("Inserting leads...");
            const { error: leadsError } = await supabase.from('leads').insert([
                { name: 'John Doe', email: 'john@bigtech.com', phone: '+1234567890', service: 'Web Development', budget: '$5000 - $20000', status: 'New', details: 'Need a high-performance e-commerce site.' },
                { name: 'Jane Smith', email: 'jane@startup.io', phone: '+1987654321', service: 'UI/UX Design', budget: '$1000 - $5000', status: 'In Progress', details: 'Revamping our mobile app interface.' },
                { name: 'Alice Johnson', email: 'alice@edu.org', phone: '+1122334455', service: 'Mobile App', budget: 'Above $20000', status: 'Converted', details: 'Educational platform for remote learning.' },
                { name: 'Bob Williams', email: 'bob@builder.com', phone: '+1555666777', service: 'Consultation', budget: 'Under $1000', status: 'New', details: 'Strategic advice for local business growth.' },
                { name: 'Charlie Brown', email: 'charlie@peanuts.com', phone: '+1444333222', service: 'Web Development', budget: '$5000 - $20000', status: 'New', details: 'Portfolio site for creative agency.' },
                { name: 'David Miller', email: 'david@fintech.net', phone: '+1777888999', service: 'SEO & Marketing', budget: '$1000 - $5000', status: 'In Progress', details: 'Optimizing our SaaS landing pages.' },
                { name: 'Eve Adams', email: 'eve@fashion.fr', phone: '+33123456789', service: 'UI/UX Design', budget: '$5000 - $20000', status: 'New', details: 'High-end fashion brand redesign.' },
                { name: 'Frank Wright', email: 'frank@arch.com', phone: '+1222333444', service: 'Web Development', budget: 'Above $20000', status: 'New', details: 'Architectural firm digital presence.' },
                { name: 'Grace Hopper', email: 'grace@code.dev', phone: '+1666777888', service: 'Mobile App', budget: '$5000 - $20000', status: 'New', details: 'Inventory management system.' },
                { name: 'Hank Pym', email: 'hank@pymtech.com', phone: '+1999000111', service: 'Consultation', budget: 'Under $1000', status: 'In Progress', details: 'Quantum computing UI consultation.' }
            ]);
            if (leadsError) throw leadsError;

            // 2. Clients
            setStatus("Establishing client records...");
            const { data: clientData, error: clientsError } = await supabase.from('clients').insert([
                { full_name: 'Sarah Connor', company: 'Cyberdyne Systems', project_name: 'T-800 Interface', total_value: '$15000', paid_amount: '$10000', status: 'In Progress' },
                { full_name: 'Tony Stark', company: 'Stark Industries', project_name: 'Arc Reactor Dashboard', total_value: '$50000', paid_amount: '$50000', status: 'Launched', review: { rating: 5, comment: "Exceptional work, very efficient.", isPublic: true } },
                { full_name: 'Bruce Wayne', company: 'Wayne Enterprises', project_name: 'Batcave Monitoring', total_value: '$25000', paid_amount: '$5000', status: 'In Progress' },
                { full_name: 'Peter Parker', company: 'Daily Bugle', project_name: 'Photo Submission Portal', total_value: '$2000', paid_amount: '$2000', status: 'Completed', review: { rating: 4, comment: "Good job, but could be faster.", isPublic: true } },
                { full_name: 'Clark Kent', company: 'Planet Labs', project_name: 'Global News Feed', total_value: '$8000', paid_amount: '$4000', status: 'In Progress' },
                { full_name: 'Diana Prince', company: 'Themyscira Arts', project_name: 'Ancient Artifacts CRM', total_value: '$12000', paid_amount: '$12000', status: 'Launched', review: { rating: 5, comment: "Truly timeless design.", isPublic: true } },
                { full_name: 'Barry Allen', company: 'Central City PD', project_name: 'Evidence Log System', total_value: '$5000', paid_amount: '$1000', status: 'In Progress' },
                { full_name: 'Arthur Curry', company: 'Atlantis Aquatics', project_name: 'Ocean Depth Analytics', total_value: '$18000', paid_amount: '$18000', status: 'Completed', review: { rating: 3, comment: "Communication was a bit slow.", isPublic: true } },
                { full_name: 'Wanda Maximoff', company: 'Westview Magic', project_name: 'Reality Warp UI', total_value: '$30000', paid_amount: '$15000', status: 'In Progress' },
                { full_name: 'Stephen Strange', company: 'Sanctum Digital', project_name: 'Mystic Arts Portal', total_value: '$45000', paid_amount: '$45000', status: 'Launched', review: { rating: 5, comment: "The UX is almost magical.", isPublic: true } }
            ]).select();
            if (clientsError) throw clientsError;

            // 3. Transactions
            setStatus("Injecting financial history...");
            if (clientData) {
                for (const client of clientData) {
                    const amountStr = client.paid_amount.replace(/[^0-9.]/g, '');
                    const amount = parseFloat(amountStr) || 0;
                    if (amount > 0) {
                        await supabase.from('transactions').insert([{
                            client_id: client.id,
                            type: 'Income',
                            amount: amount,
                            description: `Payment for ${client.project_name}`,
                            category: 'Web Development',
                            status: 'Completed'
                        }]);
                    }
                }
            }

            // 4. Expenses
            await supabase.from('transactions').insert([
                { type: 'Expense', amount: 500, description: 'Server Hosting', category: 'Infrastructure', status: 'Completed' },
                { type: 'Expense', amount: 1200, description: 'External Designer', category: 'Labor', status: 'Completed' },
                { type: 'Expense', amount: 300, description: 'Software Licenses', category: 'Tools', status: 'Completed' }
            ]);

            setStatus("All systems populated successfully.");
        } catch (err: any) {
            setStatus(`Critical Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[70vh] flex flex-col items-center justify-center p-8 bg-white border border-neutral-200 gap-8">
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                <Database size={48} className="text-neutral-200" />
                <h2 className="text-2xl font-light italic">Data Injection Protocol</h2>
                <p className="text-sm text-neutral-500">This utility will populate your Supabase instance with 10 leads, 10 clients, and matching transactions for testing purposes.</p>
            </div>

            <div className="flex flex-col items-center gap-4">
                <button
                    onClick={runSeed}
                    disabled={isLoading}
                    className="bg-black text-white px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                    {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Database size={14} />}
                    Initialize Ecosystem
                </button>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2"
                    >
                        {status === "All systems populated successfully." ? <CheckCircle2 size={12} className="text-green-500" /> : <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />}
                        {status}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

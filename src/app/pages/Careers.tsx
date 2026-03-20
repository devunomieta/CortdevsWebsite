import { motion } from "framer-motion";
import { ArrowRight, MapPin, Briefcase, RefreshCw, Clock } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { jobs as staticJobs, Job } from "../data/jobs";
import { SEO } from "../components/SEO";
import { supabase } from "../../lib/supabase";
import { DeadlineCountdown } from "../components/DeadlineCountdown";

export function Careers() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('careers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Supabase Career Fetch Error:", error);
          // provide more detailed info for debugging
          if (error.code === '42P01') console.error("Table 'careers' not found. Check schema.");
          if (error.message.includes('policy')) console.error("RLS Policy violation. Check 'fix_visibility.sql'.");
          setJobs([]);
          return;
        }

        if (data) {
          const normalizedData = data.map(j => ({
            ...j,
            applyUrl: j.apply_url || j.applyUrl
          }));

          // Sort: Open first, then by date
          const sortedData = [...normalizedData].sort((a, b) => {
            if (a.status === 'open' && b.status !== 'open') return -1;
            if (a.status !== 'open' && b.status === 'open') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          setJobs(sortedData as Job[]);
        }
      } catch (err) {
        console.error("Critical error fetching jobs:", err);
        setJobs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerChildren = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <SEO
        title="Careers | Join Our Team"
        description="Explore career opportunities at CortDevs. Join our mission to deliver 'Quality Above All' in web development."
      />

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div {...fadeInUp}>
            <div className="inline-block px-4 py-2 bg-primary text-primary-foreground text-[10px] tracking-[0.3em] mb-8 uppercase font-bold">
              Careers at CortDevs
            </div>
            <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-8 leading-[1.1]">
              Join the pursuit of
              <span className="block italic">digital perfection.</span>
            </h1>
            <p className="text-lg lg:text-xl text-neutral-600 max-w-2xl leading-relaxed">
              We are a team of precision engineers and growth specialists dedicated to crafting
              exceptional digital experiences. Join us in building the future of the web.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Jobs Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
            <div>
              <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">Open Positions</h2>
              <p className="text-muted-foreground">Find your next challenge in our remote-first team.</p>
            </div>
          </div>

          <motion.div
            variants={staggerChildren}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 gap-6"
          >
            {isLoading ? (
              <div className="py-32 flex flex-col items-center justify-center border border-border bg-secondary/30 backdrop-blur-sm">
                <RefreshCw className="w-10 h-10 text-muted-foreground/20 animate-spin mb-6" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Synchronizing Opportunities</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-32 text-center border border-border border-dashed bg-background">
                <Briefcase className="w-16 h-16 text-muted-foreground/10 mx-auto mb-6" />
                <p className="text-xl font-light italic text-muted-foreground/40">No open positions at the moment.</p>
                <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20">Check back for the next wave</div>
              </div>
            ) : (
              jobs.map((job) => (
                <motion.div
                  key={job.id}
                  variants={fadeInUp}
                  className="group relative border border-border p-6 lg:p-8 hover:border-primary transition-all duration-500 bg-card hover:bg-secondary/20"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-4 mb-2">
                        {job.status === 'open' ? (
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
                            Active Opening
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
                            Closed
                          </span>
                        )}
                        <span className="w-1 h-1 bg-border rounded-full" />
                        <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                          <MapPin size={10} className="text-muted-foreground/50" />
                          {job.location}
                        </div>
                        {job.status === 'open' && job.deadline && (
                          <>
                            <span className="w-1 h-1 bg-border rounded-full" />
                            <DeadlineCountdown deadline={job.deadline} minimal />
                          </>
                        )}
                      </div>

                      <div>
                        <h3 className="text-2xl lg:text-3xl font-light tracking-tight mb-1 text-foreground">
                          {job.title.replace(/\\"/g, '"')}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                          {job.compensation}
                        </p>
                      </div>

                      <p className="text-muted-foreground text-sm font-light leading-relaxed max-w-2xl line-clamp-2">
                        {job.about.replace(/\\"/g, '"')}
                      </p>
                    </div>

                    <div className="shrink-0">
                      <Link
                        to={`/careers/${job.slug || job.id}`}
                        className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all duration-300 group/btn"
                      >
                        View Details
                        <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>

          {/* Culture / Values Callout */}
          <div className="mt-32 p-12 lg:p-20 bg-secondary text-foreground relative overflow-hidden">
            <div className="relative z-10 max-w-3xl">
              <h2 className="text-3xl lg:text-5xl font-light tracking-tight mb-8">
                Why CortDevs?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-lg font-medium mb-3 text-muted-foreground">Quality Above All</h4>
                  <p className="text-muted-foreground/80 text-sm leading-relaxed">
                    We don't settle for "good enough". Every line of code and every client interaction
                    must meet our 3 Rounds of Perfection standards.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-medium mb-3 text-muted-foreground">Remote Excellence</h4>
                  <p className="text-muted-foreground/80 text-sm leading-relaxed">
                    Work from anywhere. We value results, autonomy, and clear communication
                    over office presence.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
          </div>
        </div>
      </section>
    </div>
  );
}

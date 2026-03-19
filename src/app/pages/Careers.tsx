import { motion } from "framer-motion";
import { ArrowRight, MapPin, Briefcase, Users, Star, Target, Shield, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { jobs as staticJobs, Job } from "../data/jobs";
import { SEO } from "../components/SEO";
import { supabase } from "../../lib/supabase";

export function Careers() {
  const [jobs, setJobs] = useState<Job[]>(staticJobs);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('careers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data && data.length > 0) {
          // Normalize property naming (DB uses apply_url, static uses applyUrl)
          const normalizedData = data.map(j => ({
            ...j,
            applyUrl: j.apply_url || j.applyUrl
          }));
          setJobs(normalizedData as Job[]);
        }
      } catch (err) {
        console.error("Failed to fetch fresh jobs, using fallback:", err);
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
    <div className="bg-white min-h-screen">
      <SEO 
        title="Careers | Join Our Team" 
        description="Explore career opportunities at CortDevs. Join our mission to deliver 'Quality Above All' in web development." 
      />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 bg-neutral-50 border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div {...fadeInUp}>
            <div className="inline-block px-4 py-2 bg-black text-white text-[10px] tracking-[0.3em] mb-8 uppercase font-bold">
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
              <p className="text-neutral-500">Find your next challenge in our remote-first team.</p>
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
              <div className="py-20 flex flex-col items-center justify-center border border-neutral-100 bg-neutral-50/50">
                <RefreshCw className="w-8 h-8 text-neutral-300 animate-spin mb-4" />
                <p className="text-sm text-neutral-400 italic">Loading opportunities...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-20 text-center border border-neutral-200 border-dashed bg-white">
                <Briefcase className="w-12 h-12 text-neutral-100 mx-auto mb-4" />
                <p className="text-neutral-500 italic">No open positions at the moment. Check back soon!</p>
              </div>
            ) : (
              jobs.map((job) => (
                <motion.div
                  key={job.id}
                  variants={fadeInUp}
                  className="group relative border border-neutral-200 p-8 lg:p-10 hover:border-black transition-all duration-500 bg-white"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        {job.status === 'open' ? (
                          <span className="px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-widest border border-green-100">
                            Active Role
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-widest border border-neutral-200">
                            Closed
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-neutral-400 text-xs">
                          <MapPin size={14} />
                          {job.location}
                        </div>
                      </div>
                      <h3 className="text-2xl lg:text-3xl font-light tracking-tight mb-4 group-hover:pl-2 transition-all duration-300">
                        {job.title}
                      </h3>
                      <p className="text-neutral-500 line-clamp-2 max-w-3xl">
                        {job.about}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/careers/${job.id}`}
                        className="inline-flex items-center justify-center gap-3 px-8 py-4 border border-neutral-200 text-sm tracking-widest uppercase hover:border-black hover:bg-black hover:text-white transition-all duration-300 group/btn whitespace-nowrap"
                      >
                        View Details
                        <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>

          {/* Culture / Values Callout */}
          <div className="mt-32 p-12 lg:p-20 bg-black text-white relative overflow-hidden">
            <div className="relative z-10 max-w-3xl">
              <h2 className="text-3xl lg:text-5xl font-light tracking-tight mb-8">
                Why CortDevs?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <h4 className="text-lg font-medium mb-3 text-neutral-400">Quality Above All</h4>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    We don't settle for "good enough". Every line of code and every client interaction 
                    must meet our 3 Rounds of Perfection standards.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-medium mb-3 text-neutral-400">Remote Excellence</h4>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Work from anywhere. We value results, autonomy, and clear communication 
                    over office presence.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-neutral-800/10 to-transparent pointer-events-none" />
          </div>
        </div>
      </section>
    </div>
  );
}

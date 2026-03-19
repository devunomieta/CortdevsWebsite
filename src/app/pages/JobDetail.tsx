import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Briefcase, 
  DollarSign,
  Upload,
  FileText,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  RefreshCw
} from "lucide-react";
import { Link, useParams, Navigate } from "react-router";
import { useState, useRef, useEffect } from "react";
import { jobs as staticJobs, Job } from "../data/jobs";
import { SEO } from "../components/SEO";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { DeadlineCountdown } from "../components/DeadlineCountdown";

export function JobDetail() {
  const { jobId } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [cvUploaded, setCvUploaded] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        // Validation: Check if jobId is a valid UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId || "");
        
        let data, error;
        if (isUUID) {
          const result = await supabase
            .from('careers')
            .select('*')
            .eq('id', jobId)
            .single();
          data = result.data;
          error = result.error;
        }

        if (!isUUID || (error && error.code !== 'PGRST116')) {
          // If not UUID or not found by ID, try fetching by slug
          const slugResult = await supabase
            .from('careers')
            .select('*')
            .eq('slug', jobId)
            .single();
          
          if (slugResult.data) {
            data = slugResult.data;
            error = null;
          }
        }

        if (data) {
          const normalizedJob = {
            ...data,
            applyUrl: data.apply_url || data.applyUrl
          };
          setJob(normalizedJob as Job);
        } else {
          // Fallback to static data
          const staticJob = staticJobs.find((j) => j.id === jobId);
          if (staticJob) setJob(staticJob);
        }
      } catch (err) {
        const staticJob = staticJobs.find((j) => j.id === jobId);
        if (staticJob) setJob(staticJob);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <RefreshCw className="animate-spin text-neutral-300 w-8 h-8" />
      </div>
    );
  }

  if (!job) {
    return <Navigate to="/careers" replace />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF, DOC, DOCX)
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB.");
      return;
    }

    setCvFile(file);
    setCvUploaded(false); // Reset this since it's a new file
  };

  const handleScheduleInterview = async () => {
    if (!cvFile || !job) return;

    setIsUploading(true);
    try {
      // 1. Upload to Supabase Storage
      const fileExt = cvFile.name.split('.').pop();
      const fileName = `${job.id}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `cv-uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cv-uploads')
        .upload(filePath, cvFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cv-uploads')
        .getPublicUrl(filePath);

      // 2. Save application record (Only if job.id is a valid UUID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.id);
      if (isUUID) {
        const { error: dbError } = await supabase
          .from('job_applications')
          .insert([{ 
            job_id: job.id, 
            cv_url: publicUrl 
          }]);

        if (dbError) throw dbError;
      } else {
        console.warn("Skipping DB record: Job ID is not a UUID. Data still sent via email.");
      }

      // 3. Notify Admin via Email
      const adminEmail = "projects@cortdevs.com";
      const subject = `New Application: ${job.title}`;
      const body = `
        <h3>A new candidate has applied for ${job.title}</h3>
        <p>A candidate has just uploaded their CV and is proceeding to schedule an interview.</p>
        <p><strong>Candidate CV:</strong> <a href="${publicUrl}">Download / View CV</a></p>
        <p><strong>Job Detail:</strong> <a href="${window.location.origin}/careers/${job.id}">${job.title}</a></p>
        <hr/>
        <p>You can find the application record in the Admin Dashboard (if the job exists in the DB).</p>
      `;

      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: adminEmail,
          subject,
          body,
          type: 'Application'
        })
      });

      setCvUploaded(true);
      toast.success("CV submitted! Redirecting to interview scheduler...");

      // 4. Redirect to Calendly (Same tab)
      setTimeout(() => {
        window.location.href = job.applyUrl;
      }, 1500);

    } catch (error: any) {
      console.error("Submission failed:", error);
      toast.error(error.message || "Failed to submit application. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const socials = [
    { icon: <Facebook size={20} />, label: "Facebook", href: "https://facebook.com/hirecortdevs" },
    { icon: <Youtube size={20} />, label: "TikTok", href: "https://tiktok.com/@hirecortdevs" }, // Using Youtube icon as fallback or custom
    { icon: <Instagram size={20} />, label: "Instagram", href: "https://instagram.com/hirecortdevs" },
    { icon: <Twitter size={20} />, label: "X (Twitter)", href: "https://x.com/hirecortdevs" },
  ];

  return (
    <div className="bg-white min-h-screen">
      <SEO 
        title={`${job.title} | Careers at CortDevs`}
        description={job.about}
      />

      {/* Header */}
      <section className="pt-32 pb-16 lg:pt-48 lg:pb-24 border-b border-neutral-100 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div {...fadeInUp}>
            <Link 
              to="/careers" 
              className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-neutral-500 hover:text-black transition-colors mb-12 group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              Back to Careers
            </Link>
            
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                job.status === 'open' 
                  ? "bg-green-50 text-green-700 border-green-100" 
                  : "bg-neutral-100 text-neutral-500 border-neutral-200"
              }`}>
                {job.status === 'open' ? "Current Opening" : "Closed"}
              </span>
              <div className="flex items-center gap-1.5 text-neutral-500 text-sm">
                <MapPin size={16} />
                {job.location}
              </div>
            </div>

            <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-8">
              {job.title}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-neutral-200 bg-white">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-neutral-50 flex items-center justify-center flex-shrink-0">
                  <Briefcase size={20} className="text-neutral-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Role Type</p>
                  <p className="text-sm font-medium">{job.role}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-neutral-50 flex items-center justify-center flex-shrink-0">
                  <DollarSign size={20} className="text-neutral-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Compensation</p>
                  <p className="text-sm font-medium leading-relaxed">{job.compensation}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="space-y-20">
            {/* About the Role */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-light tracking-tight mb-8 border-l-4 border-black pl-6 uppercase text-[14px] font-bold tracking-widest">
                The Mission
              </h2>
              <p className="text-lg text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {job.about}
              </p>
            </motion.div>

            {/* Responsibilities */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-light tracking-tight mb-8 border-l-4 border-black pl-6 uppercase text-[14px] font-bold tracking-widest">
                Key Responsibilities
              </h2>
              <ul className="grid grid-cols-1 gap-6">
                {job.responsibilities.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-4 group">
                    <div className="mt-1.5 w-5 h-5 bg-black text-white flex items-center justify-center flex-shrink-0 text-[10px]">
                      {idx + 1}
                    </div>
                    <span className="text-neutral-600 leading-relaxed group-hover:text-black transition-colors">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Requirements */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl font-light tracking-tight mb-8 border-l-4 border-black pl-6 uppercase text-[14px] font-bold tracking-widest">
                Candidate Requirements
              </h2>
              <ul className="space-y-4">
                {job.requirements.map((req, idx) => (
                  <li key={idx} className="flex items-center gap-4 text-neutral-600">
                    <CheckCircle2 size={20} className="text-black flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* CTA */}
            {job.status === 'open' ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="pt-12 border-t border-neutral-100"
              >
                <div className="bg-black p-12 text-center text-white">
                  <h3 className="text-3xl font-light mb-4">Ready to reach out?</h3>
                  <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                    Please upload your CV to unlock the interview scheduler.
                  </p>

                  {job.deadline && <DeadlineCountdown deadline={job.deadline} />}

                  <div className="max-w-xs mx-auto mb-8">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx"
                    />
                    <button
                      onClick={() => !cvUploaded && fileInputRef.current?.click()}
                      disabled={isUploading || cvUploaded}
                      className={`w-full py-4 px-6 border border-dashed flex items-center justify-center gap-3 transition-all ${
                        cvUploaded 
                          ? "bg-green-900/20 border-green-500/50 text-green-400 cursor-default" 
                          : cvFile 
                            ? "bg-neutral-900/50 border-neutral-600 text-white"
                            : "border-neutral-700 hover:border-white text-neutral-400 hover:text-white"
                      }`}
                    >
                      {cvUploaded ? (
                        <><CheckCircle2 size={20} /> CV Submitted</>
                      ) : cvFile ? (
                        <><CheckCircle2 size={20} /> CV Selected</>
                      ) : (
                        <><Upload size={20} /> Upload CV (PDF/Word)</>
                      )}
                    </button>
                    
                    {cvFile && !isUploading && (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center gap-4 mt-4">
                          <button 
                            onClick={() => {
                              setCvUploaded(false);
                              setCvFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white flex items-center gap-1.5 transition-colors"
                          >
                            <RefreshCw size={12} /> {cvUploaded ? "Edit / Change" : "Re-select"}
                          </button>
                          <div className="w-px h-3 bg-neutral-800" />
                          <button 
                            onClick={() => {
                              if (cvFile) {
                                const url = URL.createObjectURL(cvFile);
                                window.open(url, '_blank');
                              }
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white flex items-center gap-1.5 transition-colors"
                          >
                            <FileText size={12} /> Preview
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-4 truncate font-mono max-w-xs">
                          Selected: {cvFile.name}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleScheduleInterview}
                    disabled={!cvFile || isUploading || cvUploaded}
                    className={`inline-flex items-center justify-center gap-3 px-12 py-5 text-sm tracking-widest uppercase transition-all font-bold group ${
                      cvFile && !isUploading && !cvUploaded
                        ? "bg-white text-black hover:bg-neutral-100 cursor-pointer" 
                        : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    {isUploading ? (
                      <div className="flex items-center gap-3">
                        <RefreshCw className="animate-spin" size={18} />
                        Submitting...
                      </div>
                    ) : (
                      <>
                        {cvUploaded ? "Interview Requested" : "Schedule Interview"}
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="pt-12 border-t border-neutral-100">
                <div className="bg-neutral-50 p-12 text-center border border-neutral-200">
                  <h3 className="text-2xl font-light mb-4">This position is closed.</h3>
                  <p className="text-neutral-500 mb-8 max-w-md mx-auto text-sm">
                    We're not currently hiring for this role, but we'd love to stay connected. 
                    Follow us for future updates.
                  </p>
                  
                  <div className="flex justify-center gap-4">
                    {socials.map((social, idx) => (
                      <a 
                        key={idx}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 flex items-center justify-center border border-neutral-200 text-neutral-400 hover:border-black hover:text-black transition-all"
                        aria-label={social.label}
                      >
                        {social.icon}
                      </a>
                    ))}
                  </div>
                  <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                    @hirecortdevs
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

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
  RefreshCw,
  Shield
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
          console.warn("Job not found in DB:", jobId);
          setJob(null);
        }
      } catch (err) {
        console.error("Error retrieving job details:", err);
        setJob(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="animate-spin text-muted-foreground w-8 h-8" />
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
      const jobSlug = job.slug || job.id;
      const fileName = `${jobSlug}-${Math.random().toString(36).substring(2, 8)}-${Date.now()}.${fileExt}`;
      const filePath = `cv-uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, cvFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
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
      const adminEmail = ["projects@cortdevs.com", "cortdevs@gmail.com"];
      const subject = `New Application: ${job.title}`;
      const body = `
        <h3>A new candidate has applied for ${job.title}</h3>
        <p>A candidate has just uploaded their CV and is proceeding to schedule an interview.</p>
        <p><strong>Candidate CV:</strong> <a href="${publicUrl}">Download / View CV</a></p>
        <p><strong>Job Detail:</strong> <a href="${window.location.origin}/careers/${job.id}">${job.title}</a></p>
        <hr/>
        <p>You can find the application record in the Admin Dashboard.</p>
      `;

      const emailResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: adminEmail,
          subject,
          body,
          type: 'Application'
        })
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error("Email dispatch failed:", errorData);
        // We still proceed because the file is uploaded, but we warn the user
        toast.warning("Application recorded, but contact relay was delayed. Please proceed to schedule.");
      }

      setCvUploaded(true);
      toast.success("Upload Successful, Redirecting to Booking Page!");

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
    <div className="bg-background min-h-screen">
      <SEO 
        title={`${job.title} | Careers at CortDevs`}
        description={job.about}
      />

      {/* Hero Header */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-24 bg-secondary/50 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Link 
            to="/careers" 
            className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-12"
          >
            <ArrowLeft size={14} /> Back to Open Positions
          </Link>
          
          <motion.div {...fadeInUp}>
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <span className={`px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] ${
                job.status === 'open' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {job.status === 'open' ? 'Active Opportunity' : 'Closed Role'}
              </span>
              <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                <MapPin size={12} className="text-muted-foreground/30" />
                {job.location}
              </div>
            </div>
            
            <h1 className="text-5xl lg:text-8xl font-light tracking-tighter mb-10 leading-[1] max-w-4xl text-foreground">
              {job.title}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-12 border-t border-border">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Primary Architecture</p>
                <p className="text-lg font-light italic text-foreground">{job.role}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Compensation Structure</p>
                <p className="text-sm font-medium leading-relaxed max-w-xs text-foreground">{job.compensation}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Assignment Type</p>
                <p className="text-sm font-medium uppercase tracking-widest text-[10px] text-foreground">Remote / Global Engagement</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            {/* Left Column: Details */}
            <div className="lg:col-span-7 space-y-20">
              <motion.div {...fadeInUp} className="prose prose-neutral max-w-none">
                <h2 className="text-3xl font-light tracking-tight mb-8 italic text-muted-foreground">The Objective</h2>
                <p className="text-xl font-light text-muted-foreground leading-relaxed">
                  {job.about.replace(/\\"/g, '"')}
                </p>
              </motion.div>

              <motion.div {...fadeInUp}>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-10 border-b border-border pb-4">Key Responsibilities</h2>
                <ul className="space-y-6">
                  {job.responsibilities.map((item, idx) => (
                    <li key={idx} className="flex gap-6 group">
                      <span className="text-muted/30 font-mono text-xs pt-1 group-hover:text-foreground transition-colors">0{idx + 1}</span>
                      <p className="text-muted-foreground leading-relaxed font-light">{item}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div {...fadeInUp}>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-10 border-b border-border pb-4">Structural Requirements</h2>
                <ul className="space-y-6">
                  {job.requirements.map((item, idx) => (
                    <li key={idx} className="flex gap-4 items-start">
                      <div className="mt-2 w-1.5 h-1.5 bg-foreground rotate-45 shrink-0" />
                      <p className="text-muted-foreground leading-relaxed font-light">{item}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Right Column: CTA */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-32">
                {job.status === 'open' ? (
                  <motion.div 
                    {...fadeInUp}
                    className="bg-primary text-primary-foreground p-10 lg:p-14 shadow-3xl relative overflow-hidden"
                  >
                    <div className="relative z-10">
                      <h2 className="text-3xl font-light tracking-tight mb-4 italic">Application Form</h2>
                      <p className="text-primary-foreground/60 font-light mb-10 text-sm leading-relaxed">
                        Please upload your CV and proceed to book interview slot
                      </p>

                      {job.deadline && <DeadlineCountdown deadline={job.deadline} />}

                      <div className="space-y-6">
                        <div className="relative group">
                          <input 
                            type="file" 
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            id="cv-upload-input"
                          />
                          <div className={`w-full py-10 border border-border flex flex-col items-center justify-center gap-4 transition-all duration-500 border-dashed ${
                            cvFile ? "bg-primary-foreground/10 border-border/50 text-primary-foreground" : "hover:bg-primary-foreground/5 text-primary-foreground/70 hover:text-primary-foreground"
                          }`}>
                            <Upload size={24} className={isUploading ? "animate-bounce" : ""} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-center px-4">
                              {cvUploaded 
                                ? "Transmission Confirmed" 
                                : cvFile 
                                  ? `Selected: ${cvFile.name}` 
                                  : "Drop CV or Click to Upload"}
                            </span>
                            
                            {cvFile && !isUploading && !cvUploaded && (
                              <div className="flex gap-4 mt-2 relative z-30">
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const url = URL.createObjectURL(cvFile);
                                    window.open(url, '_blank');
                                  }}
                                  className="text-[8px] font-bold uppercase tracking-widest text-primary-foreground/60 hover:text-primary-foreground underline underline-offset-4"
                                >
                                  Preview CV
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setCvFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                  }}
                                  className="text-[8px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-400 underline underline-offset-4"
                                >
                                  Edit / Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={handleScheduleInterview}
                          disabled={!cvFile || isUploading || cvUploaded}
                          className="w-full py-6 bg-primary-foreground text-primary text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 shadow-xl shadow-black/20"
                        >
                          {isUploading ? (
                            <>
                              <Upload size={16} className="animate-bounce" />
                              Synchronizing...
                            </>
                          ) : cvUploaded ? (
                            "Upload Successful, Redirecting..."
                          ) : (
                            <>
                              Schedule Interview
                              <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="mt-10 pt-10 border-t border-primary-foreground/10">
                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-primary-foreground/40 mb-6">Stay Connected</p>
                        <div className="flex gap-6">
                          {socials.map((social, idx) => (
                            <a 
                              key={idx}
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-foreground/50 hover:text-primary-foreground transition-all"
                              aria-label={social.label}
                            >
                              {social.icon}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/5 blur-[100px] rounded-full translate-x-32 -translate-y-32" />
                  </motion.div>
                ) : (
                  <div className="p-10 border border-border bg-secondary text-center space-y-4">
                    <p className="text-xl font-light italic text-muted-foreground">Position Closed</p>
                    <p className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest">Internal selection in progress</p>
                    <Link to="/careers" className="inline-block mt-4 text-[10px] font-bold uppercase tracking-widest text-foreground hover:underline underline-offset-4">Check Other Openings</Link>
                    
                    <div className="pt-10 mt-10 border-t border-border flex flex-col items-center">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6">Stay Connected for Updates</p>
                      <div className="flex justify-center gap-6">
                        {socials.map((social, idx) => (
                          <a 
                            key={idx}
                            href={social.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-all"
                            aria-label={social.label}
                          >
                            {social.icon}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

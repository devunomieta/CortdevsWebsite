import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Users,
  CreditCard,
  BookOpen,
  Calendar,
  ShieldCheck,
  Zap,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Activity,
  Clock,
  Lock,
  Laptop,
  Check,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Award,
  Layers,
  Inbox,
  UserCheck,
  FileSpreadsheet,
  Menu,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { SEO } from "../components/SEO";
import { ToastProvider, useToast } from "../components/Toast";

export function SironaLanding() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Sirona Smart School Management System",
    "description": "A secure web-based portal designed for primary and secondary schools in Nigeria to automate fees collection, Continuous Assessment (CA), result computation, and parent communications.",
    "brand": {
      "@type": "Brand",
      "name": "Sirona"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "NGN",
      "lowPrice": "0",
      "highPrice": "0",
      "priceValidUntil": "2027-12-31"
    }
  };

  return (
    <ToastProvider>
      <SEO
        title="Sirona | Smart School Management System for Nigerian Schools"
        description="Eliminate CA calculation errors, block school fee leakages, and automate termly report sheets with Sirona. Setup is completely free, and there are zero charges for the first year."
        structuredData={schema}
      />
      <SironaLandingContent />
    </ToastProvider>
  );
}

function SironaLandingContent() {
  const { showToast } = useToast();
  const [activeModuleTab, setActiveModuleTab] = useState<"academic-err" | "fees-leakage" | "admin-boost">("academic-err");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive Savings Calculator State (Customized for Nigerian School Fee brackets)
  const [studentCount, setStudentCount] = useState<number>(300);
  const [averageFee, setAverageFee] = useState<number>(120000); // Default average fee per term in Naira

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    schoolName: "",
    phone: "",
    studentCapacity: "100-500",
    meetingType: "virtual", // virtual meeting or physical visit to the school
    message: "",
    website: "" // Honeypot field for security
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Honeypot check for bots (Security hardening)
    if (formData.website) {
      console.warn("Spam bot submission intercepted via honeypot.");
      setFormSuccess(true);
      return;
    }

    // 2. Client-side Name length validations
    if (formData.name.trim().length < 2) {
      showToast("Please enter your full name (minimum 2 characters).", "warning");
      return;
    }
    if (formData.schoolName.trim().length < 3) {
      showToast("Please enter a valid school name (minimum 3 characters).", "warning");
      return;
    }

    // 3. Strict TLD Email Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      showToast("Please enter a valid email address with a top-level domain (e.g. name@school.com).", "warning");
      return;
    }

    // 4. Phone Number format validation
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!formData.phone || !phoneRegex.test(formData.phone)) {
      showToast("Please enter a valid phone or WhatsApp number (minimum 7 digits).", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const detailsText = `
        <strong>School Name:</strong> ${formData.schoolName}<br/>
        <strong>Phone Number:</strong> ${formData.phone}<br/>
        <strong>Estimated Enrollment:</strong> ${formData.studentCapacity}<br/>
        <strong>Preferred Meeting Type:</strong> ${formData.meetingType.toUpperCase()} Walkthrough<br/>
        <strong>Special Demands:</strong> ${formData.message || "None specified"}
      `;

      // 1. Log Lead entry in Supabase
      const { error: supabaseError } = await supabase
        .from('leads')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          service: "Sirona School System",
          budget: `Free Trial / Capacity: ${formData.studentCapacity}`,
          details: detailsText,
          status: 'New'
        }]);

      if (supabaseError) throw supabaseError;

      // 2. Log Admin Panel notification
      await supabase.from('notifications').insert([{
        type: 'Lead',
        message: `New Sirona Demo Request (${formData.meetingType}): ${formData.schoolName}`,
        link: '/admin/leads'
      }]);

      // 3. Trigger Email API Endpoint (Sends mail to both Admin and User via Resend)
      try {
        const contactPayload = {
          name: formData.name,
          email: formData.email,
          company: formData.schoolName,
          phone: formData.phone,
          service: "Sirona School System Walkthrough",
          budget: "₦0 Pioneer Offer",
          timeline: formData.meetingType === "virtual" ? "Virtual Screen Share" : "Physical Visit to School",
          message: `Sirona Walkthrough Brief:\nSchool Name: ${formData.schoolName}\nWhatsApp/Phone: ${formData.phone}\nStudent Capacity: ${formData.studentCapacity}\nWalkthrough Preference: ${formData.meetingType.toUpperCase()}\n\nSpecial Demands:\n${formData.message || "None specified."}`,
          website: formData.website
        };

        const emailResponse = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactPayload),
        });

        if (!emailResponse.ok) {
          const emailResponseText = await emailResponse.text();
          console.warn("Email API responded with status warning:", emailResponse.status, emailResponseText);
        }
      } catch (emailErr) {
        console.error("Failed to relay email notifications via API router:", emailErr);
      }

      showToast("Walkthrough request submitted successfully! Our representative will call you shortly.", "success");
      setFormSuccess(true);
      setFormData({
        name: "",
        email: "",
        schoolName: "",
        phone: "",
        studentCapacity: "100-500",
        meetingType: "virtual",
        message: "",
        website: ""
      });
    } catch (err: any) {
      console.error("Error submitting Sirona walkthrough request:", err);
      showToast("Failed to transmit request. Please check your network connection.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Nigerian Niche Calculator Equations
  const adminHoursSaved = Math.round(studentCount * 0.5); 
  const termlyRevenueRecovery = Math.round(studentCount * averageFee * 0.08); 
  const paperSheetsSaved = studentCount * 45; 

  // Determine backlink destination dynamically
  const isSubdomain = typeof window !== 'undefined' && (
    window.location.hostname.startsWith('sirona.') || 
    window.location.hostname.includes('sirona.cortdevs.com')
  );
  const mainSiteUrl = isSubdomain ? "https://cortdevs.com" : "/";

  const valuePillars = {
    "academic-err": {
      title: "Eliminate Grading & CA Errors",
      tag: "ZERO MANUAL MISTAKES",
      description: "Class teachers and subject teachers spend days calculating averages, grading formulas, and copying transcripts manually. Sirona automates continuous assessment calculation and results sheet compilation with absolute precision.",
      items: [
        { title: "Continuous Assessment (CA) Engine", desc: "No more math errors. Input marks for 1st CA, 2nd CA, and Exams. The system automatically computes total scores, terms averages, class positions, and letter grades based on your customized grading scale." },
        { title: "Automated Termly Report Cards", desc: "Generate print-ready PDF report cards in one click. Class teachers and Principals can input custom remarks directly from their dashboards." },
        { title: "Conflict-Free Timetables", desc: "Create error-free schedules for classes, subjects, and exams. The system prevents double-allocating a classroom or class teacher." },
        { title: "Syllabus tracking dashboard", desc: "Monitor curriculum progress. Subject teachers log covered topics weekly, letting the Principal track syllabus status instantly." }
      ]
    },
    "fees-leakage": {
      title: "Stop Fee Leakages & Save Paper Costs",
      tag: "FINANCIAL ACCOUNTING INTEGRITY",
      description: "Unpaid balances and unrecorded cash payments create massive shortfalls for school owners. Sirona provides the Bursar and school management with clear oversight of all income, bills, and outstanding payments.",
      items: [
        { title: "Accurate Balance Sheet Tracking", desc: "Every payment log maps back to a specific student profile. Know exactly which student has outstanding balances for fees, bus transportation, or boarding fees." },
        { title: "Paystack Card & Bank Transfer integration", desc: "Parents pay school fees securely online using cards or direct bank transfer. The payment reconciles immediately, eliminating manual bank teller verification errors." },
        { title: "Automated Balance Reminders", desc: "Send friendly automated reminders via email or SMS directly to parents with pending school fee balances before exams begin." },
        { title: "₦0 Paper Result Sheets & Newsletters", desc: "Publish newsletters and report sheets directly to the parent portal. Save hundreds of thousands of Naira termly on printing papers and photocopier toner." }
      ]
    },
    "admin-boost": {
      title: "Empower Admin Staff & Engage Parents",
      tag: "STREAMLINED SCHOOL WORKFLOW",
      description: "Keep your school community connected. Minimize the administrative friction of coordinating registrations, student registers, and daily administrative duties.",
      items: [
        { title: "Digital Class Registers", desc: "Class teachers mark attendance on tablet or mobile in under a minute. Parents receive automatic alerts if a student is absent from class." },
        { title: "Fast Online Admission & Enrollment", desc: "Parents fill out admission forms online. The system assigns unique admission numbers and populates parent-student directories instantly." },
        { title: "Bursary & Expense Logs", desc: "Track school expenditures, vendor purchases, and repairs. Upload cash vouchers and receipts for complete financial accountability." },
        { title: "School Library Logs", desc: "Register textbooks, checkouts, and returns easily, ensuring library books do not disappear at the end of the term." }
      ]
    }
  };

  const faqItems = [
    {
      q: "How much does it cost to set up Sirona for our school?",
      a: "Setup is completely free (₦0 setup fee). We will migrate your student registers, teacher files, and subject listings onto the platform at no cost. There are also no licensing or system charges for your first 12 months."
    },
    {
      q: "How do we access the Sirona demo?",
      a: "Because Sirona is custom-tailored to fit the unique structure of individual schools, we do not provide generic demo access. Instead, you can schedule a physical visit to your school or a virtual meet (via Zoom or Google Meet). Our engineers will showcase a demo account and show how the system fits your grading system, fees setup, and class arms."
    },
    {
      q: "Does it support local Nigerian payment gateways?",
      a: "Yes. Sirona features built-in payment integrations with systems like Paystack. Parents can pay termly school fees using debit cards, USSD codes, or direct bank transfer. Payments are credited straight to your school's bank account."
    },
    {
      q: "Can it handle custom grading scales and class arms?",
      a: "Yes, the academic engine is fully customizable. Whether you run a Nursery, Primary, or Secondary school with Class Arms (e.g., JSS 1 Gold, SS 3 Science), Sirona adapts to your specific grading requirements (e.g., 30% CA + 70% Exam, or 40% CA + 60% Exam)."
    },
    {
      q: "How does the system ensure data security?",
      a: "Sirona is built on secure cloud databases with role-based access controls. The Bursar only views finance files; subject teachers only access their class grade sheets; parents only see report cards for their specific children."
    }
  ];

  return (
    <div className="bg-background text-foreground transition-colors duration-300 min-h-screen overflow-x-hidden">
      {/* Sirona Specialized Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/80 py-5 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center transition-transform group-hover:scale-105">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
              Sirona
            </span>
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#roi-calculator" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Savings Estimator</a>
            <a href="#pricing-terms" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Pricing & Offer</a>
            <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            
            {/* Link back to corporate website */}
            <a 
              href={mainSiteUrl}
              className="text-xs font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-all flex items-center gap-1 border-l border-border pl-6 ml-2"
            >
              Main Website <ArrowRight className="w-3 h-3" />
            </a>
          </nav>

          {/* CTA button (Hidden on mobile) */}
          <div className="hidden md:block">
            <a
              href="#request-demo"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-primary text-primary-foreground tracking-widest text-xs font-bold uppercase hover:opacity-90 transition-all"
            >
              Book Walkthrough
            </a>
          </div>

          {/* Mobile Menu Icon Toggle (Visible on mobile only) */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-2 text-foreground hover:text-primary transition-colors focus:outline-none z-50 relative"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Full-Screen Mobile Navigation Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/98 backdrop-blur-lg pt-28 px-6 pb-8 flex flex-col justify-between md:hidden"
          >
            <nav className="flex flex-col gap-6 text-left">
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a 
                href="#roi-calculator" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Savings Estimator
              </a>
              <a 
                href="#pricing-terms" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing & Offer
              </a>
              <a 
                href="#faq" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </a>
              <a 
                href={mainSiteUrl}
                className="text-lg font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 pt-4 border-t border-border"
              >
                Main Website <ArrowRight className="w-4 h-4" />
              </a>
            </nav>

            <div className="space-y-4">
              <a
                href="#request-demo"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-4 bg-primary text-primary-foreground text-center font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                Book Walkthrough
              </a>
              <p className="text-center text-xs text-muted-foreground font-medium">
                © 2026 Sirona School System
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section id="hero" className="relative pt-36 pb-20 lg:pt-48 lg:pb-32 px-6 overflow-hidden">
        {/* Glow spots */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
          <div className="lg:col-span-7 text-left space-y-8">
            <div className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase">
              100% Secure Web-Based Software
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-light tracking-tight leading-[1.1] text-foreground">
              Eliminate School errors.
              <span className="block font-semibold mt-2">Maximize Fees Collection.</span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Automate Continuous Assessment (CA), grade termly results, track school fees, and streamline parental communications. Sirona removes administrative and accounting mistakes, saving your school massive paperwork costs while improving fee recovery.
            </p>

            <div className="bg-secondary/40 border border-border p-5 rounded-lg max-w-xl space-y-2">
              <p className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" /> Exclusive Pioneer Offer
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Enjoy <strong>₦0 Setup Fee</strong> (we handle student records upload and layout migrations) and <strong>Zero System Charges</strong> for your entire first year of usage.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#request-demo"
                className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-primary text-primary-foreground tracking-widest text-xs font-bold uppercase hover:opacity-90 transition-all group"
              >
                Schedule Free Walkthrough
                <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#roi-calculator"
                className="inline-flex items-center justify-center gap-3 px-8 py-5 border border-border text-foreground tracking-widest text-xs font-bold uppercase hover:bg-muted transition-colors"
              >
                Calculate School Savings
              </a>
            </div>

            {/* Quick highlights */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-border">
              <div className="space-y-1">
                <div className="text-2xl font-semibold text-foreground">0 Error</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">CA & Grade Compilation</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-semibold text-foreground">₦0 Cost</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Setup & Integration</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-semibold text-foreground">100% Free</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">First Year System Use</div>
              </div>
            </div>
          </div>

          {/* Interactive School Dashboard Mockup Component */}
          <div className="lg:col-span-5 relative mt-8 lg:mt-0">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl filter blur-3xl opacity-20 pointer-events-none" />

            <div className="relative border border-border bg-card rounded-xl shadow-2xl p-6 overflow-hidden space-y-6">
              {/* Header simulation */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded">
                  Admin Portal Preview
                </span>
              </div>

              {/* Grid values */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-4 border border-border rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Total Registers</span>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-bold text-foreground">428 Students</div>
                  <span className="text-xs text-emerald-500 font-medium">
                    Fully enrolled in directory
                  </span>
                </div>

                <div className="bg-background p-4 border border-border rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Fee Collection</span>
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xl font-bold text-foreground">94.8% Cleared</div>
                  <span className="text-xs text-primary font-medium">
                    Loophole leakages blocked
                  </span>
                </div>
              </div>

              {/* Simulated Chart/Analytics widget */}
              <div className="bg-background p-4 border border-border rounded-lg space-y-3">
                <div className="flex justify-between items-center text-xs text-muted-foreground font-bold uppercase">
                  <span>CA & Exam Mark Sheets Status</span>
                  <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-mono">TERM 3</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-foreground font-medium">
                    <span>Nursery & Primary Sections</span>
                    <span className="font-semibold text-emerald-500">100% Compiled</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-foreground font-medium">
                    <span>Secondary Section (JSS / SSS)</span>
                    <span className="font-semibold text-primary">92% Compiled</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[92%]" />
                  </div>
                </div>
              </div>

              {/* Feed logs */}
              <div className="bg-background p-4 border border-border rounded-lg space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Errors Blocked Log
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-foreground font-medium">CA marks recalculation error corrected</p>
                      <p className="text-xs text-muted-foreground">Class Arm: JSS 2 Gold • Subject: Mathematics</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-foreground font-medium">Unpaid balance checked at exam gate</p>
                      <p className="text-xs text-muted-foreground">Automated reminder relayed to parent contact</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Proof Logos Banner */}
      <section className="py-12 bg-card border-y border-border px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center md:text-left">
            TRUSTED FOR COMPREHENSIVE SCHOOL OPERATIONS IN NIGERIA
          </span>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-12 gap-y-6 text-muted-foreground font-semibold text-sm">
            <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-primary" /> Nursery & Primary Schools</span>
            <span className="flex items-center gap-1.5"><Laptop className="w-4 h-4 text-primary" /> Junior & Senior Secondary (JSS/SSS)</span>
            <span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-primary" /> Multicampus Institutions</span>
          </div>
        </div>
      </section>

      {/* Onboarded Schools Showcase Section */}
      <section className="py-20 bg-background border-b border-border px-6">
        <div className="max-w-7xl mx-auto space-y-12 text-center">
          <div className="space-y-4">
            <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded">
              CURRENT TRACTION
            </span>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground leading-tight">
              Trusted by <span className="font-semibold">38+ Schools</span> Across Nigeria
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto leading-relaxed">
              From Lagos to Kaduna, school proprietors and principal officers rely on Sirona to automate their academic computations and fees registers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {[
              { name: "Royal Crest College", location: "Lekki, Lagos", section: "Primary & Secondary", status: "Day & Boarding" },
              { name: "Pinnacle Heights Academy", location: "Wuse II, Abuja", section: "Nursery & Primary", status: "Day Section" },
              { name: "Springfield Montessori School", location: "Enugu", section: "Nursery & Primary", status: "Day Section" },
              { name: "Leadway British College", location: "Kaduna", section: "Secondary Section", status: "Day & Boarding" },
              { name: "Graceland Model College", location: "Port Harcourt", section: "Secondary Section", status: "Boarding Section" },
              { name: "Danbo Memorial High School", location: "Zaria, Kaduna", section: "Primary & Secondary", status: "Day & Boarding" },
              { name: "Christ the King Model Academy", location: "Ibadan", section: "Primary Section", status: "Day Section" },
              { name: "Victory International School", location: "Benin City, Edo", section: "Nursery & Primary", status: "Day Section" }
            ].map((school, idx) => (
              <div key={idx} className="bg-card border border-border p-5 rounded-lg text-left space-y-2 hover:border-muted-foreground transition-colors">
                <h4 className="text-sm font-bold text-foreground">{school.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{school.location}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <span className="text-xs bg-secondary px-2.5 py-0.5 rounded font-medium text-foreground">{school.section}</span>
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded font-medium">{school.status}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground pt-4">
            And 30+ other nursery, primary, and secondary institutions operating across various states.
          </p>
        </div>
      </section>

      {/* High-Value Interactive Savings Calculator */}
      <section id="roi-calculator" className="py-20 lg:py-32 px-6 relative bg-secondary/10">
        <div className="max-w-5xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">
              BUSINESS ESTIMATION
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
              See How Much Your School <br />
              <span className="font-semibold">Saves Termly</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm">
              Drag the sliders below to estimate the staff hours saved, paper printing costs reduced, and fee collection leakages blocked by deploying Sirona.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch text-left">
            {/* Input card */}
            <div className="bg-card border border-border rounded-xl p-8 space-y-8 flex flex-col justify-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground border-b border-border pb-4 flex items-center gap-2">
                <Laptop className="w-4.5 h-4.5 text-primary" /> School Parameters
              </h3>

              {/* Slider 1: Student Count */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Number of Registered Students
                  </label>
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded">
                    {studentCount} Students
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={studentCount}
                  onChange={(e) => setStudentCount(parseInt(e.target.value))}
                  className="w-full accent-primary bg-background h-2 rounded-lg cursor-pointer border border-border"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase">
                  <span>50</span>
                  <span>750</span>
                  <span>1,500</span>
                </div>
              </div>

              {/* Slider 2: Average Fee */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Average School Fees (per term)
                  </label>
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded">
                    ₦{averageFee.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="500000"
                  step="10000"
                  value={averageFee}
                  onChange={(e) => setAverageFee(parseInt(e.target.value))}
                  className="w-full accent-primary bg-background h-2 rounded-lg cursor-pointer border border-border"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase">
                  <span>₦20,000</span>
                  <span>₦260,000</span>
                  <span>₦500,000</span>
                </div>
              </div>
            </div>

            {/* Calculations Card */}
            <div className="bg-card border border-border rounded-xl p-8 space-y-8 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-6 relative z-10">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Estimated School Gains
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                  {/* Hours Saved */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                      Admin Hours Saved / Month
                    </span>
                    <span className="text-2xl font-bold text-foreground flex items-baseline gap-1">
                      {adminHoursSaved} <span className="text-xs text-muted-foreground font-bold">hrs</span>
                    </span>
                    <p className="text-xs text-muted-foreground leading-normal">Automatic report compiler, class registers & billing alerts</p>
                  </div>

                  {/* Revenue recovery */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                      Fee Loophole Recovery / Term
                    </span>
                    <span className="text-2xl font-bold text-emerald-500">
                      ₦{termlyRevenueRecovery.toLocaleString()}
                    </span>
                    <p className="text-xs text-muted-foreground leading-normal">Blocking receipts errors and manual reconciliations mistakes</p>
                  </div>

                  {/* Paper sheets saved */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                      Paper Sheets Saved / Term
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {paperSheetsSaved.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">sheets</span>
                    </span>
                    <p className="text-xs text-muted-foreground leading-normal">Result sheets, exam booklets & paper notices replaced digitally</p>
                  </div>

                  {/* Operational Speed */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground block">
                      Setup & Onboarding Fees
                    </span>
                    <span className="text-2xl font-bold text-primary">
                      ₦0.00
                    </span>
                    <p className="text-xs text-muted-foreground leading-normal">No implementation cost or first-year charges</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border z-10">
                <a
                  href="#request-demo"
                  className="w-full py-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                >
                  Clear Administrative Errors Now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features & Modules Grid Section */}
      <section id="features" className="py-20 lg:py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-16 lg:space-y-24">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">
              SYSTEM CAPABILITIES
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
              Eliminate Manual Stress. <br />
              <span className="font-semibold">Optimize Administrative Focus.</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Ditch the physical registers, calculator grids, and receipt errors. Sirona consolidates academic performance records, cash accounts, and notifications into one central hub.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap justify-center gap-2 border-b border-border pb-4 max-w-4xl mx-auto">
            {Object.keys(valuePillars).map((key) => {
              const tab = valuePillars[key as keyof typeof valuePillars];
              const isActive = activeModuleTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveModuleTab(key as any)}
                  className={`px-6 py-3 text-xs font-bold uppercase tracking-wider border transition-all ${
                    isActive
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>

          {/* Active Tab contents */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModuleTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center max-w-6xl mx-auto"
            >
              {/* Detailed info */}
              <div className="lg:col-span-5 space-y-6 text-left">
                <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-3 py-1 rounded">
                  {valuePillars[activeModuleTab].tag}
                </span>
                <h3 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight leading-tight">
                  {valuePillars[activeModuleTab].title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {valuePillars[activeModuleTab].description}
                </p>
                <div className="pt-4">
                  <a
                    href="#request-demo"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary hover:opacity-85 transition-opacity"
                  >
                    Discuss these modules <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Items Grid */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {valuePillars[activeModuleTab].items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-card border border-border rounded-lg hover:border-muted-foreground transition-colors space-y-3 group"
                  >
                    <div className="w-9 h-9 rounded bg-background flex items-center justify-center border border-border text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      {activeModuleTab === "academic-err" && <BookOpen className="w-4.5 h-4.5" />}
                      {activeModuleTab === "fees-leakage" && <CreditCard className="w-4.5 h-4.5" />}
                      {activeModuleTab === "admin-boost" && <FileSpreadsheet className="w-4.5 h-4.5" />}
                    </div>
                    <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Demo Access Policy Info Box */}
      <section className="py-20 lg:py-32 bg-card border-y border-border px-6 relative">
        <div className="max-w-4xl mx-auto space-y-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase">
            <Lock className="w-3.5 h-3.5" /> SECURE WALKTHROUGH POLICY
          </div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground leading-tight">
            How to Access the <span className="font-semibold">Sirona Live Demo</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed text-sm max-w-2xl mx-auto">
            To safeguard system integrity and ensure you see a mockup aligned with your specific class divisions, grading ratios, and fee invoices, we do not issue general public credentials. Access is provided during a brief, personal demonstration.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-3xl mx-auto pt-6">
            <div className="p-6 bg-background border border-border rounded-lg space-y-4">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center rounded">
                <Laptop className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Option A: Virtual Walkthrough</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Join a 15-minute screen share session via Zoom or Google Meet. Our technical representative will demonstrate the Admin, Teacher, and Parent dashboards and help map your current student registers.
              </p>
            </div>

            <div className="p-6 bg-background border border-border rounded-lg space-y-4">
              <div className="w-9 h-9 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center rounded">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Option B: Physical School Visit</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                For schools located in Lagos, Abuja, Port Harcourt, and major cities, we can dispatch an onboarding specialist to your school administrative office. They will showcase the system on a live tablet/laptop.
              </p>
            </div>
          </div>

          <div className="p-5 bg-secondary/50 border border-border rounded-lg max-w-xl mx-auto flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-normal font-medium">
              Sirona complies with standard privacy protocols. We will assist you in mapping your student records from Excel sheets or paper files with strict confidentiality guarantees.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing / Licensing Plans Section */}
      <section id="pricing-terms" className="py-20 lg:py-32 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">
              PRICING & IMPLEMENTATION TERMS
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground leading-tight">
              ₦0 Setup Fee. <br />
              <span className="font-semibold">Free Operations for the First 12 Months.</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              We are committed to helping Nigerian schools transition from manual paperwork seamlessly. We handle all data imports for free, and charge absolutely nothing for the first year.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Standard terms - Basic */}
            <div className="bg-card border border-border rounded-lg p-8 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <span className="text-xs font-bold text-primary uppercase tracking-widest block">NURSERY & PRIMARY</span>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Primary System</h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Suitable for independent nursery and primary academies seeking grading error correction and billing transparency.
                </p>
                <div className="pt-2 border-y border-border py-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-foreground">₦0.00</span>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">/ 1st Year</span>
                </div>

                <div className="space-y-3.5 pt-4">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">TERMS & BENEFITS:</span>
                  {[
                    "₦0 setup fee & zero data entry cost",
                    "Continuous Assessment grading logic",
                    "Print-ready report cards generation",
                    "Bursar school fee records console",
                    "Zero maintenance charges for month 1-12"
                  ].map((feat, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-foreground">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <a
                  href="#request-demo"
                  className="w-full py-4 border border-border text-foreground hover:bg-muted text-center font-bold uppercase tracking-wider text-xs flex items-center justify-center transition-colors"
                >
                  Book Walkthrough
                </a>
              </div>
            </div>

            {/* Standard terms - Secondary (Most Common) */}
            <div className="bg-card border-2 border-primary rounded-lg p-8 flex flex-col justify-between space-y-8 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground font-bold text-[10px] tracking-wider uppercase px-4 py-1.5">
                FIRST YEAR FREE
              </div>

              <div className="space-y-4">
                <span className="text-xs font-bold text-primary uppercase tracking-widest block">K-12 / SECONDARY INSTITUTIONS</span>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Secondary / Complete System</h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Our complete system covering Continuous Assessment templates for JSS 1 to SSS 3 classes and Paystack fee integrations.
                </p>
                <div className="pt-2 border-y border-border py-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-foreground">₦0.00</span>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">/ 1st Year</span>
                </div>

                <div className="space-y-3.5 pt-4">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">EVERYTHING INCLUDED:</span>
                  {[
                    "₦0 setup fee (we import student & teacher sheets)",
                    "Paystack integration (USSD, transfer, cards)",
                    "1st CA, 2nd CA, and Exam weight calculations",
                    "Termly results summary sheet printouts",
                    "Bursar expense ledger & balance tracking",
                    "Zero system charges for your entire first year"
                  ].map((feat, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-foreground">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <a
                  href="#request-demo"
                  className="w-full py-4 bg-primary text-primary-foreground text-center font-bold uppercase tracking-wider text-xs flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  Book Walkthrough
                </a>
              </div>
            </div>

            {/* Standard terms - Multi-campus */}
            <div className="bg-card border border-border rounded-lg p-8 flex flex-col justify-between space-y-8">
              <div className="space-y-4">
                <span className="text-xs font-bold text-primary uppercase tracking-widest block">SCHOOL GROUPS</span>
                <h3 className="text-lg font-bold text-foreground uppercase tracking-wider">Multi-Campus Groups</h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  Tailored dashboard for school administrators overseeing multiple branches or schools across Nigeria.
                </p>
                <div className="pt-2 border-y border-border py-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-foreground">₦0.00</span>
                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">/ 1st Year</span>
                </div>

                <div className="space-y-3.5 pt-4">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">ENTERPRISE TERMS:</span>
                  {[
                    "₦0 onboarding fee across all school branches",
                    "Centralized board admin portal view",
                    "Custom subdomain configuration (e.g. schoolname.com)",
                    "Onsite onboarding training for school staff",
                    "Zero charges for the entire group for 12 months"
                  ].map((feat, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-foreground">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <a
                  href="#request-demo"
                  className="w-full py-4 border border-border text-foreground hover:bg-muted text-center font-bold uppercase tracking-wider text-xs flex items-center justify-center transition-colors"
                >
                  Book Walkthrough
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section id="faq" className="py-20 lg:py-32 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <div className="text-xs font-bold text-primary uppercase tracking-widest">
              HAVE QUESTIONS?
            </div>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground leading-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Everything you need to know about the Sirona School Management System, free setup, and walkthrough booking.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, idx) => {
              const isOpen = faqOpen === idx;
              return (
                <div
                  key={idx}
                  className="border border-border bg-card rounded-lg overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setFaqOpen(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex justify-between items-center gap-4 hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-sm font-bold text-foreground">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180 text-foreground" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 pt-0 border-t border-border text-xs sm:text-sm text-muted-foreground leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Conversion Ready Form / CTA Section */}
      <section id="request-demo" className="py-20 lg:py-32 px-6 relative bg-background border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-5 text-left space-y-8">
            <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase">
              BOOK A DEMO MEET
            </span>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground leading-tight">
              Ready to Upgrade Your <br />
              <span className="font-semibold">School System?</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Brief us about your school setup below. An onboarding specialist will contact you via phone to set up a virtual walkthrough or schedule a physical visit to your school.
            </p>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>₦0 Setup cost (Full onboarding & data import)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>12 months full free trial period</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Confidential data migration guarantees</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {formSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border p-8 rounded-lg text-center space-y-6"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto animate-bounce">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-foreground uppercase tracking-wider">Walkthrough Request Received</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
                  Thank you for briefing us. A school system onboarding representative will call you via the provided phone number to confirm the appointment.
                </p>
                <button
                  onClick={() => setFormSuccess(false)}
                  className="px-6 py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Submit Another Inquiry
                </button>
              </motion.div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-8 relative overflow-hidden">
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  {/* Honeypot field for bot spam detection */}
                  <div className="hidden" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      value={formData.website}
                      onChange={handleInputChange}
                      autoComplete="off"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2 text-left">
                      <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Alabi Ibrahim"
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. principal@yourschool.com"
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2 text-left">
                      <label htmlFor="schoolName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        School / Institution Name *
                      </label>
                      <input
                        type="text"
                        id="schoolName"
                        name="schoolName"
                        value={formData.schoolName}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Sirona Model College"
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        WhatsApp / Phone Number *
                      </label>
                      <input
                        type="text"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. 0803 123 4567"
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2 text-left">
                      <label htmlFor="studentCapacity" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Estimated Student Enrollment
                      </label>
                      <select
                        id="studentCapacity"
                        name="studentCapacity"
                        value={formData.studentCapacity}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="Under 100">Under 100 Students</option>
                        <option value="100-300">100 - 300 Students</option>
                        <option value="300-800">300 - 800 Students</option>
                        <option value="Above 800">Above 800 Students</option>
                      </select>
                    </div>

                    <div className="space-y-2 text-left">
                      <label htmlFor="meetingType" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Preferred Walkthrough Option
                      </label>
                      <select
                        id="meetingType"
                        name="meetingType"
                        value={formData.meetingType}
                        onChange={handleInputChange}
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                      >
                        <option value="virtual">Virtual Screen Share (Zoom / Google Meet)</option>
                        <option value="physical">Physical Meeting (Visit to School Premises)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2 text-left">
                      <label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Brief details about your school setup (e.g., location, class sections)
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Tell us if you run boarding or day sections, or any specific concerns..."
                        className="w-full bg-background border border-border px-4 py-3 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isSubmitting ? "Transmitting Brief..." : "Schedule My Walkthrough"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sirona Specialized Footer */}
      <footer className="bg-card border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary text-primary-foreground flex items-center justify-center rounded">
              <GraduationCap className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-foreground">Sirona School System</span>
          </div>

          <p className="text-xs text-muted-foreground text-center md:text-left">
            © 2026 Sirona. Powered by <a href={mainSiteUrl} className="text-primary hover:underline">CortDevs Group</a>. Secure web-based school automation.
          </p>

          <div className="flex gap-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#roi-calculator" className="hover:text-foreground transition-colors">Savings</a>
            <a href="#pricing-terms" className="hover:text-foreground transition-colors">Offer</a>
            <a href={mainSiteUrl} className="hover:text-foreground transition-colors">Main Site</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

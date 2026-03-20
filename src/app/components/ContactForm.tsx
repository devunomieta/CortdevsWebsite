import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { motion } from "framer-motion";
import { Send, Upload, X, Eye, Edit, FileText, CheckCircle2 } from "lucide-react";
import { errorService } from "../../lib/ErrorService";
import { InternationalPhoneInput } from "./InternationalPhoneInput";
import { RichTextEditor } from "./RichTextEditor";
import { BrandLoader } from "./BrandLoader";
import { useConfig } from "../context/ConfigContext";

interface ContactFormProps {
  onSuccess?: () => void;
  isPopup?: boolean;
}

interface FileData {
  name: string;
  size: number;
  type: string;
  file: File;
}

export function ContactForm({ onSuccess, isPopup = false }: ContactFormProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    service: "",
    budget: "",
    timeline: "",
    message: "",
    issueNDA: false,
    ndaUrl: "",
    website: "" // Honeypot
  });

  const [files, setFiles] = useState<FileData[]>([]);
  const [ndaFile, setNdaFile] = useState<FileData | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { currency, setCurrencyCode } = useConfig();

  useEffect(() => {
    // IP-based geo-detection for currency
    const detectCurrency = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_code === 'NG') {
          setCurrencyCode('NGN');
        } else {
          setCurrencyCode('USD');
        }
      } catch (err) {
        console.error("Geo-detection failed:", err);
      }
    };
    detectCurrency();
  }, []);

  useEffect(() => {
    if (searchParams.get("review") === "true") {
      setFormData(prev => ({
        ...prev,
        service: "Technical Consultation",
        message: "I would like to leave a review for CortDevs: "
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (isPreview && containerRef.current) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = containerRef.current.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  }, [isPreview]);

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isPreview) {
      if (!formData.service) {
        setError("Please select a service.");
        return;
      }
      setIsPreview(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // 1. Honeypot check
    if ((formData as any).website) {
      console.warn("Bot detected via honeypot.");
      setTimeout(() => navigate("/success"), 1000); // Silent fail
      return;
    }

    // 2. Strict Email Validation (TLD Required)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please provide a valid corporate email address (e.g., name@company.com).");
      setIsSubmitting(false);
      return;
    }

    const uploadToSupabase = async (fileData: FileData, pathPrefix: string) => {
      const fileName = `${pathPrefix}/${Date.now()}-${fileData.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(fileName, fileData.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(fileName);

      return publicUrl;
    };

    try {
      const uploadedAttachments: { name: string, url: string }[] = [];
      for (const f of files) {
        const url = await uploadToSupabase(f, 'leads/attachments');
        uploadedAttachments.push({ name: f.name, url });
      }

      let uploadedNdaUrl = formData.ndaUrl;
      if (ndaFile) {
        uploadedNdaUrl = await uploadToSupabase(ndaFile, 'leads/ndas');
      }

      const submissionData = {
        ...formData,
        ndaUrl: uploadedNdaUrl,
        attachments: uploadedAttachments,
        files: files.map(f => ({ name: f.name, type: f.type }))
      };

      const { error: supabaseError } = await supabase
        .from('leads')
        .insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          service: formData.service,
          budget: formData.budget,
          details: formData.message,
          nda_url: uploadedNdaUrl,
          attachments: uploadedAttachments,
          status: 'New'
        }]);

      if (supabaseError) throw supabaseError;

      await supabase.from('notifications').insert([{
        type: 'Lead',
        message: `New Lead Inquiry: ${formData.name} (${formData.service})`,
        link: '/admin/leads'
      }]);

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionData),
        });

        if (!response.ok) {
          const responseClone = response.clone();
          let errorMsg = "Transmission Failure. Secure relay path unavailable.";
          try {
            const resData = await response.json();
            errorMsg = resData.error || errorMsg;
          } catch (jsonErr) {
            // If response is not JSON, it's likely a Vercel/Server error page
            const textResponse = await responseClone.text();
            console.error("Non-JSON error response from server:", textResponse);
            errorMsg = `Server Error (${response.status}): ${textResponse.slice(0, 150)}...`;
          }
          throw new Error(errorMsg);
        }
      } catch (emailErr: any) {
        console.error("Transmission failed", emailErr);
        throw emailErr; // Rethrow to show in the UI error box
      }

      if (onSuccess) onSuccess();
      setIsSubmitting(false);
      navigate("/success");
    } catch (err: any) {
      const displayMsg = await errorService.logError(err, "ContactForm.handleSubmit.FullFlow");
      setError(displayMsg ?? "Transmission Failed");
      setIsSubmitting(false);
      setIsPreview(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleManualChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNDA = false) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = isNDA ? ["application/pdf"] : ["application/pdf", "image/jpeg", "image/png"];

    const processedFiles: FileData[] = [];
    let fileError = null;

    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        fileError = `File ${file.name} exceeds 10MB limit.`;
        break;
      }
      if (!allowedTypes.includes(file.type)) {
        fileError = `File ${file.name} is not a ${isNDA ? 'PDF' : 'PDF or regular Image'}.`;
        break;
      }
      processedFiles.push({ name: file.name, size: file.size, type: file.type, file: file });
    }

    if (fileError) {
      setError(fileError);
      return;
    }

    setError(null);
    if (isNDA) {
      setNdaFile(processedFiles[0] || null);
    } else {
      setFiles(prev => [...prev, ...processedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const services = ["WordPress Development", "Shopify Solutions", "GoHighLevel Integration", "Custom Full-Stack Development", "UI/UX Design", "Consulting", "Other"];

  const formatBudget = (usdValue: number) => {
    const converted = usdValue * currency.rate;
    return converted.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const budgetOptions = [
    { label: "Under $1000", value: 1000, type: "under" },
    { label: "$1000 - $5000", min: 1000, max: 5000, type: "range" },
    { label: "$5000 - $20000", min: 5000, max: 20000, type: "range" },
    { label: "Above $20000", value: 20000, type: "above" }
  ];

  const getBudgetLabel = (opt: any) => {
    if (currency.code === 'USD') return opt.label;

    if (opt.type === "under") {
      return `${opt.label} (Under ${currency.symbol}${formatBudget(opt.value)})`;
    }
    if (opt.type === "range") {
      return `${opt.label} (${currency.symbol}${formatBudget(opt.min)} - ${currency.symbol}${formatBudget(opt.max)})`;
    }
    return `${opt.label} (Above ${currency.symbol}${formatBudget(opt.value)})`;
  };

  const timelines = ["ASAP", "1-2 months", "3-6 months", "6+ months", "Flexible"];

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 animate-in fade-in duration-500">
        <BrandLoader size="lg" />
        <p className="mt-8 text-foreground/50 tracking-widest text-sm animate-pulse">TRANSMITTING DATA SECURELY...</p>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div ref={containerRef} className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-secondary/20 p-6 border border-border">
          <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
            <Eye className="w-5 h-5" /> Review Your Inquiry
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-sm">
            <div><p className="text-foreground/50 mb-1">Name</p><p className="font-medium">{formData.name}</p></div>
            <div><p className="text-foreground/50 mb-1">Email</p><p className="font-medium">{formData.email}</p></div>
            <div><p className="text-foreground/50 mb-1">Company</p><p className="font-medium">{formData.company || "Not provided"}</p></div>
            <div><p className="text-foreground/50 mb-1">Phone</p><p className="font-medium">{formData.phone || "Not provided"}</p></div>
            <div><p className="text-foreground/50 mb-1">Service</p><p className="font-medium">{formData.service}</p></div>
            <div><p className="text-foreground/50 mb-1">Budget</p><p className="font-medium">{formData.budget || "Not provided"}</p></div>
            <div><p className="text-foreground/50 mb-1">Timeline</p><p className="font-medium">{formData.timeline || "Not provided"}</p></div>
            <div className="md:col-span-2">
              <p className="text-foreground/50 mb-1">Message</p>
              <div className="font-medium prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formData.message || "No details." }} />
            </div>
            {files.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-foreground/50 mb-2">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white px-3 py-2 border border-neutral-200 text-xs text-neutral-600">
                      <FileText className="w-3 h-3" /> {f.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {formData.issueNDA && (
              <div className="md:col-span-2">
                <p className="text-foreground/50 mb-1">NDA Status</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-green-700 font-bold uppercase tracking-widest text-[10px]">
                    <CheckCircle2 className="w-4 h-4" /> Issue NDA Requested
                  </div>
                  {ndaFile && <p className="text-neutral-600 text-[10px] font-mono whitespace-nowrap overflow-hidden text-ellipsis">FILE: {ndaFile.name}</p>}
                  {formData.ndaUrl && <p className="text-neutral-600 text-[10px] font-mono whitespace-nowrap overflow-hidden text-ellipsis">LINK: {formData.ndaUrl}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => setIsPreview(false)} className="flex-1 px-8 py-4 border border-foreground text-foreground text-sm tracking-wide hover:bg-secondary/20 transition-colors flex items-center justify-center gap-2">
            <Edit className="w-4 h-4" /> Edit Details
          </button>
          <button onClick={() => handleSubmit(null as any)} className="flex-1 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-colors flex items-center justify-center gap-2 group">
            Confirm & Send Inquiry <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="mb-12">
          <h2 className="text-4xl font-light tracking-tight mb-4 italic">Project Inquiry</h2>
          <p className="text-sm text-foreground/50 uppercase tracking-[0.2em] font-bold">Secure Briefing Portal</p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 p-4 text-red-600 text-sm">{error}</div>}
        <div className={isPopup ? "space-y-6" : "grid grid-cols-1 sm:grid-cols-2 gap-6"}>
          <div>
            <label htmlFor="name" className="block text-sm tracking-wide mb-2">Your Name *</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none" placeholder="John Smith" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm tracking-wide mb-2">Email Address *</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none" placeholder="john@company.com" />
          </div>
        </div>
        <div className={isPopup ? "space-y-6" : "grid grid-cols-1 sm:grid-cols-2 gap-6"}>
          <div>
            <label htmlFor="company" className="block text-sm tracking-wide mb-2">Company Name</label>
            <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none" placeholder="Acme Inc." />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm tracking-wide mb-2">Phone Number</label>
            <InternationalPhoneInput value={formData.phone} onChange={(val) => handleManualChange("phone", val)} />
          </div>
        </div>
        {/* Honeypot - Hidden from humans */}
        <div className="hidden" aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            value={(formData as any).website}
            onChange={handleChange}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="service" className="block text-sm tracking-wide mb-2">Service *</label>
          <select id="service" name="service" value={formData.service} onChange={handleChange} required className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none">
            <option value="">Select a service</option>
            {services.map((s, i) => <option key={i} value={s}>{s}</option>)}
          </select>
        </div>
        <div className={isPopup ? "space-y-6" : "grid grid-cols-1 sm:grid-cols-2 gap-6"}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="budget" className="text-sm tracking-wide">Expected Budget *</label>
              <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-full border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setCurrencyCode("USD")}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${currency.code === "USD" ? "bg-primary text-primary-foreground" : "text-foreground/40 hover:text-foreground"}`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrencyCode("NGN")}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${currency.code === "NGN" ? "bg-primary text-primary-foreground" : "text-foreground/40 hover:text-foreground"}`}
                >
                  NGN
                </button>
              </div>
            </div>
            <select
              id="budget"
              name="budget"
              value={formData.budget}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none"
            >
              <option value="">Select Range</option>
              {budgetOptions.map((opt, i) => (
                <option key={i} value={opt.label}>
                  {getBudgetLabel(opt)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="timeline" className="block text-sm tracking-wide mb-2">Timeline</label>
            <select id="timeline" name="timeline" value={formData.timeline} onChange={handleChange} className="w-full px-4 py-3 border border-border bg-background focus:border-foreground focus:outline-none">
              <option value="">Select timeline</option>
              {timelines.map((t, i) => <option key={i} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="message" className="block text-sm tracking-wide mb-2">Project Details *</label>
          <RichTextEditor value={formData.message} onChange={(val) => handleManualChange("message", val)} placeholder="Tell us about your project goals..." />
        </div>
        <div className="space-y-4">
          <label className="block text-sm tracking-wide">Attachments (PDF/Image)</label>
          <div onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-border bg-secondary/10 p-8 text-center cursor-pointer hover:border-foreground transition-colors">
            <Upload className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-foreground/40">Click to upload assets</p>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e)} multiple accept=".pdf,image/jpeg,image/png" className="hidden" />
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 text-xs border border-neutral-200">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button type="button" onClick={() => removeFile(index)} className="text-neutral-400 hover:text-black"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pt-4 border-t border-neutral-100">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" name="issueNDA" checked={formData.issueNDA} onChange={handleChange} className="peer h-5 w-5 appearance-none border border-border rounded-none checked:bg-primary checked:border-primary transition-all" />
            <span className="text-sm text-neutral-700 group-hover:text-black">Issue NDA</span>
          </label>
          {formData.issueNDA && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 p-4 bg-secondary/20 border border-border space-y-3">
              <div onClick={() => ndaInputRef.current?.click()} className="flex items-center justify-between bg-background px-4 py-2 border border-border cursor-pointer hover:border-foreground">
                <span className="text-xs text-neutral-500">{ndaFile ? ndaFile.name : "Upload NDA PDF"}</span>
                <Upload className="w-4 h-4 text-neutral-400" />
              </div>
              <input type="url" placeholder="Or provide NDA link" name="ndaUrl" value={formData.ndaUrl} onChange={handleChange} className="w-full p-2 text-xs border border-border bg-background outline-none focus:border-foreground" />
              <input type="file" ref={ndaInputRef} onChange={(e) => handleFileChange(e, true)} accept=".pdf" className="hidden" />
            </motion.div>
          )}
        </div>
        <button type="submit" className="w-full sm:w-auto px-10 py-4 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-colors flex items-center justify-center gap-2 group">
          Preview Inquiry <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </form>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { Send, Upload, X, Eye, Edit, FileText, CheckCircle2 } from "lucide-react";
import { InternationalPhoneInput } from "./InternationalPhoneInput";
import { RichTextEditor } from "./RichTextEditor";
import { BrandLoader } from "./BrandLoader";

interface ContactFormProps {
  onSuccess?: () => void;
}

interface FileData {
  name: string;
  size: number;
  type: string;
  file: File;
}

export function ContactForm({ onSuccess }: ContactFormProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    service: "",
    budget: "",
    timeline: "",
    message: "",
    issueNDA: false
  });

  const [files, setFiles] = useState<FileData[]>([]);
  const [ndaFile, setNdaFile] = useState<FileData | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("review") === "true") {
      setFormData(prev => ({
        ...prev,
        service: "Technical Consultation", // Closest fit or we could add a "Review" category
        message: "I would like to leave a review for CortDevs: "
      }));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPreview) {
      if (!formData.service) {
        setError("Please select a service.");
        return;
      }
      setIsPreview(true);
      return;
    }

    // Final submission
    setIsSubmitting(true);
    setError(null);

    // Prepare data
    const submissionData = {
      ...formData,
      // We'll send limited file info for now or could implement base64 if needed.
      // For this confirmation, we focus on the form fields.
      files: files.map(f => ({ name: f.name, type: f.type })),
      ndaFile: ndaFile ? { name: ndaFile.name, type: ndaFile.type } : null
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send inquiry');
      }

      if (onSuccess) {
        onSuccess();
      }

      setIsSubmitting(false);
      navigate("/success");
    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "Something went wrong. Please try again or contact us directly.");
      setIsSubmitting(false);
      setIsPreview(false); // Go back to fix it
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData({
      ...formData,
      [name]: val
    });
  };

  const handleManualChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isNDA = false) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    const processedFiles: FileData[] = [];
    let fileError = null;

    for (const file of selectedFiles) {
      if (file.size > maxSize) {
        fileError = `File ${file.name} exceeds 10MB limit.`;
        break;
      }
      if (!allowedTypes.includes(file.type)) {
        fileError = `File ${file.name} is not a PDF or regular Image.`;
        break;
      }
      processedFiles.push({
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      });
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

  const services = [
    "WordPress Development",
    "Shopify Solutions",
    "GoHighLevel Integration",
    "Custom Full-Stack Development",
    "UI/UX Design",
    "Consulting",
    "Other"
  ];

  const budgets = [
    "Under $10,000",
    "$10,000 - $25,000",
    "$25,000 - $50,000",
    "$50,000 - $100,000",
    "$100,000+"
  ];

  const timelines = [
    "ASAP",
    "1-2 months",
    "3-6 months",
    "6+ months",
    "Flexible"
  ];

  if (isSubmitting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 animate-in fade-in duration-500">
        <BrandLoader size="lg" />
        <p className="mt-8 text-neutral-500 tracking-widest text-sm animate-pulse">
          TRANSMITTING DATA SECURELY...
        </p>
      </div>
    );
  }

  if (isPreview) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="bg-neutral-50 p-6 border border-neutral-200">
          <h3 className="text-xl font-medium mb-6 flex items-center gap-2">
            <Eye className="w-5 h-5" /> Review Your Inquiry
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-sm">
            <div>
              <p className="text-neutral-500 mb-1">Name</p>
              <p className="font-medium">{formData.name}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Email</p>
              <p className="font-medium">{formData.email}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Company</p>
              <p className="font-medium">{formData.company || "Not provided"}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Phone</p>
              <p className="font-medium">{formData.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Service</p>
              <p className="font-medium">{formData.service}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Budget</p>
              <p className="font-medium">{formData.budget || "Not provided"}</p>
            </div>
            <div>
              <p className="text-neutral-500 mb-1">Timeline</p>
              <p className="font-medium">{formData.timeline || "Not provided"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-neutral-500 mb-1">Message</p>
              <div
                className="font-medium prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formData.message || "No project details provided." }}
              />
            </div>

            {files.length > 0 && (
              <div className="md:col-span-2">
                <p className="text-neutral-500 mb-2">Attached Files</p>
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
                <p className="text-neutral-500 mb-1">NDA Status</p>
                <div className="flex items-center gap-2 font-medium text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Issue NDA document requested
                  {ndaFile && <span className="text-neutral-600 text-xs ml-2">(File: {ndaFile.name})</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => setIsPreview(false)}
            className="flex-1 px-8 py-4 border border-black text-black text-sm tracking-wide hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" /> Edit Details
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-8 py-4 bg-black text-white text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 group"
          >
            Confirm & Send Inquiry
            <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm tracking-wide mb-2">
            Your Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
            placeholder="John Smith"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm tracking-wide mb-2">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
            placeholder="john@company.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="company" className="block text-sm tracking-wide mb-2">
            Company Name
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm tracking-wide mb-2">
            Phone Number (International)
          </label>
          <InternationalPhoneInput
            value={formData.phone}
            onChange={(val) => handleManualChange("phone", val)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="service" className="block text-sm tracking-wide mb-2">
          Service Interested In *
        </label>
        <select
          id="service"
          name="service"
          value={formData.service}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
        >
          <option value="">Select a service</option>
          {services.map((service, index) => (
            <option key={index} value={service}>
              {service}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="budget" className="block text-sm tracking-wide mb-2">
            Estimated Budget
          </label>
          <select
            id="budget"
            name="budget"
            value={formData.budget}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
          >
            <option value="">Select budget range</option>
            {budgets.map((budget, index) => (
              <option key={index} value={budget}>
                {budget}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="timeline" className="block text-sm tracking-wide mb-2">
            Desired Timeline
          </label>
          <select
            id="timeline"
            name="timeline"
            value={formData.timeline}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
          >
            <option value="">Select timeline</option>
            {timelines.map((timeline, index) => (
              <option key={index} value={timeline}>
                {timeline}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm tracking-wide mb-2">
          Project Details *
        </label>
        <RichTextEditor
          value={formData.message}
          onChange={(val) => handleManualChange("message", val)}
          placeholder="Tell us about your project goals..."
        />
      </div>

      <div className="space-y-4">
        <label className="block text-sm tracking-wide">
          Attachments (PDF or Image, max 10MB each)
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-neutral-300 p-8 text-center cursor-pointer hover:border-black transition-colors"
        >
          <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Click to upload or drag and drop</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileChange(e)}
            multiple
            accept=".pdf,image/jpeg,image/png"
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-neutral-100 px-3 py-1.5 text-xs">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-neutral-400 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-neutral-100">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              name="issueNDA"
              checked={formData.issueNDA}
              onChange={handleChange}
              className="peer h-5 w-5 cursor-pointer appearance-none border border-neutral-300 hover:border-black checked:bg-black checked:border-black transition-all"
            />
            <CheckCircle2 className="absolute w-5 h-5 text-white scale-0 peer-checked:scale-75 transition-transform" />
          </div>
          <span className="text-sm text-neutral-700 group-hover:text-black transition-colors">
            Issue NDA document (Earn our trust)
          </span>
        </label>

        {formData.issueNDA && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 p-4 bg-neutral-50 border border-neutral-200 space-y-3"
          >
            <p className="text-xs text-neutral-600 leading-relaxed">
              We value your privacy. If you have an NDA document you'd like us to sign first,
              please upload it here or let us know and we'll send ours.
            </p>
            <div
              onClick={() => ndaInputRef.current?.click()}
              className="flex items-center justify-between bg-white px-4 py-2 border border-neutral-300 cursor-pointer hover:border-black"
            >
              <span className="text-xs text-neutral-500">
                {ndaFile ? ndaFile.name : "Upload NDA document (optional)"}
              </span>
              <Upload className="w-4 h-4 text-neutral-400" />
            </div>
            <input
              type="file"
              ref={ndaInputRef}
              onChange={(e) => handleFileChange(e, true)}
              accept=".pdf,image/jpeg,image/png"
              className="hidden"
            />
          </motion.div>
        )}
      </div>

      <button
        type="submit"
        className="w-full sm:w-auto px-10 py-4 bg-black text-white text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 group"
      >
        Preview Inquiry
        <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
      </button>

      <p className="text-xs text-neutral-500 leading-relaxed">
        By continuing, you agree to our privacy policy. Your information is
        encrypted and securely handled.
      </p>
    </form>
  );
}

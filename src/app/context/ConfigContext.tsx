import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface BrandingConfig {
    headerLogo: string;
    footerLogo: string;
    favicon: string;
    siteTitle: string;
    metaDescription: string;
    maintenanceMode: boolean;
}

interface ConfigContextType {
    config: BrandingConfig;
    updateConfig: (newConfig: Partial<BrandingConfig>) => Promise<void>;
    isLoading: boolean;
    getAbstractUrl: (url: string) => string;
    currency: {
        code: string;
        symbol: string;
        rate: number; // USD to target rate
    };
    setCurrencyCode: (code: "USD" | "NGN") => void;
    setMaintenanceMode: (enabled: boolean) => Promise<void>;
    isNigerian: boolean;
}

const defaultConfig: BrandingConfig = {
    headerLogo: '/logo-dark.svg', // Fallback defaults
    footerLogo: '/logo-light.svg',
    favicon: '/favicon.ico',
    siteTitle: 'CortDevs | Premium Web Solutions',
    metaDescription: 'Crafting digital excellence through innovative web solutions. Transforming visions into powerful, scalable digital experiences.',
    maintenanceMode: false,
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<BrandingConfig>(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);
    const [currency, setCurrency] = useState({ code: "USD", symbol: "$", rate: 1 });
    const [isNigerian, setIsNigerian] = useState(false);

    useEffect(() => {
        const initGeoAndCurrency = async () => {
            // Hardcoded exchange rate fallback (USD to NGN ~1600 as a placeholder)
            const fallbackRate = 1600;
            try {
                // Fetch Geo and Currency meta
                const geoRes = await fetch("https://ipapi.co/json/");
                const geoData = await geoRes.json();

                const inNG = geoData.country_code === 'NG';
                setIsNigerian(inNG);

                const response = await fetch("https://api.frankfurter.app/latest?from=USD&to=NGN");
                const data = await response.json();
                const rate = data.rates?.NGN || fallbackRate;

                // Check local storage for preference
                const saved = localStorage.getItem("pref_currency") as "USD" | "NGN";
                if (saved === "NGN" || (inNG && !saved)) {
                    setCurrency({ code: "NGN", symbol: "₦", rate });
                } else {
                    setCurrency({ code: "USD", symbol: "$", rate });
                }
            } catch (err) {
                console.error("Geo/Currency init failed:", err);
                setCurrency({ code: "USD", symbol: "$", rate: fallbackRate });
            }
        };
        initGeoAndCurrency();
    }, []);

    const setCurrencyCode = (code: "USD" | "NGN") => {
        localStorage.setItem("pref_currency", code);
        setCurrency(prev => ({
            ...prev,
            code,
            symbol: code === "NGN" ? "₦" : "$"
        }));
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const { data, error } = await supabase
                    .from('site_config')
                    .select('*')
                    .eq('id', 'main')
                    .single();

                if (error) throw error;
                if (data) {
                    setConfig({
                        headerLogo: data.header_logo,
                        footerLogo: data.footer_logo,
                        favicon: data.favicon,
                        siteTitle: data.site_title,
                        metaDescription: data.meta_description,
                        maintenanceMode: data.maintenance_mode || false
                    });
                }
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to fetch config from Supabase:', error);
                setIsLoading(false);
            }
        };

        fetchConfig();
    }, []);

    // Apply branding to DOM
    useEffect(() => {
        if (!config) return;

        // Update Title
        if (config.siteTitle) {
            document.title = config.siteTitle;
        }

        // Update Favicon
        if (config.favicon) {
            let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = config.favicon;

            // Also update apple-touch-icon if it exists or create it
            let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
            if (!appleLink) {
                appleLink = document.createElement('link');
                appleLink.rel = 'apple-touch-icon';
                document.getElementsByTagName('head')[0].appendChild(appleLink);
            }
            appleLink.href = config.favicon;
        }

        // Update Meta Description
        if (config.metaDescription) {
            let meta = document.querySelector('meta[name="description"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('name', 'description');
                document.getElementsByTagName('head')[0].appendChild(meta);
            }
            meta.setAttribute('content', config.metaDescription);
        }
    }, [config]);

    const updateConfig = async (newConfig: Partial<BrandingConfig>) => {
        const updated = { ...config, ...newConfig };
        setConfig(updated);

        try {
            const { error } = await supabase
                .from('site_config')
                .update({
                    header_logo: updated.headerLogo,
                    footer_logo: updated.footerLogo,
                    favicon: updated.favicon,
                    site_title: updated.siteTitle,
                    meta_description: updated.metaDescription,
                    maintenance_mode: updated.maintenanceMode,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'main');

            if (error) throw error;
        } catch (error) {
            console.error('Failed to persist config to Supabase:', error);
            throw error;
        }
    };

    const setMaintenanceMode = async (enabled: boolean) => {
        await updateConfig({ maintenanceMode: enabled });
    };

    const getAbstractUrl = (url: string) => {
        if (!url) return "";
        try {
            // If it's a supabase URL, extract the filename
            if (url.includes("supabase.co") && url.includes("/assets/")) {
                const parts = url.split("/");
                return `/${parts[parts.length - 1]}`;
            }
            // For local paths already starting with /
            if (url.startsWith("/")) return url;
            // Otherwise return last segment if it looks like a path
            if (url.includes("/")) {
                const parts = url.split("/");
                return `/${parts[parts.length - 1]}`;
            }
            return url;
        } catch (e) {
            return url;
        }
    };

    return (
        <ConfigContext.Provider value={{
            config,
            updateConfig,
            isLoading,
            getAbstractUrl,
            currency,
            setCurrencyCode,
            setMaintenanceMode,
            isNigerian
        }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface BrandingConfig {
    headerLogo: string;
    footerLogo: string;
    favicon: string;
    siteTitle: string;
    metaDescription: string;
}

interface ConfigContextType {
    config: BrandingConfig;
    updateConfig: (newConfig: Partial<BrandingConfig>) => Promise<void>;
    isLoading: boolean;
}

const defaultConfig: BrandingConfig = {
    headerLogo: '/logo-dark.svg', // Fallback defaults
    footerLogo: '/logo-light.svg',
    favicon: '/favicon.ico',
    siteTitle: 'CortDevs | Premium Web Solutions',
    metaDescription: 'Crafting digital excellence through innovative web solutions. Transforming visions into powerful, scalable digital experiences.',
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<BrandingConfig>(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);

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
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'main');

            if (error) throw error;
        } catch (error) {
            console.error('Failed to persist config to Supabase:', error);
            throw error;
        }
    };

    return (
        <ConfigContext.Provider value={{ config, updateConfig, isLoading }}>
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

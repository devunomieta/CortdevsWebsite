import React, { createContext, useContext, useState, useEffect } from 'react';

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

    // In a real implementation, we would fetch this from Supabase
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Simulating fetch for now
                // const { data } = await supabase.from('site_config').select('*').single();
                // if (data) setConfig(data);
                setIsLoading(false);
            } catch (error) {
                console.error('Failed to fetch config:', error);
                setIsLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const updateConfig = async (newConfig: Partial<BrandingConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
        // Logic to persist to Supabase would go here
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

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className="pointer-events-auto"
                        >
                            <div className={`
                flex items-center gap-4 p-5 pr-12 min-w-[320px] max-w-md
                bg-white border text-sm shadow-2xl relative overflow-hidden
                ${toast.type === 'success' ? 'border-l-4 border-l-green-500 border-neutral-200' : ''}
                ${toast.type === 'error' ? 'border-l-4 border-l-red-500 border-neutral-200' : ''}
                ${toast.type === 'info' ? 'border-l-4 border-l-blue-500 border-neutral-200' : ''}
                ${toast.type === 'warning' ? 'border-l-4 border-l-orange-500 border-neutral-200' : ''}
              `}>
                                <div className={`
                  ${toast.type === 'success' ? 'text-green-500' : ''}
                  ${toast.type === 'error' ? 'text-red-500' : ''}
                  ${toast.type === 'info' ? 'text-blue-500' : ''}
                  ${toast.type === 'warning' ? 'text-orange-500' : ''}
                `}>
                                    {toast.type === 'success' && <CheckCircle2 size={24} />}
                                    {toast.type === 'error' && <AlertCircle size={24} />}
                                    {toast.type === 'info' && <Info size={24} />}
                                    {toast.type === 'warning' && <AlertTriangle size={24} />}
                                </div>

                                <div className="flex-1">
                                    <p className="font-bold uppercase tracking-widest text-[10px] text-neutral-400 mb-1">System Notification</p>
                                    <p className="text-black font-medium leading-relaxed">{toast.message}</p>
                                </div>

                                <button
                                    onClick={() => removeToast(toast.id)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-black transition-colors"
                                >
                                    <X size={16} />
                                </button>

                                {/* Progress bar */}
                                <motion.div
                                    initial={{ width: '100%' }}
                                    animate={{ width: '0%' }}
                                    transition={{ duration: 5, ease: 'linear' }}
                                    className={`absolute bottom-0 left-0 h-0.5 opacity-30
                    ${toast.type === 'success' ? 'bg-green-500' : ''}
                    ${toast.type === 'error' ? 'bg-red-500' : ''}
                    ${toast.type === 'info' ? 'bg-blue-500' : ''}
                    ${toast.type === 'warning' ? 'bg-orange-500' : ''}
                  `}
                                />
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

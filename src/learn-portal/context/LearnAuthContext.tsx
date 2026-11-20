import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { learnApi } from '../lib/api';
import {
    clearLearnSessionTimer,
    isLearnSessionExpired,
    resetLearnSessionTimer,
} from '../lib/sessionTimer';

export interface LearnEnrollment {
    id: string;
    cohort_id: string;
    user_id: string;
    email: string;
    full_name: string;
    job_role: string;
    role: 'learner' | 'admin';
    timezone: string;
    reminder_hour: number;
    weekend_reminders: boolean;
    email_paused_until: string | null;
    weekly_commitment_hours: number;
    onboarding_completed: boolean;
    current_streak: number;
    longest_streak: number;
    last_active_at: string | null;
}

export interface LearnCohort {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    start_date: string;
    target_end_date: string;
    pacing_mode: 'weekly_drip_sequential' | 'self_paced_sequential';
    drip_unlock_hour: number;
    project_gate_mode: 'submit_to_unlock' | 'approve_to_unlock';
}

interface LearnAuthContextValue {
    loading: boolean;
    user: any | null;
    enrollment: LearnEnrollment | null;
    cohort: LearnCohort | null;
    authError: string | null;
    isAdmin: boolean;
    refreshProfile: () => Promise<void>;
    signOut: () => Promise<void>;
}

const LearnAuthContext = createContext<LearnAuthContextValue>({
    loading: true,
    user: null,
    enrollment: null,
    cohort: null,
    authError: null,
    isAdmin: false,
    refreshProfile: async () => {},
    signOut: async () => {},
});

export function LearnAuthProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any | null>(null);
    const [enrollment, setEnrollment] = useState<LearnEnrollment | null>(null);
    const [cohort, setCohort] = useState<LearnCohort | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    const loadProfile = useCallback(async (currentUser: any | null) => {
        if (!currentUser) {
            setEnrollment(null);
            setCohort(null);
            setAuthError(null);
            setLoading(false);
            return;
        }

        if (isLearnSessionExpired()) {
            clearLearnSessionTimer();
            await supabase.auth.signOut();
            setUser(null);
            setEnrollment(null);
            setCohort(null);
            setAuthError(null);
            setLoading(false);
            return;
        }

        try {
            const res = await learnApi<{ enrollment: LearnEnrollment; cohort: LearnCohort }>('lms/profile');
            setEnrollment(res.enrollment);
            setCohort(res.cohort);
            setAuthError(null);
        } catch (err: any) {
            setEnrollment(null);
            setCohort(null);
            setAuthError(err?.message || 'Unable to load account profile.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!active) return;
            const u = session?.user ?? null;
            if (u && isLearnSessionExpired()) {
                clearLearnSessionTimer();
                await supabase.auth.signOut();
                if (!active) return;
                setUser(null);
                setEnrollment(null);
                setCohort(null);
                setLoading(false);
                return;
            }
            setUser(u);
            loadProfile(u);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                resetLearnSessionTimer();
            } else if (event === 'SIGNED_OUT') {
                clearLearnSessionTimer();
            }
            const u = session?.user ?? null;
            setUser(u);
            loadProfile(u);
        });

        const onVisibility = async () => {
            if (document.visibilityState === 'visible' && isLearnSessionExpired()) {
                const { data } = await supabase.auth.getSession();
                if (data.session) {
                    clearLearnSessionTimer();
                    await supabase.auth.signOut();
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            active = false;
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [loadProfile]);

    const refreshProfile = useCallback(async () => {
        if (user) await loadProfile(user);
    }, [user, loadProfile]);

    const signOut = useCallback(async () => {
        clearLearnSessionTimer();
        await supabase.auth.signOut();
        setUser(null);
        setEnrollment(null);
        setCohort(null);
    }, []);

    return (
        <LearnAuthContext.Provider
            value={{
                loading,
                user,
                enrollment,
                cohort,
                authError,
                isAdmin: enrollment?.role === 'admin',
                refreshProfile,
                signOut,
            }}
        >
            {children}
        </LearnAuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLearnAuth() {
    return useContext(LearnAuthContext);
}

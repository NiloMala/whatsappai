import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { checkAndDisconnectExpiredUser } from '@/services/instanceService';

interface TrialStatus {
  isActive: boolean;
  isExpired: boolean;
  expiresAt: Date | null;
  daysRemaining: number;
  loading: boolean;
  isInGracePeriod: boolean;
  gracePeriodDaysRemaining: number;
  isPaidPlan: boolean;
}

export const useTrialCheck = () => {
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isActive: true,
    isExpired: false,
    expiresAt: null,
    daysRemaining: 0,
    loading: true,
    isInGracePeriod: false,
    gracePeriodDaysRemaining: 0,
    isPaidPlan: false,
  });

  useEffect(() => {
    checkTrialStatus();
  }, []);

  const checkTrialStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTrialStatus({
          isActive: false,
          isExpired: true,
          expiresAt: null,
          daysRemaining: 0,
          loading: false,
          isInGracePeriod: false,
          gracePeriodDaysRemaining: 0,
          isPaidPlan: false,
        });
        return;
      }

      // Get user's plan
      const { data: userPlan, error } = await supabase
        .from('user_plans')
        .select('trial_expires_at, expires_at, status')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user plan:', error);
        setTrialStatus(prev => ({ ...prev, loading: false }));
        return;
      }

      // No plan found - user needs to set up trial
      if (!userPlan) {
        setTrialStatus({
          isActive: false,
          isExpired: false,
          expiresAt: null,
          daysRemaining: 0,
          loading: false,
          isInGracePeriod: false,
          gracePeriodDaysRemaining: 0,
          isPaidPlan: false,
        });
        return;
      }

      const now = new Date();
      const GRACE_PERIOD_DAYS = 3;
      const isPaidPlan = !userPlan.trial_expires_at && !!userPlan.expires_at;

      // Check if trial exists and is expired
      if (userPlan.trial_expires_at) {
        const expiresAt = new Date(userPlan.trial_expires_at);
        const isExpired = now > expiresAt;
        const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        // If expired, disconnect all instances (no grace period for trial)
        if (isExpired) {
          console.log('Trial expired - disconnecting instances');
          await checkAndDisconnectExpiredUser(user.id);
        }

        setTrialStatus({
          isActive: !isExpired && userPlan.status === 'active',
          isExpired,
          expiresAt,
          daysRemaining,
          loading: false,
          isInGracePeriod: false,
          gracePeriodDaysRemaining: 0,
          isPaidPlan: false,
        });
      } else if (userPlan.expires_at) {
        // Paid plan - check expiration with grace period
        const expiresAt = new Date(userPlan.expires_at);
        const isExpiredNow = now > expiresAt;
        const gracePeriodEnd = new Date(expiresAt);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);
        const isExpiredPastGrace = now > gracePeriodEnd;

        const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const gracePeriodDaysRemaining = isExpiredNow ? Math.max(0, Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
        const isInGracePeriod = isExpiredNow && !isExpiredPastGrace;

        // If expired past grace period or canceled, disconnect instances
        if (isExpiredPastGrace || userPlan.status === 'canceled') {
          console.log('Paid plan expired (past grace period) - disconnecting instances');
          await checkAndDisconnectExpiredUser(user.id);
        }

        setTrialStatus({
          isActive: userPlan.status === 'active' && !isExpiredPastGrace,
          isExpired: isExpiredPastGrace,
          expiresAt,
          daysRemaining,
          loading: false,
          isInGracePeriod,
          gracePeriodDaysRemaining,
          isPaidPlan: true,
        });
      } else {
        // No trial and no paid plan - inactive
        const isActive = userPlan.status === 'active';

        setTrialStatus({
          isActive,
          isExpired: !isActive,
          expiresAt: null,
          daysRemaining: 0,
          loading: false,
          isInGracePeriod: false,
          gracePeriodDaysRemaining: 0,
          isPaidPlan: false,
        });
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
      setTrialStatus(prev => ({ ...prev, loading: false }));
    }
  };

  return { ...trialStatus, refetch: checkTrialStatus };
};

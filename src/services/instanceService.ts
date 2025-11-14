import { supabase } from '@/integrations/supabase/client';

const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL || 'https://evo.planetcode.app.br';
const EVOLUTION_GLOBAL_API_KEY = import.meta.env.VITE_EVOLUTION_GLOBAL_API_KEY || '';

interface DisconnectResult {
  success: boolean;
  instanceName: string;
  error?: string;
}

/**
 * Disconnect a specific WhatsApp instance from Evolution API
 */
export const disconnectInstance = async (instanceName: string, instanceToken: string): Promise<DisconnectResult> => {
  try {
    console.log(`Attempting to disconnect instance: ${instanceName}`);

    // Logout the instance (disconnect from WhatsApp)
    const logoutResponse = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken, // Use instance-specific token instead of global key
      },
    });

    if (!logoutResponse.ok) {
      const errorText = await logoutResponse.text();
      console.error(`Failed to logout instance ${instanceName}:`, errorText);
      return {
        success: false,
        instanceName,
        error: `Logout failed: ${errorText}`,
      };
    }

    console.log(`Successfully disconnected instance: ${instanceName}`);

    return {
      success: true,
      instanceName,
    };
  } catch (error: any) {
    console.error(`Error disconnecting instance ${instanceName}:`, error);
    return {
      success: false,
      instanceName,
      error: error.message || 'Unknown error',
    };
  }
};

/**
 * Disconnect all WhatsApp instances for a specific user
 */
export const disconnectUserInstances = async (userId: string): Promise<DisconnectResult[]> => {
  try {
    console.log(`Disconnecting all instances for user: ${userId}`);

    // Get all instances for this user (including instance_token)
    const { data: instances, error } = await supabase
      .from('whatsapp_connections')
      .select('instance_key, instance_token, status')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user instances:', error);
      return [];
    }

    if (!instances || instances.length === 0) {
      console.log(`No instances found for user: ${userId}`);
      return [];
    }

    console.log(`Found ${instances.length} instances for user ${userId}`);

    // Disconnect each instance
    const results: DisconnectResult[] = [];
    for (const instance of instances) {
      // Only disconnect if currently connected
      if (instance.status === 'connected' || instance.status === 'open') {
        const result = await disconnectInstance(instance.instance_key, instance.instance_token);
        results.push(result);

        // Update status in database
        if (result.success) {
          await supabase
            .from('whatsapp_connections')
            .update({ status: 'disconnected' })
            .eq('instance_key', instance.instance_key);
        }
      } else {
        console.log(`Skipping instance ${instance.instance_key} - status: ${instance.status}`);
      }
    }

    return results;
  } catch (error: any) {
    console.error('Error disconnecting user instances:', error);
    return [];
  }
};

/**
 * Check if user's plan is expired and disconnect instances if needed
 * Includes 3-day grace period for paid plans
 */
export const checkAndDisconnectExpiredUser = async (userId: string): Promise<boolean> => {
  try {
    // Check user's plan status
    const { data: userPlan, error } = await supabase
      .from('user_plans')
      .select('trial_expires_at, expires_at, status')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user plan:', error);
      return false;
    }

    if (!userPlan) {
      console.log(`No plan found for user ${userId}`);
      return false;
    }

    const now = new Date();
    const GRACE_PERIOD_DAYS = 3;
    let isExpired = false;

    // Check trial expiration (no grace period for trial)
    if (userPlan.trial_expires_at) {
      const trialExpiresAt = new Date(userPlan.trial_expires_at);
      if (now > trialExpiresAt) {
        console.log(`Trial expired for user ${userId}`);
        isExpired = true;
      }
    }

    // Check subscription expiration (with grace period for paid plans)
    if (userPlan.expires_at && !userPlan.trial_expires_at) {
      const expiresAt = new Date(userPlan.expires_at);
      const gracePeriodEnd = new Date(expiresAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

      if (now > gracePeriodEnd) {
        console.log(`Subscription expired (past grace period) for user ${userId}`);
        isExpired = true;
      }
    }

    // Check if status is not active (canceled/past_due without grace period)
    if (userPlan.status === 'canceled') {
      console.log(`Plan canceled for user ${userId}`);
      isExpired = true;
    }

    // If expired, disconnect all instances
    if (isExpired) {
      console.log(`Disconnecting all instances for expired user: ${userId}`);
      const results = await disconnectUserInstances(userId);
      console.log(`Disconnection results:`, results);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('Error checking and disconnecting expired user:', error);
    return false;
  }
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  name: string;
  subscription_status: string;
  role?: string;
}

interface CurrentPlan {
  id: number | null;
  name: string | null;
  display_name: string | null;
}

interface SubscribedTool {
  tool_name: string;
  tool_display_name: string;
  subscribed_at: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  subscriptionStatus: string | null;
  trialDaysRemaining: number | null;
  currentPlan: CurrentPlan | null;
  integrations: Array<{ id: number; type: string; name: string; is_active: boolean }>;
  subscribedTools: SubscribedTool[];
  loginTime: string | null;
  setAuth: (token: string, user: User, subscriptionStatus: string, trialDaysRemaining?: number, subscribedTools?: SubscribedTool[], loginTime?: string) => void;
  setIntegrations: (integrations: Array<{ id: number; type: string; name: string; is_active: boolean }>) => void;
  setSubscribedTools: (tools: SubscribedTool[]) => void;
  logout: () => void;
  updateSubscriptionStatus: (status: string, trialDays?: number, plan?: CurrentPlan | null) => void;
  checkAutoLogout: () => boolean; // Returns true if should logout
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      subscriptionStatus: null,
      trialDaysRemaining: null,
      currentPlan: null,
      integrations: [],
      subscribedTools: [],
      loginTime: null,
      setAuth: (token, user, subscriptionStatus, trialDaysRemaining, subscribedTools, loginTime) =>
        set({
          token,
          user,
          isAuthenticated: true,
          subscriptionStatus,
          trialDaysRemaining: trialDaysRemaining || null,
          subscribedTools: subscribedTools || [],
          loginTime: loginTime || null,
        }),
      setIntegrations: (integrations) => set({ integrations }),
      setSubscribedTools: (tools) => set({ subscribedTools: tools }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          subscriptionStatus: null,
          trialDaysRemaining: null,
          currentPlan: null,
          integrations: [],
          subscribedTools: [],
          loginTime: null,
        }),
      updateSubscriptionStatus: (status, trialDays, plan) =>
        set({
          subscriptionStatus: status,
          trialDaysRemaining: trialDays || null,
          currentPlan: plan || null,
        }),
      checkAutoLogout: () => {
        const state = get();
        if (!state.loginTime || !state.isAuthenticated) return false;
        
        const loginTime = new Date(state.loginTime);
        const now = new Date();
        const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        
        // Auto-logout after 8 hours
        if (hoursSinceLogin >= 8) {
          get().logout();
          return true;
        }
        return false;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);


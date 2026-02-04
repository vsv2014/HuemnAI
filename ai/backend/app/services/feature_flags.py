from typing import Dict, Optional
import hashlib

class FeatureFlagService:
    _instance = None
    _flags: Dict[str, bool] = {
        "ENABLE_MULTI_MODEL": True,
        "ENABLE_VOICE_RECORDER": True,
        "ENABLE_PROMETHEUS": True,
        "ENABLE_STT_PIPELINE": True,
        "BETA_AGENTS": False,
        "NEW_UI_LAYOUT": False, # Example for A/B testing
    }
    _rollout_percentages: Dict[str, int] = {
        "BETA_AGENTS": 10, # 10% of users
        "NEW_UI_LAYOUT": 50 # 50% of users
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FeatureFlagService, cls).__new__(cls)
        return cls._instance

    def get_all_flags(self) -> Dict[str, bool]:
        return self._flags

    def is_enabled(self, flag_name: str) -> bool:
        """Global check for a flag."""
        return self._flags.get(flag_name, False)

    def is_enabled_for_user(self, flag_name: str, user_id: str) -> bool:
        """
        Check if a flag is enabled for a specific user.
        Supports percentage-based rollouts (A/B testing).
        """
        # 1. Check global override first if explicitly True? 
        # Actually, usually flags are False by default and turned on for percentage.
        # But if the global flag is True, everyone gets it.
        if self._flags.get(flag_name, False):
            return True

        # 2. Check rollout percentage
        percentage = self._rollout_percentages.get(flag_name, 0)
        if percentage <= 0:
            return False
        if percentage >= 100:
            return True

        # 3. Deterministic hash for A/B testing stability
        # Hash user_id + flag_name to get a consistent number between 0-99
        hash_input = f"{user_id}:{flag_name}".encode('utf-8')
        hash_val = int(hashlib.sha256(hash_input).hexdigest(), 16)
        user_bucket = hash_val % 100

        return user_bucket < percentage

    def set_flag(self, flag_name: str, enabled: bool):
        self._flags[flag_name] = enabled

    def set_rollout_percentage(self, flag_name: str, percentage: int):
        if 0 <= percentage <= 100:
            self._rollout_percentages[flag_name] = percentage
        else:
            raise ValueError("Percentage must be between 0 and 100")

feature_flag_service = FeatureFlagService()

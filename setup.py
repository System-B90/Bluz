import os
import secrets
from dataclasses import dataclass, field
from typing import Callable, Dict, Optional, Set
from urllib.parse import urlparse

import dotenv
import cutie
from tqdm import tqdm

GeneratorFunc = Callable[[], str]


# --- Built-in Validation Functions ---
def validate_url(url: str) -> bool:
    """Validates that a string is a properly formatted URL."""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False


def validate_mongodb_uri(uri: str) -> bool:
    """Validates a basic MongoDB connection string."""
    return uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")


# --- Helper Functions ---
def generate_crypto_key() -> str:
    return secrets.token_hex(32)


@dataclass(frozen=True)
class EnvKey:
    name: str
    description: str = ""
    default_value: Optional[str] = None
    required: bool = True
    is_secret: bool = False
    auto_generated: Optional[GeneratorFunc] = None
    validator: Optional[Callable[[str], bool]] = None
    validator_error_msg: str = "Invalid format."


@dataclass
class EnvKeys:
    required: Set[EnvKey] = field(default_factory=set)
    optional: Set[EnvKey] = field(default_factory=set)


class Env:
    USER_KEYS = EnvKeys(
        required={
            EnvKey(
                name="NEXT_PUBLIC_HIVE_URL",
                description="URL for the Hive API",
                default_value="http://localhost:8000",
                validator=validate_url,
                validator_error_msg="Must be a valid URL (e.g., http://localhost:8000)",
            ),
            EnvKey(name="HIVE_USERNAME", description="Your Hive admin username"),
            EnvKey(
                name="HIVE_PASSWORD",
                description="Your Hive admin password",
                is_secret=True,
            ),
            EnvKey(
                name="MONGO_CONNECTION_STRING",
                description="MongoDB URI",
                default_value="mongodb://localhost:27017/bluz",
                validator=validate_mongodb_uri,
                validator_error_msg="Must start with mongodb:// or mongodb+srv://",
            ),
        },
        optional={
            EnvKey(
                name="NODE_TLS_REJECT_UNAUTHORIZED",
                description="Reject unauthorized TLS",
                default_value="0",
                required=False,
            ),
        },
    )

    SYSTEM_KEYS = EnvKeys(
        required={
            EnvKey(
                name="JWT_SECRET",
                description="Secret for JWT signing",
                auto_generated=generate_crypto_key,
            ),
            EnvKey(
                name="SYM_ENC_KEY",
                description="Symmetric encryption key",
                auto_generated=generate_crypto_key,
            ),
            EnvKey(
                name="WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY",
                description="WS Auth Key",
                auto_generated=generate_crypto_key,
            ),
            EnvKey(
                name="HIVE_CLIENT_ID",
                description="Internal Hive Client ID",
                auto_generated=lambda: secrets.token_urlsafe(16),
            ),
            EnvKey(
                name="HIVE_CLIENT_SECRET",
                description="Internal Hive Client Secret",
                auto_generated=lambda: secrets.token_urlsafe(32),
            ),
            EnvKey(
                name="NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST",
                description="WS Host",
                default_value="ws://localhost:8080",
                validator=validate_url,
                validator_error_msg="Must be a valid WebSocket URL (e.g., ws://localhost:8080)",
            ),
        }
    )

    def __init__(self, env_path: str = ".env") -> None:
        self.env_path = env_path
        self._values = self._get_existing_env_file_data()

    def _get_existing_env_file_data(self) -> Dict[str, str]:
        if not os.path.exists(self.env_path):
            return {}
        return {
            k: v
            for k, v in dotenv.dotenv_values(self.env_path).items()
            if v is not None
        }

    def _save_silent(self) -> None:
        """Writes the configuration to the .env file continuously."""
        with open(self.env_path, "w") as f:
            for k, v in self._values.items():
                f.write(f"{k}={v}\n")

    def process_keys(self) -> None:
        """Prompts for user keys and auto-generates system keys."""
        # Calculate tasks purely based on what the user needs to input
        total_tasks = len(self.USER_KEYS.required) + len(self.USER_KEYS.optional)

        print("\n👤 --- User Configuration ---")
        with tqdm(
            total=total_tasks,
            desc="Input Progress",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]",
        ) as pbar:

            # 1. Handle Required User Keys
            for key in self.USER_KEYS.required:
                self._handle_key(key, prompt_user=True)
                pbar.update(1)

            # 2. Handle Optional User Keys
            for key in self.USER_KEYS.optional:
                self._handle_key(key, prompt_user=True)
                pbar.update(1)

        # 3. Handle System Keys (Outside the progress bar)
        print("\n🤖 --- Generating System Keys ---")
        for key in self.SYSTEM_KEYS.required:
            self._handle_key(key, prompt_user=False)

        for key in self.SYSTEM_KEYS.optional:
            self._handle_key(key, prompt_user=False)

    def _handle_key(self, key: EnvKey, prompt_user: bool) -> None:
        existing_value = self._values.get(key.name)

        # Handle System Auto-Generation
        if key.auto_generated:
            if not existing_value:
                print(f"✨ Generating new {key.name}...")
                self._values[key.name] = key.auto_generated()
                self._save_silent()
            else:
                print(f"✅ [{key.name}] already exists. Retaining current secret.")
            return

        # Handle User Inputs
        if prompt_user:
            fallback = existing_value if existing_value else key.default_value
            icon = "🔒" if key.is_secret else "🔑"

            prompt_text = f"\n{icon} {key.name} ({key.description})"
            if fallback:
                prompt_text += f"\n   [Press Enter to keep: {fallback}]: "
            else:
                # Dynamically set wording based on whether the key is required or optional
                prompt_text += (
                    "\n   [Required]: "
                    if key.required
                    else "\n   [Optional, press Enter to skip]: "
                )

            while True:
                if key.is_secret:
                    # Extract the first 3 characters so formatting isn't mangled by cutie
                    print(prompt_text[:3], end="", flush=True)
                    user_input = cutie.secure_input(prompt_text[3:])
                else:
                    user_input = input(prompt_text)

                # Apply fallback if user presses Enter
                if not user_input and fallback:
                    user_input = fallback

                # Check required constraint
                if not user_input:
                    if key.required:
                        print(
                            f"⚠️  Error: {key.name} is required. Please provide a value."
                        )
                        continue
                    else:
                        # If it's optional and they hit Enter with no fallback, just skip saving it
                        break

                # Run validation if a validator is attached
                if user_input and key.validator and not key.validator(user_input):
                    print(f"❌ Error: {key.validator_error_msg}")
                    continue

                self._values[key.name] = user_input
                self._save_silent()
                break

    def finish(self) -> None:
        print(f"\n💾 Configuration saved to {self.env_path}...")
        print("🎉 Done! Your Bluz instance is configured.")


def main() -> None:
    print("====================================")
    print("  🚀 Welcome to Bluz Setup 🚀  ")
    print("====================================")

    env = Env()
    env.process_keys()
    env.finish()


if __name__ == "__main__":
    main()

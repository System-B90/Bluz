"""
Name: test_setup_ai.py
Purpose: Tests the setup wizard's AI questions: provider-specific keys and the
         private-CA option for internal gateways (#780).
Created: 2026-10-02
Author: Michael K. Steinberg
"""

import pytest
import setup
from fake_wizard import FakeWizard


def test_openai_provider_asks_base_url_and_key_not_openrouter() -> None:
    w = FakeWizard(
        answers={"AI_PROVIDER": "openai", "OPENAI_BASE_URL": "https://webui/api"},
        confirms=[True, False],
    )
    setup._ask_ai(w)  # type: ignore[arg-type]
    assert "OPENAI_BASE_URL" in w.asked
    assert "OPENAI_API_KEY" in w.asked
    assert "OPENROUTER_API_KEY" not in w.asked
    assert "AI_CA_CERT_PATH" not in w.asked


def test_private_ca_defaults_to_the_mounted_path(
    capsys: pytest.CaptureFixture[str],
) -> None:
    w = FakeWizard(answers={"AI_PROVIDER": "openai"}, confirms=[True, True])
    setup._ask_ai(w)  # type: ignore[arg-type]
    assert (
        w.values["AI_CA_CERT_PATH"]
        == setup.AI_CA_DEFAULT_PATH
        == "/etc/bluz/ai-ca/ca.pem"
    )
    assert "ai-ca/ca.pem" in capsys.readouterr().out


def test_openrouter_keeps_its_own_key() -> None:
    w = FakeWizard(answers={}, confirms=[True, False])
    setup._ask_ai(w)  # type: ignore[arg-type]
    assert "OPENROUTER_API_KEY" in w.asked
    assert "OPENAI_BASE_URL" not in w.asked


def test_declining_ai_asks_nothing() -> None:
    w = FakeWizard(answers={}, confirms=[False])
    setup._ask_ai(w)  # type: ignore[arg-type]
    assert w.asked == []


def test_no_private_ca_clears_a_stale_path() -> None:
    w = FakeWizard(answers={"AI_PROVIDER": "openai"}, confirms=[True, False])
    w.values["AI_CA_CERT_PATH"] = setup.AI_CA_DEFAULT_PATH
    setup._ask_ai(w)  # type: ignore[arg-type]
    assert w.values["AI_CA_CERT_PATH"] == ""

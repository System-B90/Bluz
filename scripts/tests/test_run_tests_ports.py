"""
Name: test_run_tests_ports.py
Purpose: Regression tests for E2E host-port allocation avoiding Windows
         reserved TCP ranges ("ports are not available ... 500" under WSL).
Created: 2026-09-29
Author: Michael K. Steinberg
"""

import subprocess
from types import SimpleNamespace
from typing import Self

import pytest
import run_tests

NETSH_OUTPUT = """
Protocol tcp Port Exclusion Ranges

Start Port    End Port
----------    --------
      5985        5985
     50000       50059
     50160       50259     *

* - Administered port exclusions.
"""


class FakeSocket:
    """Stands in for socket.socket, handing out ports from a fixed sequence."""

    def __init__(self, ports: list[int]) -> None:
        self._ports = ports
        self._port = 0

    def __call__(self, *_args: object) -> Self:
        return self

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def bind(self, _address: tuple[str, int]) -> None:
        self._port = self._ports.pop(0)

    def getsockname(self) -> tuple[str, int]:
        return ("127.0.0.3", self._port)


def fake_ports(monkeypatch: pytest.MonkeyPatch, ports: list[int]) -> None:
    monkeypatch.setattr(run_tests.socket, "socket", FakeSocket(ports))


def test_parses_netsh_ranges() -> None:
    assert run_tests.parse_excluded_port_ranges(NETSH_OUTPUT) == [
        (5985, 5985),
        (50000, 50059),
        (50160, 50259),
    ]


def test_parse_ignores_headers_and_footers() -> None:
    assert (
        run_tests.parse_excluded_port_ranges("Start Port    End Port\n---\n* - x") == []
    )


def test_parse_empty_output() -> None:
    assert run_tests.parse_excluded_port_ranges("") == []


def test_skips_a_port_inside_an_excluded_range(monkeypatch: pytest.MonkeyPatch) -> None:
    # 50167 is the port that failed CI run 36622854432.
    fake_ports(monkeypatch, [50167, 41000])
    assert run_tests.find_free_port(excluded=[(50160, 50259)]) == 41000


def test_skips_range_boundaries(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [50160, 50259, 50260])
    assert run_tests.find_free_port(excluded=[(50160, 50259)]) == 50260


def test_accepts_a_port_outside_every_range(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [45000])
    assert run_tests.find_free_port(excluded=[(50160, 50259), (5985, 5985)]) == 45000


def test_never_hands_out_the_same_port_twice(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [41000, 41000, 41001])
    taken: set[int] = set()
    first = run_tests.find_free_port(taken=taken)
    second = run_tests.find_free_port(taken=taken)
    assert (first, second) == (41000, 41001)


def test_records_the_port_it_returns(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [41000])
    taken: set[int] = set()
    run_tests.find_free_port(taken=taken)
    assert taken == {41000}


def test_gives_up_after_the_attempt_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [50167] * 5)
    with pytest.raises(RuntimeError, match="No usable free port"):
        run_tests.find_free_port(excluded=[(50160, 50259)], attempts=5)


def test_without_exclusions_behaves_as_before(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_ports(monkeypatch, [50167])
    assert run_tests.find_free_port() == 50167


def test_real_socket_returns_a_bindable_port() -> None:
    port = run_tests.find_free_port(ip="127.0.0.1")
    assert 0 < port < 65536


def test_reads_ranges_from_netsh(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(cmd: list[str], **_kwargs: object) -> SimpleNamespace:
        assert cmd[0] == "netsh.exe"
        assert "excludedportrange" in cmd
        return SimpleNamespace(stdout=NETSH_OUTPUT, returncode=0)

    monkeypatch.setattr(run_tests.subprocess, "run", fake_run)
    assert (50160, 50259) in run_tests.windows_excluded_port_ranges()


def test_no_ranges_when_netsh_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(*_args: object, **_kwargs: object) -> None:
        raise FileNotFoundError("netsh.exe")

    monkeypatch.setattr(run_tests.subprocess, "run", fake_run)
    assert run_tests.windows_excluded_port_ranges() == []


def test_no_ranges_when_netsh_hangs(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(*_args: object, **_kwargs: object) -> None:
        raise subprocess.TimeoutExpired("netsh.exe", 10)

    monkeypatch.setattr(run_tests.subprocess, "run", fake_run)
    assert run_tests.windows_excluded_port_ranges() == []


def test_no_ranges_when_netsh_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        run_tests.subprocess,
        "run",
        lambda *_a, **_k: SimpleNamespace(stdout="", returncode=1),
    )
    assert run_tests.windows_excluded_port_ranges() == []


DOCKER_PORT_ERROR = (
    "Error response from daemon: ports are not available: exposing port TCP "
    "127.0.0.3:41788 -> 127.0.0.1:0: /forwards/expose returned unexpected status: 500"
)


def test_recognises_docker_desktop_port_refusal() -> None:
    assert run_tests.is_port_unavailable_error(DOCKER_PORT_ERROR)


def test_other_compose_failures_are_not_retried() -> None:
    assert not run_tests.is_port_unavailable_error("Error: no such image: bluz-ui")
    assert not run_tests.is_port_unavailable_error("")


def test_retries_are_bounded() -> None:
    assert run_tests.PORT_ATTEMPTS > 1


def test_compose_down_targets_the_test_stack(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    def fake_run(cmd: list[str], **kwargs: object) -> SimpleNamespace:
        calls.append(cmd)
        assert kwargs["check"] is False
        return SimpleNamespace(returncode=1)

    monkeypatch.setattr(subprocess, "run", fake_run)
    run_tests.compose_down("bluz-test-x", {})
    assert calls == [
        [
            "docker",
            "compose",
            "-p",
            "bluz-test-x",
            "-f",
            "deploy/docker-compose.yml",
            "-f",
            "deploy/docker-compose.test.yml",
            "down",
            "-v",
        ]
    ]

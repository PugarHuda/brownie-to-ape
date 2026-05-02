"""
Pytest suite for scripts/migrate_config.py — using Describe* class-based
naming convention per docs/TESTING_PROMPT.md §2.

Equivalent semantics to tests/test_migrate_config.py (unittest version);
this file is the modern pytest variant. Both can run via `pytest tests/`.
"""

import sys
from pathlib import Path

# Make scripts/ importable
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import pytest

# pyyaml is required by migrate_config; if missing, skip the whole file
yaml = pytest.importorskip("yaml")

from scripts.migrate_config import translate  # noqa: E402


class DescribeTranslate:
    """describe(translate) — top-level translator function."""

    class DescribePositiveCases:
        def test_default_network_moves_to_ethereum_default_network(self):
            cfg = {"networks": {"default": "development"}}
            ape, todos = translate(cfg)
            assert ape["ethereum"]["default_network"] == "development"
            assert todos == []

        def test_named_networks_become_ethereum_entries(self):
            cfg = {"networks": {"mainnet": {}, "sepolia": {}}}
            ape, _ = translate(cfg)
            assert "mainnet" in ape["ethereum"]
            assert "sepolia" in ape["ethereum"]

        def test_solc_version_moves_to_solidity_version(self):
            cfg = {"compiler": {"solc": {"version": "0.8.20"}}}
            ape, _ = translate(cfg)
            assert ape["solidity"]["version"] == "0.8.20"

        def test_solc_remappings_moves_to_solidity_remappings(self):
            cfg = {"compiler": {"solc": {"remappings": ["@oz=node_modules/@openzeppelin"]}}}
            ape, _ = translate(cfg)
            assert ape["solidity"]["remappings"] == ["@oz=node_modules/@openzeppelin"]

        def test_optimizer_enabled_becomes_optimize_bool(self):
            cfg = {"compiler": {"solc": {"optimizer": {"enabled": True}}}}
            ape, _ = translate(cfg)
            assert ape["solidity"]["optimize"] is True

        def test_well_formed_dependency_parsed_to_struct(self):
            cfg = {"dependencies": ["smartcontractkit/chainlink-brownie-contracts@1.0.0"]}
            ape, todos = translate(cfg)
            assert ape["dependencies"][0]["github"] == "smartcontractkit/chainlink-brownie-contracts"
            assert ape["dependencies"][0]["version"] == "1.0.0"
            assert todos == []

        def test_dotenv_passthrough(self):
            cfg = {"dotenv": ".env"}
            ape, _ = translate(cfg)
            assert ape["dotenv"] == ".env"

    class DescribeNegativeCases:
        def test_empty_dict_returns_empty_ape_config_with_no_todos(self):
            ape, todos = translate({})
            assert ape == {}
            assert todos == []

        def test_dependency_without_org_emits_todo(self):
            cfg = {"dependencies": ["lone-name@1.0.0"]}
            _ape, todos = translate(cfg)
            assert any("missing org/repo" in t for t in todos)

        def test_dependency_without_version_emits_todo(self):
            cfg = {"dependencies": ["smartcontractkit/some-pkg"]}
            _ape, todos = translate(cfg)
            assert any("not parseable" in t for t in todos)

        def test_wallets_section_emits_todo(self):
            cfg = {"wallets": {"from_key": "${PRIVATE_KEY}"}}
            _ape, todos = translate(cfg)
            assert any("wallets" in t.lower() for t in todos)

        def test_unknown_section_emits_todo(self):
            cfg = {"my_custom_field": "value"}
            _ape, todos = translate(cfg)
            assert any("my_custom_field" in t for t in todos)

        def test_cmd_settings_emits_todo(self):
            cfg = {"networks": {"development": {"cmd_settings": {"port": 8545}}}}
            _ape, todos = translate(cfg)
            assert any("cmd_settings" in t for t in todos)

    class DescribeEdgeCases:
        def test_handles_none_networks_gracefully(self):
            cfg = {"networks": None}
            ape, todos = translate(cfg)
            # None should not crash; behaves as if absent.
            assert isinstance(ape, dict)
            assert isinstance(todos, list)

        def test_handles_non_string_dependency_entry(self):
            cfg = {"dependencies": [123, None, "valid/repo@1.0.0"]}
            _ape, todos = translate(cfg)
            # Non-string entries should produce TODOs, not crashes.
            assert any("not parseable" in t for t in todos)

        def test_handles_deeply_nested_unknown_section(self):
            cfg = {"deeply": {"nested": {"and": {"unknown": True}}}}
            _ape, todos = translate(cfg)
            assert any("deeply" in t for t in todos)

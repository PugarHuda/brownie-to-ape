"""
Unit tests for scripts/migrate_config.py — the Brownie -> Ape config
converter.

Run:
    python -m pytest tests/test_migrate_config.py -v
or:
    python tests/test_migrate_config.py
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Make scripts/ importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

# noinspection PyUnresolvedReferences
import migrate_config  # type: ignore[import-not-found]


class TranslateNetworks(unittest.TestCase):
    def test_default_network_moved_to_ethereum(self):
        ape, todos = migrate_config.translate({"networks": {"default": "development"}})
        self.assertEqual(ape["ethereum"]["default_network"], "development")
        self.assertEqual(todos, [])

    def test_named_networks_become_ethereum_entries(self):
        ape, _ = migrate_config.translate({
            "networks": {
                "default": "mainnet",
                "mainnet": {"verify": True},
                "sepolia": {"verify": False},
            },
        })
        self.assertIn("mainnet", ape["ethereum"])
        self.assertIn("sepolia", ape["ethereum"])

    def test_cmd_settings_emits_todo(self):
        _, todos = migrate_config.translate({
            "networks": {
                "ganache": {"cmd_settings": {"port": 8545}},
            },
        })
        self.assertTrue(any("cmd_settings" in t for t in todos))


class TranslateCompiler(unittest.TestCase):
    def test_solc_version_moves_to_solidity(self):
        ape, _ = migrate_config.translate({
            "compiler": {"solc": {"version": "0.8.20"}},
        })
        self.assertEqual(ape["solidity"]["version"], "0.8.20")

    def test_solc_remappings_moves_to_solidity(self):
        ape, _ = migrate_config.translate({
            "compiler": {"solc": {"remappings": ["@oz=openzeppelin@4.9.0"]}},
        })
        self.assertEqual(ape["solidity"]["remappings"], ["@oz=openzeppelin@4.9.0"])

    def test_optimizer_enabled_becomes_optimize_bool(self):
        ape, _ = migrate_config.translate({
            "compiler": {"solc": {"optimizer": {"enabled": False}}},
        })
        self.assertEqual(ape["solidity"]["optimize"], False)


class TranslateDependencies(unittest.TestCase):
    def test_well_formed_dep_parsed(self):
        ape, todos = migrate_config.translate({
            "dependencies": ["smartcontractkit/chainlink-brownie-contracts@1.0.0"],
        })
        self.assertEqual(len(ape["dependencies"]), 1)
        d = ape["dependencies"][0]
        self.assertEqual(d["name"], "chainlink-brownie-contracts")
        self.assertEqual(d["github"], "smartcontractkit/chainlink-brownie-contracts")
        self.assertEqual(d["version"], "1.0.0")
        self.assertEqual(todos, [])

    def test_dep_without_version_emits_todo(self):
        _, todos = migrate_config.translate({"dependencies": ["foo/bar"]})
        self.assertTrue(any("not parseable" in t for t in todos))

    def test_dep_without_org_emits_todo(self):
        _, todos = migrate_config.translate({"dependencies": ["bar@1.0.0"]})
        self.assertTrue(any("missing org/repo" in t for t in todos))


class TranslateWallets(unittest.TestCase):
    def test_wallets_section_emits_todo(self):
        _, todos = migrate_config.translate({"wallets": {"from_key": "${PRIVATE_KEY}"}})
        self.assertTrue(any("ape accounts import" in t for t in todos))


class TranslateDotenv(unittest.TestCase):
    def test_dotenv_passthrough(self):
        ape, _ = migrate_config.translate({"dotenv": ".env"})
        self.assertEqual(ape["dotenv"], ".env")


class TranslateUnknownKeys(unittest.TestCase):
    def test_unknown_section_emits_todo(self):
        _, todos = migrate_config.translate({"some_custom_key": "value"})
        self.assertTrue(any("unknown section" in t for t in todos))


class TranslateEmptyConfig(unittest.TestCase):
    def test_empty_dict_returns_empty(self):
        ape, todos = migrate_config.translate({})
        self.assertEqual(ape, {})
        self.assertEqual(todos, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)

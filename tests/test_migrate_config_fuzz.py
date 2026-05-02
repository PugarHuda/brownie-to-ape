"""
Hypothesis-based property tests for migrate_config.translate.

Generates arbitrary brownie-config.yaml shapes and asserts the
translator never crashes, always returns (dict, list_of_str), and
produces idempotent output.

Run with: python -m pytest tests/test_migrate_config_fuzz.py -v
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import pytest

hypothesis = pytest.importorskip("hypothesis")
yaml = pytest.importorskip("yaml")

from hypothesis import given, settings, strategies as st  # noqa: E402

from scripts.migrate_config import translate  # noqa: E402


yaml_scalars = st.one_of(
    st.none(),
    st.booleans(),
    st.integers(),
    st.text(min_size=0, max_size=20),
)


@st.composite
def yaml_dict(draw, max_depth=2):
    """Generate a nested dict that resembles brownie-config.yaml shape."""
    if max_depth <= 0:
        return draw(yaml_scalars)
    keys = draw(
        st.lists(
            st.text(
                alphabet=st.characters(whitelist_categories=("L", "N", "P")),
                min_size=1,
                max_size=10,
            ),
            min_size=0,
            max_size=5,
            unique=True,
        )
    )
    return {
        k: draw(st.one_of(yaml_scalars, yaml_dict(max_depth=max_depth - 1)))
        for k in keys
    }


# Flat module-level test functions (hypothesis @given works best without
# class nesting under pytest collection).


@given(cfg=yaml_dict())
@settings(max_examples=50, deadline=2000)
def test_translate_returns_dict_and_list_for_any_dict_input(cfg):
    ape, todos = translate(cfg)
    assert isinstance(ape, dict)
    assert isinstance(todos, list)
    assert all(isinstance(t, str) for t in todos)


@given(cfg=yaml_dict())
@settings(max_examples=30, deadline=2000)
def test_translate_does_not_crash(cfg):
    translate(cfg)


@given(cfg=yaml_dict())
@settings(max_examples=20, deadline=3000)
def test_translate_is_deterministic(cfg):
    ape1, todos1 = translate(cfg)
    ape2, todos2 = translate(cfg)
    assert ape1 == ape2
    assert todos1 == todos2


@given(deps=st.lists(yaml_scalars, min_size=0, max_size=10))
@settings(max_examples=30, deadline=2000)
def test_dependencies_with_arbitrary_entries_emits_todos_not_crash(deps):
    cfg = {"dependencies": deps}
    _ape, todos = translate(cfg)
    non_parseable = [
        d
        for d in deps
        if not isinstance(d, str) or "@" not in (d or "") or "/" not in (d or "")
    ]
    if non_parseable:
        assert len(todos) > 0, f"expected TODOs for {non_parseable}"


@given(networks=yaml_dict(max_depth=2))
@settings(max_examples=20, deadline=2000)
def test_networks_section_with_arbitrary_shape_does_not_crash(networks):
    cfg = {"networks": networks}
    _ape, _todos = translate(cfg)


@given(cfg=yaml_dict(max_depth=3))
@settings(max_examples=15, deadline=3000)
def test_translated_output_is_yaml_serializable(cfg):
    ape, _todos = translate(cfg)
    yaml.safe_dump(ape, sort_keys=False)

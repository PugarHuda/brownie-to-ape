// Type definitions for jssg ast-grep API.
//
// The official jssg runtime exposes a TypeScript-compatible API but
// without exported `.d.ts` types. This file documents the subset we
// rely on, so editor / IDE tooling can give better hints when working
// on `scripts/codemod.ts`. Not used at runtime.

declare module "codemod:ast-grep" {
  /**
   * The top-level codemod function. Receives a parsed source root and
   * returns either:
   * - `string` — the rewritten source
   * - `null` — no changes (codemod skipped this file)
   */
  export type Codemod<L = unknown> = (
    root: SgRoot<L>,
  ) => Promise<string | null>;

  export interface SgRoot<L = unknown> {
    root(): SgNode;
  }

  export interface SgNode {
    text(): string;
    kind(): string;
    parent(): SgNode | null;
    children(): SgNode[];
    field(name: string): SgNode | null;
    findAll(query: { rule: SgRule }): SgNode[];
    find(query: { rule: SgRule }): SgNode | null;
    replace(text: string): Edit;
    commitEdits(edits: Edit[]): string;
  }

  export interface SgRule {
    kind?: string;
    pattern?: string;
    regex?: string;
    has?: SgRule | { field?: string; kind?: string; regex?: string; has?: SgRule };
    inside?: SgRule;
    not?: SgRule;
    all?: SgRule[];
    any?: SgRule[];
    field?: string;
  }

  export interface Edit {
    // Opaque — produced by node.replace(...) and consumed by commitEdits().
    readonly __edit: unique symbol;
  }
}

declare module "codemod:ast-grep/langs/python" {
  /** Brand for Python language. Used as a type parameter on Codemod<Python>. */
  type Python = { readonly __pythonLanguageBrand: unique symbol };
  export default Python;
}

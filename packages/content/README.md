# @quiz/content

**Responsibility:** Everything around quiz data - legacy import, validation, versioned
packages, and the hotfix overlay. Knows nothing about game rules or the network.

| File | Responsibility |
|---|---|
| `validate.ts` | strict two-stage validation plus pool coverage per mode/preset/slot |
| `package.ts` | read source, build package, load package, safe asset path resolution |
| `hotfix.ts` | patches as an overlay over the base package, change report, mismatch warning |
| `report.ts` | human-readable validation and build report |
| `legacy/parseLiteral.ts` | safe parser for JS object literals - executes nothing |
| `legacy/migrate.ts` | mapping of legacy data to the new question model plus correction report |
| `paths.ts` | project paths (`content/source`, `content/dist`, `runtime`) |
| `cli/` | `content:fetch`, `content:validate`, `content:build`, `content:migrate`, `content:assets` |

**Dependencies:** `@quiz/contracts` (schemas), `@quiz/domain` (slot filters and
repeat keys for pool analysis), `zod`, Node filesystem.

**Security:** `resolveAssetPath` ensures file paths from quiz data never
resolve outside the asset directory. The legacy parser uses neither `eval`
nor `vm`.

Details: [docs/inhalte-import.md](../../docs/inhalte-import.md) and
[docs/quizpaket.md](../../docs/quizpaket.md).

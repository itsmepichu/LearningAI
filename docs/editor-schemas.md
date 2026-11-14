# Editor hints for content files

`schemas/` holds JSON Schemas for the content files. They give autocompletion, hover text and inline warnings in the
editor. Nothing runs them: no script, build or test reads them, and the data files carry no `$schema` key, because the
code iterates over their keys.

| File | Schema |
|---|---|
| `src/content/manifest.json` | `schemas/manifest.schema.json` |
| `src/content/practice/*.json` | `schemas/practice.schema.json` |
| `src/content/checks/c*.json` | `schemas/checks.schema.json` |
| `src/content/glossary.json` | `schemas/glossary.schema.json` |
| `src/content/projects.json` | `schemas/projects.schema.json` |

## VS Code

Nothing to do: `.vscode/settings.json` maps the schemas by file path.

## JetBrains IDEs (WebStorm, IntelliJ IDEA)

1. Open **Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings**.
2. Click **+** and add a mapping for each row of the table: pick the schema file, choose **JSON Schema version 7**, then add the data file or folder with **+** (for `practice` and `checks` add the folder `src/content/practice` or `src/content/checks`).
3. For `checks`, leave `legacy-quiz-map.json` unmapped; it has a different shape.

When a data file's shape changes, update its schema in the same commit.

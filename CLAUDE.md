# CLAUDE.md

The engineering rules for this repository live in AGENTS.md and apply to every Claude session:

@AGENTS.md

## Documentation rule

Every change updates the documentation it affects **in the same commit**: routes, schema, pipeline, models, infrastructure, local setup, environment variables or rules. [AGENTS.md](AGENTS.md) §3 maps each kind of change to its document, and [docs/README.md](docs/README.md) lists all documents. Before committing, check that every doc you touched still matches the code. A change without its doc update is not finished.

# DLD Pipeline

The pipeline fetches DLD snapshots, loads only complete snapshots into DuckDB,
validates the loaded tables, and exports market metrics as JSON.

Set the required `DATA_DUBAI_*` values in `.env`, then run a complete area pipeline:

```sh
python -m dld run --area "Business Bay"
```

To build the complete Dubai warehouse for 2018–2026, use the resumable command:

```sh
.venv312/bin/python -m dld sync-full-dubai --start-year 2018 --end-year 2026
```

It retrieves all API pages for citywide transactions and rent contracts, the
current complete project catalogue (including off-plan and completed statuses),
and service charges. A shared on-disk limiter spaces all DLD requests by at
least 1.1 seconds, even when separate history commands are running together.
Raw snapshots are loaded only after their manifest records them as complete.

Use `python -m dld --help` for individual fetch, load, validate, and metrics commands.
Commands return a non-zero exit code when API requests fail, a request exceeds
the 1,000-page safety cap, or validation rejects a suspicious share of rows. Recreate the virtual
environment with `python3.12 -m venv .venv312` and install dependencies with
`.venv312/bin/python -m pip install -r requirements.txt` if its original directory was moved.

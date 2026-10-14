# Experiment log

Every training or evaluation run that informs a decision gets a row. Rows are appended by
`python scripts/train.py --log` or by hand from `artifacts/runs/<run_id>/metadata.json`.
Synthetic smoke runs exist only to prove the pipeline; their losses mean nothing and they
must never be cited as results.

## Run directory layout

`artifacts/runs/<run_id>/` (git-ignored): `config.toml` (exact config), `metadata.json`,
`checkpoint.pt` (model + optimizer + step + model spec), `history.jsonl` (step, loss).

`metadata.json` keys: `run_id`, `created_at`, `git_sha`, `git_dirty`, `seed`,
`data_source`, `data_note`, `split_hash` (`synthetic` for smoke runs, else the
KS-DATA-08 split hash), `finding_profile`, `findings`, `planes`,
`preprocessing_version`, `preprocessing_sha256`, `model_spec`, `steps_completed`,
`final_loss`, `checkpoint_sha256`, `torch_version`, `hardware`.

A test partition is evaluated at most once per served checkpoint (KS-EVAL-03). Record
here every time a test partition is touched.

## Runs

| Run ID | Data | Git SHA | Seed | Split hash | Preprocessing | Checkpoint SHA | Hardware | Note |
|---|---|---|---|---|---|---|---|---|

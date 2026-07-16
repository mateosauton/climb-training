# Video training data

Only footage with documented download, commercial-use, derivative, and model-training rights may enter a trainable dataset. Public availability is not permission.

## Registered dataset

`the-way-up-zenodo-15196867` is the initial dataset. Zenodo publishes it under CC BY 4.0 with an immutable DOI and an MD5 checksum for its 20,889,661,515-byte `dataset.zip` artifact. The registry preserves creators, attribution, privacy review, split policy, and takedown handling in [`data/video-training/datasets.json`](../data/video-training/datasets.json).

CC BY 4.0 requires appropriate credit, a license link, and an indication of changes. Keep the registry attribution in dataset manifests, model cards, and evaluation reports. Treat pose and movement data as person data: do not identify participants or use the dataset for biometric profiling.

The dataset is appropriate for evaluation and targeted pose/hold-contact work. It is not enough to train an 8B vision-language model from scratch. Before extraction, assign participant and route groups so neither crosses training, validation, or test splits.

## Verify provenance without downloading video

```sh
node scripts/verify-video-dataset.mjs
node scripts/fetch-video-dataset.mjs the-way-up-zenodo-15196867
```

Both commands compare the registry with current Zenodo metadata. The second command reports the artifact but does not download it unless `--download` is supplied.

## Explicit, resumable download

The archive needs about 21 GB before extraction. Review the license and available disk space, then run:

```sh
node scripts/fetch-video-dataset.mjs the-way-up-zenodo-15196867 --download
```

An interrupted transfer remains as `dataset.zip.part` and resumes with an HTTP range request. A server that ignores ranges causes a safe restart rather than corrupt append. The script checks both the exact registered size and Zenodo checksum before renaming the file. Downloads live under the ignored `data/video-training/downloads/` directory and must not be committed.

## Exclusions

- AscendMotion/ClimbingCap requires separate commercial licensing.
- CIMI4D documents scientific-purpose participant permission, not commercial-training rights.
- Standard-license YouTube and other social-media footage is not reusable merely because it is viewable.
- Unknown-license footage remains metadata-only.
- Athlete uploads are excluded by default. Analysis consent is not training consent; training requires a separate explicit opt-in and withdrawal path.

Record every transformation and derived artifact in a versioned manifest. A rights or takedown notice must quarantine affected assets, stop new training jobs, and trigger rebuilding affected dataset versions.

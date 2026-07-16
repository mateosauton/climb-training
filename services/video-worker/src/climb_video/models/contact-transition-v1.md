# Contact transition prior v1.0.0

Small class-balanced logistic prior used only to rank candidate evidence windows. It does not identify climbers or produce coaching conclusions.

- Dataset: The Way Up, DOI `10.5281/zenodo.15196867`, CC BY 4.0.
- Attribution: “The Way Up: A Dataset for Hold Usage Detection in Sport Climbing,” Anna Maschek and David C. Schedl.
- Inputs: `log1p(blur)`, exposure quality, and `log1p(frame motion)` at 1 fps.
- Labels: hold-contact starts or ends within 0.75 seconds of a sampled frame.
- Split: participant-disjoint; 7 train, 1 validation, 2 test groups. Repeated `p2a`/`p2b` sessions remain in one group.
- Samples: 1,165 train, 170 validation, 224 test.
- Held-out test: ROC AUC 0.6466, average precision 0.9633, F1 0.9652 at the validation-selected threshold.

The high positive prevalence makes F1 and average precision optimistic; ROC AUC shows only modest ranking power. The prior must remain one signal in deterministic evidence selection, not a contact classifier or safety decision. The artifact contains aggregate metrics and learned parameters only—no demographics, images, identities, or participant-level outputs.

Training transformation: standard-resolution 25 fps videos were sampled at 1 fps, frame-quality/motion features were derived with OpenCV, and published hold-use start/end annotations supplied transition labels. Source archive checksum: `md5:a46cbca826a7f28ab591a4900ce5a1c9`.

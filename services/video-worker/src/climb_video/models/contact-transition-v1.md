# Contact transition prior v1.0.0

Small class-balanced logistic prior used only to rank candidate evidence windows. It does not identify climbers or produce coaching conclusions.

- Dataset: The Way Up, DOI `10.5281/zenodo.15196867`, CC BY 4.0.
- Attribution: “The Way Up: A Dataset for Hold Usage Detection in Sport Climbing,” Anna Maschek and David C. Schedl.
- Inputs: `log1p(blur)`, exposure quality, and `log1p(frame motion)` at 1 fps.
- Labels: hold-contact starts within 0.5 seconds of a sampled frame.
- Split: participant-disjoint; 7 train, 1 validation, 2 test groups. Repeated `p2a`/`p2b` sessions remain in one group.
- Samples: 1,165 train, 170 validation, 224 test.
- Held-out test (150 positive / 74 negative): ROC AUC 0.5340, average precision 0.7119, balanced accuracy 0.5034, precision 0.6712, recall 0.9933, and F1 0.8011 at the validation-selected threshold.

The positive prevalence makes F1 and average precision optimistic; ROC AUC is only marginally above random and validation ROC AUC was 0.4739. This experiment did not meet the production gate of validation ROC AUC and balanced accuracy both at or above 0.55, so the worker does not load it and falls back to deterministic motion ranking. The artifact remains packaged for reproducibility and future comparison; it is not a contact classifier or safety decision. It contains aggregate metrics and learned parameters only—no demographics, images, identities, or participant-level outputs.

Training transformation: standard-resolution 25 fps videos were sampled at 1 fps, frame-quality/motion features were derived with OpenCV, and published hold-use start/end annotations supplied transition labels. Source archive checksum: `md5:a46cbca826a7f28ab591a4900ce5a1c9`.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertDownloadAuthorized,
  buildResumePlan,
  verifyDownloadedArtifact,
} from "./fetch-video-dataset.mjs";
import {
  validateRegistry,
  verifyZenodoMetadata,
} from "./verify-video-dataset.mjs";

const registryUrl = new URL(
  "../data/video-training/datasets.json",
  import.meta.url,
);

const validZenodoMetadata = {
  id: 15196867,
  doi: "10.5281/zenodo.15196867",
  metadata: {
    creators: [
      {
        name: "Maschek, Anna",
        affiliation: "University of Applied Sciences Upper Austria",
      },
      {
        name: "Schedl, David",
        affiliation: "University of Applied Sciences Upper Austria",
      },
    ],
    license: { id: "cc-by-4.0" },
  },
  files: [
    {
      key: "dataset.zip",
      size: 20_889_661_515,
      checksum: "md5:a46cbca826a7f28ab591a4900ce5a1c9",
      links: {
        self: "https://zenodo.org/api/records/15196867/files/dataset.zip/content",
      },
    },
  ],
};

async function loadRegistry() {
  return JSON.parse(await readFile(registryUrl, "utf8"));
}

test("registry records all rights, provenance, privacy, split, and takedown fields", async () => {
  const registry = await loadRegistry();
  assert.deepEqual(validateRegistry(registry), []);

  const dataset = registry.datasets.find(
    ({ id }) => id === "the-way-up-zenodo-15196867",
  );
  assert.ok(dataset);
  assert.equal(dataset.license.spdx, "CC-BY-4.0");
  assert.equal(dataset.permissions.commercialUse, true);
  assert.equal(dataset.permissions.derivatives, true);
  assert.equal(dataset.permissions.modelTraining, true);
  assert.equal(dataset.artifact.checksum.algorithm, "md5");
  assert.match(dataset.artifact.checksum.value, /^[a-f0-9]{32}$/);
  assert.equal(dataset.privacy.consentReview.status, "documented-by-publisher");
  assert.equal(dataset.takedown.state, "active");
});

test("registry excludes sources without verified commercial training rights", async () => {
  const registry = await loadRegistry();
  const exclusions = new Map(
    registry.excludedSources.map((source) => [source.id, source]),
  );

  for (const id of [
    "ascendmotion",
    "cimi4d",
    "youtube-standard-license",
    "unknown-license-footage",
  ]) {
    assert.equal(exclusions.get(id)?.permissions.modelTraining, false);
    assert.equal(exclusions.get(id)?.eligibleForCommercialTraining, false);
    assert.ok(exclusions.get(id)?.reason);
  }
  assert.equal(registry.athleteUploads.trainingDefault, "excluded");
  assert.equal(registry.athleteUploads.requiresSeparateExplicitOptIn, true);
});

test("Zenodo verifier matches immutable artifact metadata without downloading it", async () => {
  const registry = await loadRegistry();
  const dataset = registry.datasets[0];

  assert.deepEqual(verifyZenodoMetadata(dataset, validZenodoMetadata), []);

  const changed = structuredClone(validZenodoMetadata);
  changed.files[0].checksum = "md5:00000000000000000000000000000000";
  assert.match(
    verifyZenodoMetadata(dataset, changed).join("\n"),
    /checksum/i,
  );
});

test("registry rejects permissive claims without supporting provenance", async () => {
  const registry = await loadRegistry();
  const invalid = structuredClone(registry);
  invalid.datasets[0].source.doi = "";
  invalid.datasets[0].privacy.consentReview.status = "not-reviewed";

  const errors = validateRegistry(invalid).join("\n");
  assert.match(errors, /doi/i);
  assert.match(errors, /consent/i);
});

test("download requires explicit authorization and resumes only a valid partial", () => {
  assert.throws(() => assertDownloadAuthorized(false), /--download/);
  assert.doesNotThrow(() => assertDownloadAuthorized(true));

  assert.deepEqual(buildResumePlan(3, 6), {
    append: true,
    headers: { Range: "bytes=3-" },
  });
  assert.deepEqual(buildResumePlan(0, 6), {
    append: false,
    headers: {},
  });
  assert.throws(() => buildResumePlan(7, 6), /larger/i);
});

test("download verifier enforces both registered size and checksum", async () => {
  const directory = await mkdtemp(join(tmpdir(), "climb-video-data-"));
  const artifactPath = join(directory, "fixture.bin");
  await writeFile(artifactPath, "licensed");

  try {
    const artifact = {
      sizeBytes: 8,
      checksum: {
        algorithm: "md5",
        value: "6995420741efff5002b5b60686fa7a55",
      },
    };
    assert.deepEqual(await verifyDownloadedArtifact(artifactPath, artifact), []);
    assert.match(
      (
        await verifyDownloadedArtifact(artifactPath, {
          ...artifact,
          checksum: { ...artifact.checksum, value: "0".repeat(32) },
        })
      ).join("\n"),
      /checksum/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

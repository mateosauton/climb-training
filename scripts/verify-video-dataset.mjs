import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const registryUrl = new URL(
  "../data/video-training/datasets.json",
  import.meta.url,
);

const requiredDatasetPaths = [
  "source.url",
  "source.metadataUrl",
  "source.paperUrl",
  "source.doi",
  "source.publisher",
  "source.creators",
  "source.retrievedAt",
  "license.spdx",
  "license.url",
  "permissions.commercialUse",
  "permissions.derivatives",
  "permissions.modelTraining",
  "artifact.fileName",
  "artifact.sizeBytes",
  "artifact.checksum.algorithm",
  "artifact.checksum.value",
  "splitPolicy.rule",
  "attribution.text",
  "privacy.consentReview.status",
  "takedown.state",
];

function valueAtPath(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

export function validateRegistry(registry) {
  const errors = [];
  if (registry?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!Array.isArray(registry?.datasets) || registry.datasets.length === 0) {
    errors.push("datasets must contain at least one registered dataset");
    return errors;
  }

  for (const dataset of registry.datasets) {
    const label = dataset.id || "unnamed dataset";
    for (const path of requiredDatasetPaths) {
      const value = valueAtPath(dataset, path);
      if (value === undefined || value === null || value === "") {
        errors.push(`${label}: missing ${path}`);
      }
    }
    if (!Array.isArray(dataset.source?.creators) || !dataset.source.creators.length) {
      errors.push(`${label}: source.creators must not be empty`);
    }
    if (dataset.eligibleForCommercialTraining) {
      for (const permission of [
        "download",
        "commercialUse",
        "derivatives",
        "modelTraining",
      ]) {
        if (dataset.permissions?.[permission] !== true) {
          errors.push(`${label}: commercial dataset requires ${permission}`);
        }
      }
      if (dataset.privacy?.consentReview?.status === "not-reviewed") {
        errors.push(`${label}: consent and privacy review is required`);
      }
    }
    const checksum = dataset.artifact?.checksum;
    if (checksum?.algorithm !== "md5" || !/^[a-f0-9]{32}$/.test(checksum?.value ?? "")) {
      errors.push(`${label}: checksum must be the exact lowercase Zenodo md5`);
    }
  }

  for (const source of registry.excludedSources ?? []) {
    if (
      source.eligibleForCommercialTraining !== false ||
      source.permissions?.modelTraining !== false ||
      !source.reason
    ) {
      errors.push(`${source.id || "excluded source"}: exclusion is incomplete`);
    }
  }
  if (
    registry.athleteUploads?.trainingDefault !== "excluded" ||
    registry.athleteUploads?.requiresSeparateExplicitOptIn !== true
  ) {
    errors.push("athlete uploads must be excluded without separate explicit opt-in");
  }
  return errors;
}

export function verifyZenodoMetadata(dataset, metadata) {
  const errors = [];
  if (String(metadata.id) !== dataset.source.metadataUrl.split("/").at(-1)) {
    errors.push("Zenodo record ID does not match the registry");
  }
  if (metadata.doi !== dataset.source.doi) errors.push("Zenodo DOI does not match");
  if (metadata.metadata?.license?.id?.toLowerCase() !== "cc-by-4.0") {
    errors.push("Zenodo license is not CC BY 4.0");
  }

  const registeredCreators = dataset.source.creators.map(({ name }) => name).sort();
  const remoteCreators = (metadata.metadata?.creators ?? [])
    .map(({ name }) => name)
    .sort();
  if (JSON.stringify(registeredCreators) !== JSON.stringify(remoteCreators)) {
    errors.push("Zenodo creators do not match the registry");
  }

  const artifact = (metadata.files ?? []).find(
    ({ key }) => key === dataset.artifact.fileName,
  );
  if (!artifact) return [...errors, "Zenodo artifact is missing"];
  if (artifact.size !== dataset.artifact.sizeBytes) {
    errors.push("Zenodo artifact size does not match");
  }
  const expectedChecksum = `${dataset.artifact.checksum.algorithm}:${dataset.artifact.checksum.value}`;
  if (artifact.checksum !== expectedChecksum) {
    errors.push("Zenodo artifact checksum does not match");
  }
  if (artifact.links?.self !== dataset.artifact.downloadUrl) {
    errors.push("Zenodo artifact download URL does not match");
  }
  return errors;
}

export async function checksumFile(path, algorithm = "md5") {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function loadRegistry() {
  return JSON.parse(await readFile(registryUrl, "utf8"));
}

async function main() {
  const offline = process.argv.includes("--offline");
  const registry = await loadRegistry();
  const errors = validateRegistry(registry);

  if (!offline) {
    for (const dataset of registry.datasets) {
      const response = await fetch(dataset.source.metadataUrl, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        errors.push(`${dataset.id}: metadata request failed (${response.status})`);
        continue;
      }
      errors.push(...verifyZenodoMetadata(dataset, await response.json()));
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Verified ${registry.datasets.length} licensed dataset record${registry.datasets.length === 1 ? "" : "s"}${offline ? " offline" : " against source metadata"}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

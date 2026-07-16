import { createWriteStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  checksumFile,
  loadRegistry,
  validateRegistry,
  verifyZenodoMetadata,
} from "./verify-video-dataset.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export function assertDownloadAuthorized(authorized) {
  if (!authorized) {
    throw new Error(
      "Dataset binaries are not downloaded by default. Re-run with --download after reviewing the license and storage requirement.",
    );
  }
}

export function buildResumePlan(existingBytes, expectedBytes) {
  if (!Number.isSafeInteger(existingBytes) || existingBytes < 0) {
    throw new Error("Partial download size must be a non-negative integer");
  }
  if (existingBytes > expectedBytes) {
    throw new Error("Partial download is larger than the registered artifact");
  }
  if (existingBytes === 0) return { append: false, headers: {} };
  return {
    append: true,
    headers: { Range: `bytes=${existingBytes}-` },
  };
}

export async function verifyDownloadedArtifact(path, artifact) {
  const errors = [];
  const details = await stat(path);
  if (details.size !== artifact.sizeBytes) {
    errors.push(
      `Downloaded size ${details.size} does not match registered size ${artifact.sizeBytes}`,
    );
  }
  const checksum = await checksumFile(path, artifact.checksum.algorithm);
  if (checksum !== artifact.checksum.value) {
    errors.push("Downloaded checksum does not match the registered checksum");
  }
  return errors;
}

async function existingSize(path) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export async function downloadDataset(dataset, destinationDirectory) {
  assertDownloadAuthorized(true);
  await mkdir(destinationDirectory, { recursive: true });

  const finalPath = join(destinationDirectory, dataset.artifact.fileName);
  const partialPath = `${finalPath}.part`;
  let bytes = await existingSize(partialPath);
  let plan = buildResumePlan(bytes, dataset.artifact.sizeBytes);

  if (bytes < dataset.artifact.sizeBytes) {
    let response = await fetch(dataset.artifact.downloadUrl, {
      headers: plan.headers,
      redirect: "follow",
    });

    if (plan.append && response.status !== 206) {
      await response.body?.cancel();
      bytes = 0;
      plan = buildResumePlan(0, dataset.artifact.sizeBytes);
      response = await fetch(dataset.artifact.downloadUrl, { redirect: "follow" });
    }
    if (!response.ok || !response.body) {
      throw new Error(`Dataset download failed with HTTP ${response.status}`);
    }

    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(partialPath, { flags: plan.append ? "a" : "w" }),
    );
  }

  const errors = await verifyDownloadedArtifact(partialPath, dataset.artifact);
  if (errors.length) {
    throw new Error(
      `${errors.join("; ")}. The .part file was retained for inspection; do not use it for training.`,
    );
  }
  await rename(partialPath, finalPath);
  return finalPath;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const registry = await loadRegistry();
  const registryErrors = validateRegistry(registry);
  if (registryErrors.length) throw new Error(registryErrors.join("\n"));

  const id = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const dataset = registry.datasets.find((item) => item.id === id);
  if (!dataset) {
    throw new Error(
      `Choose a registered dataset ID: ${registry.datasets.map(({ id: itemId }) => itemId).join(", ")}`,
    );
  }

  const metadataResponse = await fetch(dataset.source.metadataUrl, {
    headers: { Accept: "application/json" },
  });
  if (!metadataResponse.ok) {
    throw new Error(`Zenodo metadata request failed (${metadataResponse.status})`);
  }
  const metadataErrors = verifyZenodoMetadata(
    dataset,
    await metadataResponse.json(),
  );
  if (metadataErrors.length) throw new Error(metadataErrors.join("\n"));

  const download = process.argv.includes("--download");
  if (!download) {
    console.log(
      `Verified ${dataset.title}\nArtifact: ${dataset.artifact.fileName} (${dataset.artifact.sizeBytes} bytes)\nNo binary downloaded. Add --download to explicitly fetch it.`,
    );
    return;
  }
  assertDownloadAuthorized(download);

  const destination = resolve(
    argumentValue("--destination") ??
      join(repositoryRoot, "data/video-training/downloads", dataset.id),
  );
  const downloadedPath = await downloadDataset(dataset, destination);
  console.log(`Verified download: ${downloadedPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

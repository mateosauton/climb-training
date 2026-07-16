#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose="$root/deploy/digitalocean/docker-compose.yml"
cloud_init="$root/deploy/digitalocean/cloud-init.yml"
readme="$root/deploy/digitalocean/README.md"
dockerfile="$root/services/video-worker/Dockerfile"
dockerignore="$root/.dockerignore"

fail() {
  printf 'video deployment assertion failed: %s\n' "$1" >&2
  exit 1
}

for file in "$compose" "$cloud_init" "$readme" "$dockerfile" "$dockerignore"; do
  [[ -f "$file" ]] || fail "missing ${file#"$root/"}"
done

grep -Fq '**/.venv' "$dockerignore" || fail 'Python virtual environments are not excluded from the build context'
grep -Fq '.env*' "$dockerignore" || fail 'environment files are not excluded from the build context'

grep -Fq 'vllm/vllm-openai:v0.14.1' "$compose" || fail 'vLLM image is not pinned to 0.14.1'
grep -Fq 'Qwen/Qwen3-VL-8B-Instruct' "$compose" || fail 'Qwen3-VL model is not configured'
grep -Fq -- '--dtype=bfloat16' "$compose" || fail 'BF16 is not configured'
grep -Fq -- '--max-model-len=32768' "$compose" || fail '32K model context is not configured'
grep -Fq -- '--gpu-memory-utilization=0.85' "$compose" || fail 'GPU utilization is not bounded'
grep -Fq -- '--max-num-seqs=2' "$compose" || fail 'model sequence concurrency is not bounded'

python3 - "$compose" <<'PY'
import sys
from pathlib import Path

text = Path(sys.argv[1]).read_text()
block = text.split("  vllm:", 1)[1].split("\n  worker:", 1)[0]
if "ports:" in block:
    raise SystemExit("vLLM must not publish a host port")
if "expose:\n      - \"8000\"" not in block:
    raise SystemExit("vLLM must be exposed only to the private Compose network")
if "networks: [model, egress]" not in block:
    raise SystemExit("vLLM needs outbound access to download public model weights")
PY

grep -Fq '/etc/climb-video-worker/worker.env' "$compose" || fail 'root-owned environment file is not configured'
grep -Fq 'restart: unless-stopped' "$compose" || fail 'services do not have a restart policy'
grep -Fq 'networks: [model, egress]' "$compose" || fail 'worker has no outbound network for Supabase'
grep -Fq '  egress:' "$compose" || fail 'outbound Compose network is not declared'
grep -Fq 'gpu-l40sx1-48gb' "$readme" || fail 'Droplet size is not documented'
grep -Fq 'gpu-h100x1-base' "$readme" || fail 'AI/ML image is not documented'
grep -Fq 'tor1' "$readme" || fail 'deployment region is not documented'
grep -Fq 'doctl compute droplet delete' "$readme" || fail 'destroy rollback is not documented'
grep -Fq 'chmod 600' "$readme" || fail 'secret file permissions are not documented'

if grep -ERq --exclude='assert-video-deployment.sh' \
  '(dop_v1_[A-Za-z0-9]{40,}|sb_secret_[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY=[^<$[:space:]]+|WORKER_SECRET=[^<$[:space:]]+)' \
  "$root/deploy/digitalocean" "$dockerfile"; then
  fail 'deployment artifacts contain a credential-like value'
fi

printf 'video deployment assertions passed\n'

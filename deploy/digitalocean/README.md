# DigitalOcean video worker

This deployment runs the outbound-only analysis worker beside a private vLLM service. It does not publish the model or worker ports to the host.

## Provisioning profile

| Field | Value |
| --- | --- |
| Name | `climb-video-worker-1` |
| Region | `tor1` |
| Size | `gpu-l40sx1-48gb` |
| Image | `gpu-h100x1-base` |
| SSH key ID | `56421640` |
| Monitoring | enabled |
| Observed price, 2026-07-16 | USD 1.57/hour |

GPU Droplets continue billing while powered off and cannot be resized. Destroy the Droplet to stop compute billing.

## Create the host

Keep the DigitalOcean token in the shell environment; do not put it in this repository or cloud-init. With `doctl` authenticated, create the Droplet from the repository root:

```bash
doctl compute droplet create climb-video-worker-1 \
  --region tor1 \
  --size gpu-l40sx1-48gb \
  --image gpu-h100x1-base \
  --ssh-keys 56421640 \
  --enable-monitoring \
  --tag-names climb-video-worker,env-staging \
  --user-data-file deploy/digitalocean/cloud-init.yml \
  --wait
```

Create a DigitalOcean Cloud Firewall for the new Droplet. Allow inbound TCP 22 only from the administrator's current `/32` address. Allow outbound TCP and UDP so the host can reach Supabase over HTTPS, DNS, NTP, package registries, and Hugging Face. Do not add inbound rules for ports 8000 or 8080.

Record the deployment without secrets:

```text
Droplet ID:
Region: tor1
Size: gpu-l40sx1-48gb
Image: gpu-h100x1-base
Deployed at:
Price observed: USD 1.57/hour
Firewall ID:
Git revision:
```

## Configure and start

Copy this checkout to `/opt/climb-video-worker/repo` using `rsync` over SSH. On the host, create `/etc/climb-video-worker/worker.env` with these names and the real values from the protected deployment environment:

```dotenv
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only credential>
VIDEO_WORKER_SECRET=<random rotating secret>
VIDEO_MAX_BYTES=524288000
VIDEO_POLL_SECONDS=5
```

Protect the file before starting the services:

```bash
sudo chown root:root /etc/climb-video-worker/worker.env
sudo chmod 600 /etc/climb-video-worker/worker.env
cd /opt/climb-video-worker/repo
sudo docker compose -f deploy/digitalocean/docker-compose.yml up -d --build
```

The Qwen model is public, so a Hugging Face token is not required. The first start downloads model weights and can take several minutes.

## Verify

Run these checks on the Droplet. No production athlete media is required.

```bash
nvidia-smi
sudo docker compose -f deploy/digitalocean/docker-compose.yml ps
sudo docker compose -f deploy/digitalocean/docker-compose.yml exec vllm \
  python3 -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health').status)"
sudo docker compose -f deploy/digitalocean/docker-compose.yml exec worker \
  python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/healthz').status)"
sudo docker compose -f deploy/digitalocean/docker-compose.yml exec worker \
  python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/readyz').status)"
```

Then enqueue one licensed fixture through the application workflow and verify the immutable report and history in Supabase. Never use arbitrary downloaded or athlete-owned media as training data.

## Rotate credentials

1. Issue the replacement server credential or worker secret.
2. Replace only the matching value in `/etc/climb-video-worker/worker.env`.
3. Keep the file owned by root with mode `0600`.
4. Run `sudo docker compose -f deploy/digitalocean/docker-compose.yml up -d --force-recreate worker`.
5. Verify `/healthz`, `/readyz`, and queue connectivity, then revoke the old credential.

## Roll back and destroy

Roll back application code by checking out the last known-good revision and rebuilding only the worker. Model rollback is performed by restoring the prior pinned image/model configuration and recreating `vllm`.

```bash
sudo docker compose -f deploy/digitalocean/docker-compose.yml down
doctl compute droplet delete <droplet-id> --force
```

Destroying the Droplet permanently removes its local model cache and temporary media. Confirm queued jobs are safely retryable before destruction. Remove the associated firewall after the Droplet is gone.

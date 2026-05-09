# LiteLLM Agent Platform

We're introducing the **LiteLLM Managed Agents Platform** - a simple, self-hosted infrastructure platform for running multiple agents in production.

The main benefit of using this is that it will manage:
- Different sandboxes for different teams/contexts
- Session management across pod restarts/upgrades

We built this because we wanted a managed agent solution, but fully self-hosted. We are excited to have it open sourced and available for everyone to use.

<img width="1997" height="1219" alt="Xnapper-2026-05-08-19 10 50" src="https://github.com/user-attachments/assets/c0c2c2f8-d9e2-4821-b73a-e3971dac5169" />

---

## Quickstart

```bash
./setup.sh
docker compose up
```

Needs Docker Desktop, AWS credentials with ECS/ECR/EC2/IAM/Logs/STS, a LiteLLM gateway. First `./setup.sh` run creates `.env` (with a random `MASTER_KEY`) and exits — fill in your AWS keys and `LITELLM_API_BASE` / `LITELLM_API_KEY`, then re-run.

### Container env passthrough

Anything in `.env` prefixed `CONTAINER_ENV_` is injected into every Fargate container with the prefix stripped:

```bash
CONTAINER_ENV_GITHUB_TOKEN=ghp_...   # container sees GITHUB_TOKEN=ghp_...
```



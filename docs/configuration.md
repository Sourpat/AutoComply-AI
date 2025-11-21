# Configuration & Environment Variables

This document explains how to configure AutoComply AI for local
development and (future) deployments.

The project is deliberately safe-by-default:

- If optional variables are not set, features like EventPublisher
  fall back to NO-OP behavior.
- Required keys (like OpenAI API keys) are only needed for LLM/RAG
  features once those are fully wired in.

---

## 1. Backend – `.env` variables

Template file: `backend/.env.example`

Copy it to `.env` in the same folder:

```bash
cp backend/.env.example backend/.env
```

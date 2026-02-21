# upsert-to-pinecone Edge Function

Generates an embedding for the merged client payload and upserts to Pinecone.

## Deploy

```bash
supabase functions deploy upsert-to-pinecone --no-verify-jwt
```

## Secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `OPENAI_API_KEY` — OpenAI API key for text-embedding-3-small
- `PINECONE_API_KEY` — Pinecone API key
- `PINECONE_HOST` — e.g. https://gobahrain-xxx.svc.xxx.pinecone.io

Or via CLI:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set PINECONE_API_KEY=pcsk_...
supabase secrets set PINECONE_HOST=https://xxx.pinecone.io
```

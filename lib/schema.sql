create extension if not exists vector;

-- One row per quote. embedding = 128 numbers (cosine). tsv = full-text index for word search.
create table if not exists quotes (
  id          text primary key,
  wo          text,
  fam         text,
  makes       text,
  eq          text,
  tr          text,
  total       numeric,
  nte         numeric,
  trade       text,
  state       text,
  tax         numeric,
  steps       jsonb default '[]',
  parts       jsonb default '[]',
  labor       jsonb default '[]',
  body        text,
  source      text default 'clickup',
  created_at  timestamptz default now(),
  embedding   vector(128) not null,
  tsv         tsvector generated always as (to_tsvector('simple', coalesce(body, ''))) stored
);
create index if not exists quotes_embedding_hnsw on quotes using hnsw (embedding vector_cosine_ops);
create index if not exists quotes_tsv_gin on quotes using gin (tsv);

create table if not exists drafts (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  data        jsonb not null
);

-- Create custom_contacts table to store personalized contact names
create table if not exists public.custom_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  instance_key text not null,
  remote_jid text not null,
  custom_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, instance_key, remote_jid)
);

-- Enable RLS
alter table public.custom_contacts enable row level security;

-- Create policies
create policy "Users can view their own custom contacts"
  on public.custom_contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own custom contacts"
  on public.custom_contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own custom contacts"
  on public.custom_contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own custom contacts"
  on public.custom_contacts for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists idx_custom_contacts_user_instance 
  on public.custom_contacts(user_id, instance_key);

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create trigger to auto-update updated_at
create trigger set_updated_at
  before update on public.custom_contacts
  for each row
  execute function public.handle_updated_at();

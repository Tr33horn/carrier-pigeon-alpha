-- Pure user-id access for letters

drop policy if exists "letters_select_owner_or_recipient" on public.letters;
create policy "letters_select_owner_or_recipient"
on public.letters
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_user_id = auth.uid()
);

drop policy if exists "letters_insert_sender" on public.letters;
create policy "letters_insert_sender"
on public.letters
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
);

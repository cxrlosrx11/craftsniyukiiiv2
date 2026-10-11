-- READ-ONLY checks for "can't create a buyer account". Nothing here changes data.
-- Run each block separately and send me the results (or a screenshot).

-- A) Every trigger that fires when an account or a buyer/shop row is created.
select event_object_schema as schema, event_object_table as on_table,
       trigger_name, event_manipulation as event, action_timing as timing, action_statement
from information_schema.triggers
where (event_object_schema = 'auth' and event_object_table = 'users')
   or (event_object_schema = 'public' and event_object_table in ('buyers', 'shops'))
order by 1, 2, 3;

-- B) The buyers table: columns and who may read/insert.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'buyers' order by ordinal_position;

select policyname, cmd, qual as using_clause, with_check
from pg_policies where schemaname = 'public' and tablename = 'buyers';

-- C) Recent accounts that exist but have neither a buyer nor a shop row
--    (what a half-finished sign-up leaves behind).
select u.email, u.created_at, u.raw_user_meta_data->>'role' as signed_up_as,
       u.email_confirmed_at is not null as email_confirmed
from auth.users u
left join public.buyers b on b.id = u.id
left join public.shops s on s.id = u.id
where b.id is null and s.id is null
order by u.created_at desc limit 20;

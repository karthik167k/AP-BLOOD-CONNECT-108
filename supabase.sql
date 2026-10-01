-- AP Blood Connect: run this whole file once in Supabase > SQL Editor.

create table public.requests (
  id bigint generated always as identity primary key,
  patient text not null check (char_length(patient) between 1 and 80),
  attender text not null check (char_length(attender) between 1 and 80),
  bg text not null check (bg in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  comp text not null check (comp in ('Whole blood','Red blood cells (RBC)','Platelets','Plasma (FFP)','White blood cells (WBC / granulocytes)')),
  units int not null check (units between 1 and 20),
  hospital text not null check (char_length(hospital) between 1 and 160),
  district text not null check (district in ('Anantapur','Anakapalli','Alluri Sitharama Raju','Annamayya','Bapatla','Chittoor','East Godavari','Eluru','Guntur','Kakinada','Konaseema','Krishna','Kurnool','Nandyal','NTR','Palnadu','Parvathipuram Manyam','Prakasam','SPSR Nellore','Sri Sathya Sai','Srikakulam','Tirupati','Visakhapatnam','Vizianagaram','West Godavari','YSR Kadapa')),
  phone text not null check (phone ~ '^[0-9+ ]{10,14}$'),
  urgency text not null check (urgency in ('Critical','High','Moderate','Normal')),
  created_at timestamptz not null default now()
);

create table public.donors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9+ ]{10,14}$'),
  city text not null check (char_length(city) between 1 and 80),
  bg text not null check (bg in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  age int not null check (age between 18 and 65),
  weight numeric not null check (weight >= 50),
  gender text,
  created_at timestamptz not null default now()
);

create table public.contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (phone ~ '^[0-9+ ]{10,14}$')
);

create table public.camps (
  id bigint generated always as identity primary key,
  name text not null, date_text text not null, time_text text not null,
  venue text not null, district text not null
);

create table public.bookings (
  id bigint generated always as identity primary key,
  camp_id bigint not null references public.camps(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Public list shows blood groups only, never donor names or phone numbers
create view public.donor_groups as select bg from public.donors;
grant select on public.donor_groups to anon, authenticated;

-- Max 10 emergency contacts per user
create function public.limit_contacts() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.contacts where user_id = new.user_id) >= 10 then
    raise exception 'You can save up to 10 contacts';
  end if;
  return new;
end $$;
create trigger contacts_limit before insert on public.contacts
  for each row execute function public.limit_contacts();

-- Row Level Security: this is what protects your data
alter table public.requests enable row level security;
alter table public.donors   enable row level security;
alter table public.contacts enable row level security;
alter table public.camps    enable row level security;
alter table public.bookings enable row level security;

create policy "anyone reads requests" on public.requests for select to anon, authenticated using (true);
create policy "anyone posts requests" on public.requests for insert to anon, authenticated with check (true);
create policy "anyone registers as donor" on public.donors for insert to anon, authenticated with check (true);
create policy "anyone reads camps" on public.camps for select to anon, authenticated using (true);
create policy "anyone books a camp" on public.bookings for insert to anon, authenticated with check (true);
create policy "users manage own contacts" on public.contacts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sample data (replace with real data)
insert into public.requests (patient,attender,bg,comp,units,hospital,district,phone,urgency) values
 ('Sita Mahalakshmi','Venkat','AB+','Plasma (FFP)',1,'SVIMS, Tirupati','Tirupati','9000000004','Normal'),
 ('Mohan Rao','Padma','A+','Red blood cells (RBC)',3,'GGH, Ongole','Prakasam','9000000003','Moderate'),
 ('Anjali Devi','Suresh','B+','Platelets',1,'KGH, Visakhapatnam','Visakhapatnam','9000000002','High'),
 ('Ravi Kumar','Lakshmi','O-','Whole blood',2,'GGH, Guntur','Guntur','9000000001','Critical');

insert into public.camps (name,date_text,time_text,venue,district) values
 ('Government General Hospital Camp, Ongole','Sat, 10 Oct 2026','9:00 AM – 4:00 PM','Blood bank, GGH Ongole','Prakasam'),
 ('Guntur Medical College Blood Bank Drive','Wed, 14 Oct 2026','10:00 AM – 3:00 PM','GMC campus, Guntur','Guntur'),
 ('Siddhartha Medical College Drive','Sat, 17 Oct 2026','9:00 AM – 4:00 PM','Governorpet, Vijayawada','NTR'),
 ('King George Hospital Blood Camp','Mon, 19 Oct 2026','9:00 AM – 3:00 PM','KGH, Visakhapatnam','Visakhapatnam'),
 ('SV University Campus Camp','Wed, 21 Oct 2026','10:00 AM – 3:00 PM','University auditorium, Tirupati','Tirupati'),
 ('Kurnool Government Hospital Camp','Sun, 25 Oct 2026','8:30 AM – 1:00 PM','GGH Kurnool','Kurnool'),
 ('Anantapur Community Camp','Sat, 31 Oct 2026','9:00 AM – 4:00 PM','Town hall, Anantapur','Anantapur'),
 ('Rajamahendravaram Blood Camp','Sun, 8 Nov 2026','9:00 AM – 2:00 PM','Community hall, Rajamahendravaram','East Godavari'),
 ('Markapur Area Hospital Camp','Wed, 11 Nov 2026','9:00 AM – 3:00 PM','Area Hospital, Markapur','Prakasam'),
 ('Nellore Rotary Blood Bank Drive','Sat, 14 Nov 2026','9:00 AM – 5:00 PM','Rotary Blood Bank, Nellore','SPSR Nellore');

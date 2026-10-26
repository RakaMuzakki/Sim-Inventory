-- SIM-INVENTORY: tabel + RLS custom header (jalankan di Supabase SQL Editor)
create table if not exists "Master_Barang"(
 "Part_Number" text primary key,"nama_barang" text,"kategori" text,"satuan" text,
 "standar_packing" int default 0,"stok" int default 0,"stok_minimum" int default 0,
 "No_Rel" text,"assy_fsg" int default 0,"id_customer" text);
create table if not exists "Master_Customer"(
 "id_customer" text primary key,"nama_customer" text,"kontak" text,"alamat" text);
create table if not exists "List_Order"(
 "id" bigint generated always as identity primary key,"Part_Number" text,"qty_order" int default 0,"id_customer" text);
create table if not exists "Transaksi_Masuk"(
 "id" bigint generated always as identity primary key,"Part_Number" text,"qty" int,"petugas" text,"catatan" text,"tanggal" timestamptz default now());
create table if not exists "Transaksi_Keluar"(
 "id" bigint generated always as identity primary key,"Part_Number" text,"qty" int,"petugas" text,"catatan" text,"tanggal" timestamptz default now());
create table if not exists "Users"(
 "username" text primary key,"password" text,"role" text check ("role" in ('Admin','Warehouse','Produksi','SYSTEM')));

do $$ declare t text; begin
 foreach t in array array['Master_Barang','Master_Customer','List_Order','Transaksi_Masuk','Transaksi_Keluar','Users'] loop
  execute format('alter table %I enable row level security',t);
  execute format('drop policy if exists sim_secret_all on %I',t);
  execute format($p$create policy sim_secret_all on %I for all to anon
    using (current_setting('request.headers', true)::json->>'x-sim-secret' = 'KunciGudang2026!')
    with check (current_setting('request.headers', true)::json->>'x-sim-secret' = 'KunciGudang2026!')$p$,t);
 end loop; end $$;

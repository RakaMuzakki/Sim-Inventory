const SUPABASE_URL = "ISI_SUPABASE_URL",
  SUPABASE_KEY = "ISI_SUPABASE_ANON_KEY";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { "x-sim-secret": "KunciGudang2026!" } },
});
let user = null,
  barang = [],
  customers = [],
  orders = [],
  masuk = [],
  keluar = [],
  users = [];
let isProcessing = false,
  selectedForDelete = [],
  batchTrolley = [],
  reader = null,
  scanned = null,
  curTab = "board",
  masterView = "barang",
  charts = {};
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
const norm = (s) =>
  String(s || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
const fmtD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function opStart() {
  const d = new Date();
  if (d.getHours() < 8) d.setDate(d.getDate() - 1);
  d.setHours(8, 0, 0, 0);
  return d;
}
const swalUI = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  customClass: {
    popup: "!rounded-3xl",
    confirmButton: "btn mx-1",
    cancelButton: "btn light mx-1",
    denyButton: "btn light mx-1",
    input: "!text-3xl !text-center !font-extrabold !rounded-full",
  },
});
function showToast(type, title, msg = "") {
  const ic =
    {
      success: "fa-circle-check text-green-500",
      error: "fa-circle-xmark text-red-500",
      info: "fa-circle-info text-gray-500",
    }[type] || "fa-circle-info";
  const t = document.createElement("div");
  t.className =
    "fixed top-6 left-1/2 -translate-x-1/2 -translate-y-24 z-[9999] bg-white border border-gray-100 shadow-lg rounded-full px-5 py-3 flex items-center gap-3 transition-transform duration-300";
  t.innerHTML = `<i class="fa-solid ${ic} text-lg"></i><div><div class="text-sm font-bold">${title}</div><div class="text-xs text-gray-400">${msg}</div></div>`;
  document.body.appendChild(t);
  requestAnimationFrame(() =>
    t.classList.replace("-translate-y-24", "translate-y-0"),
  );
  setTimeout(() => {
    t.classList.replace("translate-y-0", "-translate-y-24");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}
async function lock(fn) {
  isProcessing = true;
  try {
    return await fn();
  } catch (e) {
    showToast("error", "Gagal", e.message || String(e));
  } finally {
    isProcessing = false;
  }
}
const custName = (id) =>
  (customers.find((c) => c.id_customer === id) || {}).nama_customer ||
  id ||
  "-";

/* ---------- DATA ---------- */
async function loadAll() {
  const r = await Promise.all(
    [
      "Master_Barang",
      "Master_Customer",
      "List_Order",
      "Transaksi_Masuk",
      "Transaksi_Keluar",
      "Users",
    ].map((t) => db.from(t).select("*").limit(10000)),
  );
  if (r[0].error) {
    showToast("error", "Koneksi gagal", r[0].error.message);
    return false;
  }
  barang = r[0].data || [];
  customers = r[1].data || [];
  if (r[2].error)
    orders = JSON.parse(localStorage.getItem("sim_orders") || "[]");
  else {
    orders = r[2].data || [];
    localStorage.setItem("sim_orders", JSON.stringify(orders));
  }
  masuk = r[3].data || [];
  keluar = r[4].data || [];
  users = r[5].data || [];
  return true;
}
async function checkAndRunDailyRollover() {
  const d = new Date();
  if (d.getHours() < 8) d.setDate(d.getDate() - 1);
  const today = fmtD(d);
  const { data } = await db
    .from("Users")
    .select("*")
    .eq("username", "__SYSTEM_ROLLOVER__");
  if (!data || !data.length) {
    await db
      .from("Users")
      .insert({
        username: "__SYSTEM_ROLLOVER__",
        password: today,
        role: "SYSTEM",
      });
    return;
  }
  const old = data[0].password;
  if (old === today) return;
  const claim = await db
    .from("Users")
    .update({ password: today })
    .eq("username", "__SYSTEM_ROLLOVER__")
    .eq("password", old)
    .select();
  if (!claim.data || !claim.data.length) return;
  for (const b of barang) {
    const tot = orders
      .filter((o) => o.Part_Number === b.Part_Number)
      .reduce((s, o) => s + (+o.qty_order || 0), 0);
    await db
      .from("Master_Barang")
      .update({ stok: (+b.stok || 0) + (+b.assy_fsg || 0) - tot, assy_fsg: 0 })
      .eq("Part_Number", b.Part_Number);
  }
  showToast(
    "info",
    "Rollover 08:00",
    "Stok awal hari operasional baru dihitung",
  );
  await loadAll();
}
async function refresh(silent) {
  if (!silent) isProcessing = true;
  try {
    if (await loadAll()) {
      await checkAndRunDailyRollover();
      renderAll();
    }
  } finally {
    if (!silent) isProcessing = false;
  }
}
setInterval(() => {
  if (!document.hidden && !isProcessing) refresh(true);
}, 3000);

/* ---------- AUTH & RBAC ---------- */
const can = (col) =>
  !user
    ? false
    : user.role === "Admin"
      ? true
      : user.role === "Warehouse"
        ? col === "cust" || col === "out"
        : user.role === "Produksi"
          ? col === "assy"
          : false;
function applyRbacUI() {
  const role = user ? user.role : null;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    const r = b.dataset.roles;
    b.classList.toggle("hidden", !!r && !(role && r.split(",").includes(role)));
  });
  $("userInfo").textContent = user ? `${user.username} · ${user.role}` : "Tamu";
  $("btnAuth").textContent = user ? "Keluar" : "Masuk";
  const adm = role === "Admin",
    wh = role === "Warehouse",
    pr = role === "Produksi";
  document
    .querySelectorAll(".gunIn,.gunOut,.saIn,.saOut")
    .forEach((e) => e.classList.toggle("hidden", !(adm || wh)));
  document
    .querySelectorAll(".gunAssy,.saAssy")
    .forEach((e) => e.classList.toggle("hidden", !(adm || pr)));
  if (
    document
      .querySelector(`.nav-btn[data-tab="${curTab}"]`)
      .classList.contains("hidden")
  )
    showTab("board");
}
async function login() {
  const r = await swalUI.fire({
    title: "Masuk",
    html: '<input id="lu" class="inp w-full mb-2" placeholder="Username"><input id="lp" type="password" class="inp w-full" placeholder="Password">',
    showCancelButton: true,
    confirmButtonText: "Masuk",
    cancelButtonText: "Batal",
    preConfirm: () => ({ u: $("lu").value.trim(), p: $("lp").value }),
  });
  if (!r.isConfirmed) return;
  await lock(async () => {
    const { data: all } = await db
      .from("Users")
      .select("username")
      .neq("role", "SYSTEM");
    if ((!all || !all.length) && r.value.u === "admin")
      await db
        .from("Users")
        .insert({ username: "admin", password: "admin", role: "Admin" });
    const { data } = await db
      .from("Users")
      .select("*")
      .eq("username", r.value.u)
      .eq("password", r.value.p)
      .neq("role", "SYSTEM");
    if (!data || !data.length)
      return showToast("error", "Login gagal", "Username atau password salah");
    user = { username: data[0].username, role: data[0].role };
    sessionStorage.setItem("sim_inventory_user", JSON.stringify(user));
    showToast("success", "Selamat datang", user.username);
  });
  applyRbacUI();
  renderAll();
}
function logout() {
  user = null;
  sessionStorage.removeItem("sim_inventory_user");
  applyRbacUI();
  renderAll();
}
$("btnAuth").onclick = () => (user ? logout() : login());

/* ---------- TABS ---------- */
function showTab(t) {
  curTab = t;
  document.querySelectorAll(".tab").forEach((e) => e.classList.add("hidden"));
  $("tab-" + t).classList.remove("hidden");
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  if (t !== "scanner") stopCamera();
  renderAll();
}
document
  .querySelectorAll(".nav-btn")
  .forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
function renderAll() {
  renderBoard();
  if (curTab === "analytics") renderAnalytics();
  if (curTab === "history") renderHistory();
  if (curTab === "master") renderMaster();
}

/* ---------- PAPAN KONTROL ---------- */
function qtyOut(pn, custId) {
  const st = opStart(),
    nm = custName(custId);
  return keluar
    .filter(
      (k) =>
        k.Part_Number === pn &&
        new Date(k.tanggal) >= st &&
        (k.catatan || "").includes(nm),
    )
    .reduce((s, k) => s + (+k.qty || 0), 0);
}
function boardRows() {
  const rows = [];
  barang.forEach((b) => {
    const os = orders.filter((o) => o.Part_Number === b.Part_Number);
    const total = os.reduce((s, o) => s + (+o.qty_order || 0), 0),
      variance = (+b.stok || 0) + (+b.assy_fsg || 0) - total;
    if (!os.length)
      rows.push({ b, o: null, cid: "", cust: "-", day: 0, out: 0, variance });
    else
      os.forEach((o) =>
        rows.push({
          b,
          o,
          cid: o.id_customer,
          cust: custName(o.id_customer),
          day: +o.qty_order || 0,
          out: qtyOut(b.Part_Number, o.id_customer),
          variance,
        }),
      );
  });
  rows.sort(
    (a, b) =>
      a.cust.localeCompare(b.cust) ||
      String(a.b.No_Rel || "").localeCompare(String(b.b.No_Rel || "")),
  );
  return rows;
}
function renderBoard() {
  const q = ($("searchBoard").value || "").toLowerCase();
  const rows = boardRows().filter(
    (r) =>
      !q ||
      (r.b.Part_Number + r.b.nama_barang + r.cust).toLowerCase().includes(q),
  );
  let h = "";
  rows.forEach((r, i) => {
    const first = i === 0 || rows[i - 1].cust !== r.cust;
    let span = 1;
    if (first)
      while (i + span < rows.length && rows[i + span].cust === r.cust) span++;
    const pn = esc(r.b.Part_Number),
      oid = r.o ? r.o.id : "null",
      cid = esc(r.cid);
    const ed = (col, fn) => (can(col) ? `class="edit" onclick="${fn}"` : "");
    const badge =
      r.variance >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600";
    h += `<tr>${first ? `<td rowspan="${span}" ${ed("cust", `promptUpdateCustomerPart(${oid},'${pn}')`)} class="${can("cust") ? "edit " : ""}align-top font-bold text-sm">${r.cust}</td>` : ""}
  <td><div class="text-base font-extrabold">${r.b.Part_Number}</div><div class="text-xs font-medium text-gray-400 uppercase">${r.b.nama_barang || ""}</div></td>
  <td class="text-lg font-extrabold">${r.b.stok ?? 0}</td>
  <td ${ed("day", `promptUpdateQtyDay(${oid},'${pn}','${cid}')`)} class="${can("day") && r.o ? "edit " : ""}font-bold">${r.day}</td>
  <td ${ed("out", `promptUpdateQtyOut('${pn}','${cid}')`)} class="${can("out") ? "edit " : ""}font-bold">${r.out}</td>
  <td class="font-bold">${Math.max(0, r.day - r.out)}</td>
  <td ${ed("assy", `promptUpdateAssyFsg('${pn}')`)} class="${can("assy") ? "edit " : ""}text-lg font-extrabold">${r.b.assy_fsg ?? 0}</td>
  <td><span class="pill ${badge}">${r.variance >= 0 ? "+" : ""}${r.variance}</span></td></tr>`;
  });
  $("boardBody").innerHTML =
    h ||
    '<tr><td colspan="8" class="text-center text-gray-400">Belum ada data barang</td></tr>';
}
const ask = (title, val, txt) =>
  swalUI.fire({
    title,
    text: txt,
    input: "number",
    inputValue: val,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    inputValidator: (v) => (v === "" || +v < 0 ? "Isi angka valid" : null),
  });
const log = (t, pn, qty, note) =>
  db
    .from(t)
    .insert({
      Part_Number: pn,
      qty,
      petugas: user ? user.username : "-",
      catatan: note,
      tanggal: new Date().toISOString(),
    });
async function promptUpdateAssyFsg(pn) {
  await lock(async () => {
    const b = barang.find((x) => x.Part_Number === pn),
      cur = +b.assy_fsg || 0;
    const r = await ask(
      "Stok Assy",
      cur,
      `Saat ini ${cur}. Masukkan Total Akhir.`,
    );
    if (!r.isConfirmed) return;
    const nt = +r.value,
      diff = nt - cur;
    if (!diff) return;
    await db
      .from("Master_Barang")
      .update({ assy_fsg: nt })
      .eq("Part_Number", pn);
    await log(
      "Transaksi_Masuk",
      pn,
      diff,
      diff > 0
        ? "Masuk Gudang FSG (Hasil Assy)"
        : "Koreksi Pengurangan Stok Assy",
    );
    showToast("success", "Assy diperbarui", `${pn}: ${cur} → ${nt}`);
    await loadAll();
    renderAll();
  });
}
async function promptUpdateQtyOut(pn, cid) {
  await lock(async () => {
    const nm = custName(cid),
      cur = qtyOut(pn, cid);
    const r = await ask(
      "Terkirim",
      cur,
      `Saat ini ${cur} Pcs ke ${nm}. Masukkan Total Akhir.`,
    );
    if (!r.isConfirmed) return;
    const diff = +r.value - cur;
    if (!diff) return;
    await log(
      "Transaksi_Keluar",
      pn,
      diff,
      diff > 0
        ? `Pengiriman Papan Kontrol - Tujuan: ${nm}`
        : `Koreksi Batal Kirim - Dari: ${nm}`,
    );
    showToast(
      "success",
      "Pengiriman dicatat",
      `${diff > 0 ? "+" : ""}${diff} Pcs`,
    );
    await loadAll();
    renderAll();
  });
}
async function promptUpdateQtyDay(oid, pn, cid) {
  if (!oid)
    return showToast("info", "Belum ada customer", "Tambah customer dulu");
  await lock(async () => {
    const o = orders.find((x) => x.id === oid),
      r = await ask("Target/Hari", o ? o.qty_order : 0, custName(cid));
    if (!r.isConfirmed) return;
    await db.from("List_Order").update({ qty_order: +r.value }).eq("id", oid);
    await log(
      "Transaksi_Masuk",
      pn,
      0,
      `Set Target QTY/DAY menjadi ${r.value} Pcs (${custName(cid)})`,
    );
    await loadAll();
    renderAll();
  });
}
async function promptUpdateCustomerPart(oid, pn) {
  await lock(async () => {
    if (!customers.length)
      return showToast("error", "Customer kosong", "Buat Master Customer dulu");
    const o = orders.find((x) => x.id === oid),
      count = orders.filter((x) => x.Part_Number === pn).length;
    const opts = customers
      .map(
        (c) =>
          `<option value="${c.id_customer}" ${o && o.id_customer === c.id_customer ? "selected" : ""}>${c.nama_customer}</option>`,
      )
      .join("");
    const r = await swalUI.fire({
      title: "Customer",
      html: `<select id="sc" class="inp w-full">${opts}</select>`,
      showDenyButton: true,
      showCancelButton: count > 1,
      confirmButtonText: o ? "Ubah" : "Simpan",
      denyButtonText: "Tambah Customer",
      cancelButtonText: "Hapus Baris",
      preConfirm: () => $("sc").value,
      preDeny: () => $("sc").value,
    });
    if (r.isConfirmed) {
      if (o)
        await db
          .from("List_Order")
          .update({ id_customer: r.value })
          .eq("id", oid);
      else
        await db
          .from("List_Order")
          .insert({ Part_Number: pn, qty_order: 0, id_customer: r.value });
    } else if (r.isDenied)
      await db
        .from("List_Order")
        .insert({ Part_Number: pn, qty_order: 0, id_customer: r.value });
    else if (r.dismiss === "cancel" && o)
      await db.from("List_Order").delete().eq("id", oid);
    else return;
    await loadAll();
    renderAll();
  });
}

/* ---------- BARCODE & SCANNER ---------- */
function parseYimmBarcode(raw) {
  raw = String(raw || "").trim();
  let pn = raw,
    qty = 1;
  if (raw.startsWith("[)>")) {
    const p = raw.match(/P([A-Z0-9]+)V/),
      q = raw.match(/Q(\d{6})/);
    if (p) pn = p[1];
    if (q) qty = parseInt(q[1], 10) || 1;
  } else if (raw.includes("|")) {
    const seg = raw.split("|")[0].split("-");
    if (seg.length > 1 && /^\d+$/.test(seg[seg.length - 1])) {
      qty = parseInt(seg.pop(), 10) || 1;
    }
    pn = seg.join("-");
  }
  return { pn, qty };
}
const findBarang = (pn) => barang.find((b) => norm(b.Part_Number) === norm(pn));
async function startCamera() {
  try {
    reader = new ZXing.BrowserMultiFormatReader();
    await reader.decodeFromVideoDevice(null, "video", (res) => {
      if (res) {
        reader.reset();
        onScan(res.getText());
      }
    });
  } catch (e) {
    showToast("error", "Kamera gagal", e.message);
  }
}
function stopCamera() {
  if (reader) {
    try {
      reader.reset();
    } catch (e) {}
    reader = null;
  }
}
function onScan(raw) {
  const p = parseYimmBarcode(raw),
    b = findBarang(p.pn);
  if (!b) {
    showToast("error", "Barang tidak ditemukan", p.pn);
    return startCamera();
  }
  scanned = b;
  $("saPart").textContent = b.Part_Number;
  $("saName").textContent = b.nama_barang || "";
  $("saQty").value = p.qty;
  $("modalSmartAction").classList.remove("hidden");
  isProcessing = true;
  requestAnimationFrame(() => $("sheet").classList.add("open"));
}
function closeSmart() {
  $("sheet").classList.remove("open");
  setTimeout(() => $("modalSmartAction").classList.add("hidden"), 250);
  isProcessing = false;
  scanned = null;
  if (curTab === "scanner") startCamera();
}
async function applyMove(type, pn, qty) {
  const { data } = await db
    .from("Master_Barang")
    .select("stok,assy_fsg")
    .eq("Part_Number", pn)
    .single();
  if (type === "IN") {
    await db
      .from("Master_Barang")
      .update({ stok: (data.stok || 0) + qty })
      .eq("Part_Number", pn);
    await log("Transaksi_Masuk", pn, qty, "Barang Masuk (Scanner)");
  } else if (type === "OUT") {
    await db
      .from("Master_Barang")
      .update({ stok: (data.stok || 0) - qty })
      .eq("Part_Number", pn);
    await log("Transaksi_Keluar", pn, qty, "Barang Keluar (Scanner)");
  } else {
    await db
      .from("Master_Barang")
      .update({ assy_fsg: (data.assy_fsg || 0) + qty })
      .eq("Part_Number", pn);
    await log("Transaksi_Masuk", pn, qty, "Masuk Gudang FSG (Hasil Assy)");
  }
}
async function smartAct(type) {
  const qty = parseInt($("saQty").value, 10);
  if (!scanned || !(qty > 0)) return showToast("error", "Qty tidak valid");
  await lock(async () => {
    await applyMove(type, scanned.Part_Number, qty);
    showToast("success", "Tersimpan", `${scanned.Part_Number} × ${qty}`);
  });
  closeSmart();
  await refresh(true);
}
$("gunInput").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const v = e.target.value.trim();
  e.target.value = "";
  if (!v) return;
  const p = parseYimmBarcode(v),
    b = findBarang(p.pn);
  if (!b) return showToast("error", "Barang tidak ditemukan", p.pn);
  const ex = batchTrolley.find((x) => x.b.Part_Number === b.Part_Number);
  if (ex) {
    ex.trolleyCount++;
    ex.qtyInput += p.qty;
  } else batchTrolley.push({ b, trolleyCount: 1, qtyInput: p.qty });
  renderTrolley();
});
function renderTrolley() {
  $("trolleyList").innerHTML =
    batchTrolley
      .map(
        (t) =>
          `<div class="py-3 flex justify-between"><div><div class="font-extrabold">${t.b.Part_Number}</div><div class="text-xs text-gray-400 uppercase">${t.b.nama_barang || ""} · ${t.trolleyCount} troli</div></div><div class="text-lg font-extrabold">${t.qtyInput}</div></div>`,
      )
      .join("") || '<div class="text-gray-400 py-3">Keranjang kosong</div>';
}
async function execBatch(type) {
  if (!batchTrolley.length) return;
  await lock(async () => {
    for (const t of batchTrolley)
      await applyMove(type, t.b.Part_Number, t.qtyInput);
    showToast("success", "Batch selesai", `${batchTrolley.length} item`);
    batchTrolley = [];
    renderTrolley();
  });
  await refresh(true);
}

/* ---------- RIWAYAT ---------- */
function histData() {
  const m = $("filterBulanRiwayat").value,
    tp = $("filterTipe").value;
  let a = [
    ...masuk.map((x) => ({ ...x, tipe: "IN" })),
    ...keluar.map((x) => ({ ...x, tipe: "OUT" })),
  ];
  if (tp !== "ALL") a = a.filter((x) => x.tipe === tp);
  if (m)
    a = a.filter(
      (x) =>
        (x.tanggal || "").slice(0, 7) === m ||
        fmtD(new Date(x.tanggal)).slice(0, 7) === m,
    );
  return a.sort((x, y) => new Date(y.tanggal) - new Date(x.tanggal));
}
function renderHistory() {
  if (!$("filterBulanRiwayat").value)
    $("filterBulanRiwayat").value = fmtD(new Date()).slice(0, 7);
  $("histBody").innerHTML = histData()
    .map((x) => {
      let amt;
      const q = +x.qty || 0;
      if ((x.catatan || "").includes("QTY/DAY"))
        amt =
          '<span class="pill bg-gray-100">SET</span> <span class="text-xs text-gray-400">TARGET</span>';
      else if (x.tipe === "IN")
        amt = `<span class="font-extrabold ${q >= 0 ? "text-green-600" : "text-red-600"}">${q >= 0 ? "+" : ""}${q}</span>`;
      else
        amt = `<span class="font-extrabold ${q >= 0 ? "text-gray-900" : "text-green-600"}">${q >= 0 ? "-" + q : "+" + Math.abs(q)}</span>`;
      return `<tr><td class="text-xs text-gray-500">${new Date(x.tanggal).toLocaleString("id-ID")}</td><td class="font-extrabold">${x.Part_Number}</td><td>${amt}</td><td class="text-sm">${x.petugas || ""}</td><td class="text-xs text-gray-500">${x.catatan || ""}</td></tr>`;
    })
    .join("");
}
function exportHistory() {
  const rows = histData().map((x) => ({
    Tanggal: new Date(x.tanggal).toLocaleString("id-ID"),
    Tipe: x.tipe,
    Part_Number: x.Part_Number,
    Qty: x.qty,
    Petugas: x.petugas,
    Catatan: x.catatan,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Riwayat");
  XLSX.writeFile(
    wb,
    `Laporan_Riwayat_Transaksi_${$("filterBulanRiwayat").value}.xlsx`,
  );
}
function exportBoard() {
  const rows = boardRows().map((r) => ({
    Customer: r.cust,
    Part_Number: r.b.Part_Number,
    Nama: r.b.nama_barang,
    Stok_Awal: r.b.stok,
    Target_Hari: r.day,
    Terkirim: r.out,
    Sisa_Del: Math.max(0, r.day - r.out),
    Assy_FSG: r.b.assy_fsg,
    Variance: r.variance,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(rows),
    "Papan Kontrol",
  );
  XLSX.writeFile(wb, `Laporan_Papan_Kontrol_${fmtD(new Date())}.xlsx`);
}

/* ---------- ANALITIK ---------- */
function mkChart(id, labels, data) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: "#111827",
          borderRadius: 999,
          borderSkipped: false,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { grid: { color: "#F3F4F6" }, border: { display: false } },
      },
    },
  });
}
function renderAnalytics() {
  const m = {};
  keluar.forEach((k) => {
    if ((+k.qty || 0) > 0) m[k.Part_Number] = (m[k.Part_Number] || 0) + +k.qty;
  });
  const top = Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  mkChart(
    "chartFast",
    top.map((t) => t[0]),
    top.map((t) => t[1]),
  );
  const low = [...barang]
    .sort((a, b) => (a.stok || 0) - (b.stok || 0))
    .slice(0, 10);
  mkChart(
    "chartLow",
    low.map((b) => b.Part_Number),
    low.map((b) => b.stok || 0),
  );
}

/* ---------- MASTER DATA ---------- */
const MD = {
  barang: {
    t: "Master_Barang",
    pk: "Part_Number",
    f: [
      "Part_Number",
      "nama_barang",
      "kategori",
      "satuan",
      "standar_packing",
      "stok",
      "stok_minimum",
      "No_Rel",
      "assy_fsg",
      "id_customer",
    ],
    num: ["standar_packing", "stok", "stok_minimum", "assy_fsg"],
  },
  cust: {
    t: "Master_Customer",
    pk: "id_customer",
    f: ["id_customer", "nama_customer", "kontak", "alamat"],
    num: [],
  },
  user: {
    t: "Users",
    pk: "username",
    f: ["username", "password", "role"],
    num: [],
  },
};
function setMaster(v) {
  masterView = v;
  selectedForDelete = [];
  renderMaster();
}
const dataOf = (v) =>
  v === "barang"
    ? barang
    : v === "cust"
      ? customers
      : users.filter((u) => u.role !== "SYSTEM");
function renderMaster() {
  const m = MD[masterView],
    rows = dataOf(masterView);
  $("masterHead").innerHTML =
    `<tr><th><input type="checkbox" ${rows.length && selectedForDelete.length === rows.length ? "checked" : ""} onchange="toggleAll(this.checked)"></th>${m.f.map((f) => `<th>${f}</th>`).join("")}<th></th></tr>`;
  $("masterBody").innerHTML = rows
    .map((r) => {
      const k = r[m.pk];
      return `<tr><td><input type="checkbox" ${selectedForDelete.includes(k) ? "checked" : ""} onchange="toggleSel('${esc(k)}',this.checked)"></td>
  ${m.f.map((f, i) => `<td class="${i === 0 ? "font-extrabold" : "text-sm"}">${f === "password" ? "••••" : (r[f] ?? "")}</td>`).join("")}
  <td class="whitespace-nowrap">${masterView === "barang" ? `<button class="pill bg-gray-100 mr-1" onclick="printBarcode('${esc(k)}')"><i class="fa-solid fa-print"></i></button>` : ""}<button class="pill bg-gray-100" onclick="editMaster('${esc(k)}')"><i class="fa-solid fa-pen"></i></button></td></tr>`;
    })
    .join("");
  const b = $("btnBulk");
  b.classList.toggle("hidden", !selectedForDelete.length);
  b.textContent = `Hapus (${selectedForDelete.length})`;
}
function toggleSel(k, on) {
  selectedForDelete = on
    ? [...new Set([...selectedForDelete, k])]
    : selectedForDelete.filter((x) => x !== k);
  renderMaster();
}
function toggleAll(on) {
  const m = MD[masterView];
  selectedForDelete = on ? dataOf(masterView).map((r) => r[m.pk]) : [];
  renderMaster();
}
async function bulkDelete() {
  const m = MD[masterView];
  const r = await swalUI.fire({
    title: `Hapus ${selectedForDelete.length} data?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal",
  });
  if (!r.isConfirmed) return;
  await lock(async () => {
    await db.from(m.t).delete().in(m.pk, selectedForDelete);
    selectedForDelete = [];
    await loadAll();
    renderAll();
    showToast("success", "Terhapus");
  });
}
const addMaster = () => editMaster(null);
async function editMaster(key) {
  const m = MD[masterView],
    row = key
      ? dataOf(masterView).find((r) => String(r[m.pk]) === String(key))
      : {};
  await lock(async () => {
    const html = m.f
      .map((f) =>
        f === "role"
          ? `<select id="f_${f}" class="inp w-full mb-2">${["Admin", "Warehouse", "Produksi"].map((o) => `<option ${row[f] === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
          : `<input id="f_${f}" class="inp w-full mb-2" placeholder="${f}" value="${(row[f] ?? "").toString().replace(/"/g, "&quot;")}">`,
      )
      .join("");
    const r = await swalUI.fire({
      title: key ? "Edit" : "Tambah",
      html,
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      preConfirm: () => {
        const o = {};
        m.f.forEach((f) => {
          let v = $("f_" + f).value;
          o[f] = m.num.includes(f) ? parseInt(v, 10) || 0 : v;
        });
        return o;
      },
    });
    if (!r.isConfirmed) return;
    const o = r.value;
    if (!o[m.pk]) return showToast("error", "Kode utama wajib diisi");
    if (!key) await db.from(m.t).insert(o);
    else {
      await db.from(m.t).update(o).eq(m.pk, key);
      if (String(o[m.pk]) !== String(key)) {
        /* cascading update */
        if (masterView === "barang")
          for (const t of ["List_Order", "Transaksi_Masuk", "Transaksi_Keluar"])
            await db
              .from(t)
              .update({ Part_Number: o[m.pk] })
              .eq("Part_Number", key);
        if (masterView === "cust") {
          await db
            .from("List_Order")
            .update({ id_customer: o[m.pk] })
            .eq("id_customer", key);
          await db
            .from("Master_Barang")
            .update({ id_customer: o[m.pk] })
            .eq("id_customer", key);
        }
      }
    }
    await loadAll();
    renderAll();
    showToast("success", "Tersimpan");
  });
}
function printBarcode(pn) {
  const c = document.createElement("canvas");
  JsBarcode(c, pn, {
    format: "CODE128",
    width: 2,
    height: 70,
    displayValue: true,
  });
  const w = window.open("", "_blank");
  w.document.write(
    `<html><body style="text-align:center;font-family:sans-serif"><img src="${c.toDataURL()}"><script>onload=()=>{print()}<\/script></body></html>`,
  );
  w.document.close();
}

/* ---------- INIT ---------- */
(async function init() {
  try {
    user = JSON.parse(sessionStorage.getItem("sim_inventory_user"));
  } catch (e) {
    user = null;
  }
  const d = new Date();
  $("filterBulanRiwayat").value = fmtD(d).slice(0, 7);
  showTab("board");
  applyRbacUI();
  renderTrolley();
  await refresh(false);
})();

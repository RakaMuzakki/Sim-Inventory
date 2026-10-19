// =========================================================================
// KONFIGURASI SUPABASE DATABASE
// =========================================================================
const SUPABASE_URL = "https://qvvpfsndszxdjtgpudfp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dnBmc25kc3p4ZGp0Z3B1ZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTExMTksImV4cCI6MjEwNjkyNzExOX0.VuvLwmjVTpdl9vgwaZcWqvWIk_C8PacK5h1M4m6E2mg";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let appData = {
  barang: [],
  customer: [],
  orders: [],
  masuk: [],
  keluar: [],
  seatAssyControl: [],
  users: [],
};
let smartScanner = null;
let activeScannedPart = null;
let isProcessing = false;

// Variabel Global untuk Grafik Analitik
let chartFastMoving = null;
let chartStock = null;

// =========================================================================
// LOGIKA WAKTU OPERASIONAL (GANTI HARI JAM 08:00 PAGI)
// =========================================================================
function getOperationalDayInfo() {
  const now = new Date();
  const opStart = new Date(now);
  opStart.setHours(8, 0, 0, 0);

  // Jika waktu saat ini masih di bawah jam 08:00 pagi, maka masih terhitung hari kerja kemarin (mulai 08:00 kemarin)
  if (now < opStart) {
    opStart.setDate(opStart.getDate() - 1);
  }

  const yyyy = opStart.getFullYear();
  const mm = String(opStart.getMonth() + 1).padStart(2, "0");
  const dd = String(opStart.getDate()).padStart(2, "0");
  const opKey = `${yyyy}-${mm}-${dd}`; // Penanda tanggal operasional (berubah setiap jam 08:00 pagi)

  return { opKey, opStart };
}

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  // Auto Refresh setiap 3 Detik & Cek Pergantian Hari Jam 08:00
  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    const riwayatTab = document.getElementById("tab-riwayat");
    const analitikTab = document.getElementById("tab-analitik");
    if (isProcessing) return;

    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden")) ||
      (analitikTab && !analitikTab.classList.contains("hidden"))
    ) {
      sendToBackend("apiGetMasterData").then(async (res) => {
        if (res && res.success) {
          appData.barang = res.barang || [];
          appData.customer = res.customer || [];
          appData.orders = res.orders || [];
          appData.masuk = res.masuk || [];
          appData.keluar = res.keluar || [];
          appData.users = res.users || [];

          await checkAndRunDailyRollover();
          buildSeatAssyControlDataset();
          refreshAllUI();
        }
      });
    }
  }, 3000);
});

// =========================================================================
// OTOMATIS ROLLOVER [ +/- ] KE STOCK SAAT JAM 08:00 PAGI
// =========================================================================
async function checkAndRunDailyRollover() {
  if (isProcessing || !appData.barang || appData.barang.length === 0) return;

  const { opKey } = getOperationalDayInfo();
  const markerUser = (appData.users || []).find(
    (u) => u.username === "__SYSTEM_ROLLOVER__",
  );

  // Jika belum ada penanda sama sekali di database, buat penanda hari ini agar mulai rollover besok jam 08:00
  if (!markerUser) {
    await _supabase
      .from("Users")
      .insert([
        { username: "__SYSTEM_ROLLOVER__", password: opKey, role: "SYSTEM" },
      ]);
    appData.users.push({
      username: "__SYSTEM_ROLLOVER__",
      password: opKey,
      role: "SYSTEM",
    });
    return;
  }

  // Jika opKey sekarang berbeda dengan yang tercatat di database (artinya sudah lewat jam 08:00 di hari baru!)
  if (markerUser.password !== opKey) {
    isProcessing = true;
    try {
      // Kunci terlebih dahulu tanggal baru di database agar tidak dijalankan ganda oleh komputer lain
      await _supabase
        .from("Users")
        .update({ password: opKey })
        .eq("username", "__SYSTEM_ROLLOVER__");
      markerUser.password = opKey;

      // Pindahkan nilai [ +/- ] kemarin menjadi STOCK hari ini, dan reset ASSY ke 0
      for (const itemBarang of appData.barang) {
        const partNum = String(itemBarang.Part_Number).trim();
        const relatedOrders = appData.orders.filter(
          (o) => String(o.Part_Number).trim() === partNum,
        );
        const qtyDay = relatedOrders.reduce(
          (sum, o) => sum + (Number(o.qty_order) || 0),
          0,
        );

        const currentStock = Number(itemBarang.stok) || 0;
        const assyFsg = Number(itemBarang.assy_fsg) || 0;
        const newOpeningStock = currentStock + assyFsg - qtyDay;

        await _supabase
          .from("Master_Barang")
          .update({
            stok: newOpeningStock,
            assy_fsg: 0,
          })
          .eq("Part_Number", itemBarang.Part_Number);

        itemBarang.stok = newOpeningStock;
        itemBarang.assy_fsg = 0;
      }
    } catch (e) {
      console.error("Rollover 08:00 error:", e);
    }
    isProcessing = false;
  }
}

// =========================================================================
// CORE ENGINE: KOMUNIKASI KE SUPABASE
// =========================================================================
async function sendToBackend(action, payload = {}) {
  try {
    switch (action) {
      case "apiGetMasterData":
        const [resB, resC, resO, resM, resK, resU] = await Promise.all([
          _supabase.from("Master_Barang").select("*"),
          _supabase.from("Master_Customer").select("*"),
          _supabase.from("List_Order").select("*"),
          _supabase.from("Transaksi_Masuk").select("*"),
          _supabase.from("Transaksi_Keluar").select("*"),
          _supabase.from("Users").select("*"),
        ]);

        if (resB.error)
          throw new Error("Tabel Master_Barang error: " + resB.error.message);
        if (resO.error)
          throw new Error("Tabel List_Order error: " + resO.error.message);
        if (resM.error)
          throw new Error("Tabel Transaksi_Masuk error: " + resM.error.message);
        if (resK.error)
          throw new Error(
            "Tabel Transaksi_Keluar error: " + resK.error.message,
          );

        return {
          success: true,
          barang: resB.data,
          customer: resC.data,
          orders: resO.data,
          masuk: resM.data,
          keluar: resK.data,
          users: resU.data,
        };

      case "apiLogin":
        const { data: cekUsers, error: errCek } = await _supabase
          .from("Users")
          .select("*");
        if (errCek) throw new Error("Gagal baca Users: " + errCek.message);

        const realUsers = (cekUsers || []).filter(
          (u) => u.username !== "__SYSTEM_ROLLOVER__",
        );
        if (realUsers.length === 0) {
          if (payload.username === "admin") {
            const { error: errIns } = await _supabase
              .from("Users")
              .insert([
                { username: "admin", password: "admin", role: "Admin" },
              ]);
            if (errIns) throw new Error(errIns.message);
            return {
              success: true,
              user: { username: "admin", role: "Admin" },
            };
          }
        }

        const { data: loginData } = await _supabase
          .from("Users")
          .select("*")
          .eq("username", payload.username)
          .eq("password", payload.password);
        if (
          loginData &&
          loginData.length > 0 &&
          loginData[0].username !== "__SYSTEM_ROLLOVER__"
        ) {
          return { success: true, user: loginData[0] };
        }
        return { success: false, message: "Username atau password salah!" };

      case "apiSaveTransaksiMasuk":
        const { data: bIn, error: errBIn } = await _supabase
          .from("Master_Barang")
          .select("stok")
          .eq("Part_Number", payload.partNumber)
          .single();
        if (errBIn) throw new Error(errBIn.message);

        const newStokIn = (Number(bIn?.stok) || 0) + Number(payload.qty);
        const { error: errUpdIn } = await _supabase
          .from("Master_Barang")
          .update({ stok: newStokIn })
          .eq("Part_Number", payload.partNumber);
        if (errUpdIn) throw new Error(errUpdIn.message);

        const { error: errLogIn } = await _supabase
          .from("Transaksi_Masuk")
          .insert([
            {
              Part_Number: payload.partNumber,
              qty: payload.qty,
              petugas: payload.petugas,
              catatan: payload.catatan,
              tanggal: new Date().toISOString(),
            },
          ]);
        if (errLogIn) throw new Error(errLogIn.message);
        return { success: true };

      case "apiSaveTransaksiKeluar":
        // Saat barang keluar di hari berjalan, TIDAK memotong Master_Barang.stok secara langsung agar tidak terpotong 2 kali.
        // Barang keluar akan menambah QTY/OUT hari ini, dan nanti jam 08:00 pagi saldo [ +/- ] otomatis pindah menjadi STOCK baru.
        if (payload.customer && payload.customer !== "-") {
          const { data: checkOrd } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.partNumber);
          if (checkOrd && checkOrd.length > 0) {
            await _supabase
              .from("List_Order")
              .update({ id_customer: payload.customer })
              .eq("Part_Number", payload.partNumber);
          } else {
            await _supabase.from("List_Order").insert([
              {
                Part_Number: payload.partNumber,
                qty_order: 0,
                id_customer: payload.customer,
              },
            ]);
          }
        }

        const { error: errLogOut } = await _supabase
          .from("Transaksi_Keluar")
          .insert([
            {
              Part_Number: payload.partNumber,
              qty: payload.qty,
              petugas: payload.petugas,
              catatan: payload.catatan,
              tanggal: new Date().toISOString(),
            },
          ]);
        if (errLogOut) throw new Error(errLogOut.message);
        return { success: true };

      case "apiUpdateAssyFsg":
        const { error: errAssy } = await _supabase
          .from("Master_Barang")
          .update({ assy_fsg: payload.qty })
          .eq("Part_Number", payload.partNumber);
        if (errAssy) throw new Error(errAssy.message);
        return { success: true };

      case "apiUpdateQtyDay":
        const { data: checkO, error: errCheckO } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);
        if (errCheckO) throw new Error(errCheckO.message);

        if (checkO && checkO.length > 0) {
          const { error: errUpdO } = await _supabase
            .from("List_Order")
            .update({ qty_order: payload.qty })
            .eq("Part_Number", payload.partNumber);
          if (errUpdO) throw new Error(errUpdO.message);
        } else {
          const { error: errInsO } = await _supabase
            .from("List_Order")
            .insert([
              { Part_Number: payload.partNumber, qty_order: payload.qty },
            ]);
          if (errInsO) throw new Error(errInsO.message);
        }
        return { success: true };

      case "apiUpdateCustomerPart":
        const { data: checkOCust } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);
        if (checkOCust && checkOCust.length > 0) {
          await _supabase
            .from("List_Order")
            .update({ id_customer: payload.customer })
            .eq("Part_Number", payload.partNumber);
        } else {
          await _supabase.from("List_Order").insert([
            {
              Part_Number: payload.partNumber,
              qty_order: 0,
              id_customer: payload.customer,
            },
          ]);
        }
        localStorage.setItem(
          "cust_map_" + payload.partNumber,
          payload.customer,
        );
        return { success: true };

      case "apiSaveBarang":
        const { data: checkB } = await _supabase
          .from("Master_Barang")
          .select("*")
          .eq("Part_Number", payload.item.Part_Number);
        if (checkB && checkB.length > 0) {
          const { error: errUpdB } = await _supabase
            .from("Master_Barang")
            .update(payload.item)
            .eq("Part_Number", payload.item.Part_Number);
          if (errUpdB) throw new Error(errUpdB.message);
        } else {
          const { error: errInsB } = await _supabase
            .from("Master_Barang")
            .insert([payload.item]);
          if (errInsB) throw new Error(errInsB.message);
        }
        if (payload.customer && payload.customer !== "-") {
          localStorage.setItem(
            "cust_map_" + payload.item.Part_Number,
            payload.customer,
          );
          const { data: checkOrdB } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.item.Part_Number);
          if (checkOrdB && checkOrdB.length > 0) {
            await _supabase
              .from("List_Order")
              .update({ id_customer: payload.customer })
              .eq("Part_Number", payload.item.Part_Number);
          } else {
            await _supabase.from("List_Order").insert([
              {
                Part_Number: payload.item.Part_Number,
                qty_order: 0,
                id_customer: payload.customer,
              },
            ]);
          }
        }
        return { success: true, message: "Barang berhasil disimpan!" };

      case "apiSaveCustomer":
        const { data: checkC } = await _supabase
          .from("Master_Customer")
          .select("*")
          .eq("id_customer", payload.cust.id_customer);
        if (checkC && checkC.length > 0) {
          const { error: errUpdC } = await _supabase
            .from("Master_Customer")
            .update(payload.cust)
            .eq("id_customer", payload.cust.id_customer);
          if (errUpdC) throw new Error(errUpdC.message);
        } else {
          const { error: errInsC } = await _supabase
            .from("Master_Customer")
            .insert([payload.cust]);
          if (errInsC) throw new Error(errInsC.message);
        }
        return { success: true, message: "Customer tersimpan!" };

      case "apiSaveUser":
        const { data: checkU } = await _supabase
          .from("Users")
          .select("*")
          .eq("username", payload.userData.username);
        if (checkU && checkU.length > 0) throw new Error("Username sudah ada!");
        const { error: errInsU } = await _supabase
          .from("Users")
          .insert([payload.userData]);
        if (errInsU) throw new Error(errInsU.message);
        return { success: true, message: "User baru berhasil dibuat!" };

      case "apiDeleteUser":
        const { error: errDel } = await _supabase
          .from("Users")
          .delete()
          .eq("username", payload.usernameTarget);
        if (errDel) throw new Error(errDel.message);
        return { success: true, message: "User telah dihapus!" };

      default:
        return { success: false, message: "Aksi tidak dikenal." };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// =========================================================================
// UI & NAVIGASI
// =========================================================================
function startLiveClock() {
  setInterval(() => {
    const el = document.getElementById("liveClock");
    if (el)
      el.innerText = new Date().toLocaleTimeString("id-ID", { hour12: false });
  }, 1000);
}
function toggleSidebar() {
  const sb = document.getElementById("mainSidebar"),
    bd = document.getElementById("sidebarBackdrop");
  if (sb.classList.contains("-translate-x-full")) {
    sb.classList.remove("-translate-x-full");
    bd.classList.remove("opacity-0", "pointer-events-none");
    bd.classList.add("opacity-100");
  } else {
    closeSidebar();
  }
}
function closeSidebar() {
  document.getElementById("mainSidebar").classList.add("-translate-x-full");
  const bd = document.getElementById("sidebarBackdrop");
  bd.classList.add("opacity-0", "pointer-events-none");
  bd.classList.remove("opacity-100");
}
function toggleBrowserFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

function switchTab(tabId) {
  document
    .querySelectorAll(".tab-pane")
    .forEach((el) => el.classList.add("hidden"));
  const activeTab = document.getElementById(`tab-${tabId}`);
  if (activeTab) activeTab.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("bg-slate-800", "text-white");
    btn.classList.add("bg-white", "text-slate-800");
  });
  const activeNav = document.getElementById(`btn-tab-${tabId}`);
  if (activeNav) {
    activeNav.classList.add("bg-slate-800", "text-white");
    activeNav.classList.remove("bg-white", "text-slate-800");
  }

  if (tabId === "overview") renderSeatAssyControlBoard();
  if (tabId === "riwayat") renderRiwayatTable();
  if (tabId === "analitik") renderAnalitikCharts();
  if (tabId !== "scanner") stopSmartScanner();

  if (tabId === "scanner") {
    setTimeout(() => {
      const manualInput = document.getElementById("manualSmartInput");
      if (manualInput) manualInput.focus();
    }, 100);
  }
}

function applyRbacUI() {
  const pCard = document.getElementById("userProfileCard"),
    gPrompt = document.getElementById("guestLoginPrompt");
  document
    .querySelectorAll(".role-admin")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".role-auth")
    .forEach((el) => el.classList.add("hidden"));

  if (currentUser) {
    pCard.classList.remove("hidden");
    pCard.classList.add("flex");
    gPrompt.classList.add("hidden");
    document.getElementById("userNameDisplay").innerText = currentUser.username;
    document.getElementById("userRoleBadge").innerText = currentUser.role;
    document.getElementById("avatarLetter").innerText = currentUser.username
      .charAt(0)
      .toUpperCase();

    document
      .querySelectorAll(".role-auth")
      .forEach((el) => el.classList.remove("hidden"));
    if (currentUser.role === "Admin")
      document
        .querySelectorAll(".role-admin")
        .forEach((el) => el.classList.remove("hidden"));
  } else {
    pCard.classList.add("hidden");
    pCard.classList.remove("flex");
    gPrompt.classList.remove("hidden");
  }
}

// =========================================================================
// DASHBOARD & PERHITUNGAN PAPAN KONTROL
// =========================================================================
function showSyncSpinner(show) {
  const s = document.getElementById("syncSpinner");
  if (s) {
    if (show) s.classList.add("animate-spin");
    else s.classList.remove("animate-spin");
  }
}
function refreshAllData() {
  showSyncSpinner(true);
  loadInitialOrMockData();
}

function loadInitialOrMockData() {
  showSyncSpinner(true);
  sendToBackend("apiGetMasterData")
    .then(async (res) => {
      showSyncSpinner(false);
      if (res && res.success) {
        appData.barang = res.barang || [];
        appData.customer = res.customer || [];
        appData.orders = res.orders || [];
        appData.masuk = res.masuk || [];
        appData.keluar = res.keluar || [];
        appData.users = res.users || [];

        await checkAndRunDailyRollover();
        buildSeatAssyControlDataset();
        refreshAllUI();
      } else
        Swal.fire(
          "Gagal Memuat Data",
          res.message || "Gagal memuat data dari Supabase",
          "error",
        );
    })
    .catch((err) => {
      showSyncSpinner(false);
      Swal.fire("Error", err.message, "error");
    });
}

function refreshAllUI() {
  const searchInput = document.getElementById("globalSearchInput");
  const keyword = searchInput ? searchInput.value : "";
  renderSeatAssyControlBoard(keyword);
  renderRiwayatTable();
  renderMasterBarangTable();
  renderCustomerTable();
  renderUsersTable();

  const analitikTab = document.getElementById("tab-analitik");
  if (analitikTab && !analitikTab.classList.contains("hidden")) {
    renderAnalitikCharts();
  }
}

// Helper mencari nama lengkap customer dari ID atau Nama
function resolveCustomerDisplay(custCode) {
  if (
    !custCode ||
    custCode === "-" ||
    String(custCode) === "undefined" ||
    String(custCode) === "null"
  )
    return "-";
  const found = (appData.customer || []).find(
    (c) =>
      String(c.id_customer).trim().toLowerCase() ===
        String(custCode).trim().toLowerCase() ||
      String(c.nama_customer).trim().toLowerCase() ===
        String(custCode).trim().toLowerCase(),
  );
  return found ? found.nama_customer || found.id_customer : String(custCode);
}

function buildSeatAssyControlDataset() {
  const list = [];
  const { opStart } = getOperationalDayInfo(); // Batas jam 08:00 pagi hari operasional aktif

  appData.barang.forEach((itemBarang) => {
    const partNum = String(itemBarang.Part_Number).trim();
    const relatedOrders = appData.orders.filter(
      (o) => String(o.Part_Number).trim() === partNum,
    );

    // Penentuan Customer (Anti-Undefined)
    let custName = "-";
    const validOrderCust = relatedOrders.find(
      (o) =>
        o.id_customer &&
        String(o.id_customer) !== "undefined" &&
        String(o.id_customer) !== "null",
    );
    if (validOrderCust) {
      custName = validOrderCust.id_customer;
    } else if (
      itemBarang.id_customer &&
      String(itemBarang.id_customer) !== "undefined"
    ) {
      custName = itemBarang.id_customer;
    } else if (localStorage.getItem("cust_map_" + partNum)) {
      custName = localStorage.getItem("cust_map_" + partNum);
    } else {
      // Cek dari riwayat transaksi keluar terakhir
      const lastOut = [...(appData.keluar || [])]
        .filter(
          (k) =>
            String(k.Part_Number).trim() === partNum &&
            k.catatan &&
            k.catatan.includes("Kirim ke:"),
        )
        .sort(
          (a, b) =>
            new Date(b.tanggal || b.created_at) -
            new Date(a.tanggal || a.created_at),
        )[0];
      if (lastOut) {
        custName = lastOut.catatan.replace("Kirim ke:", "").trim();
      }
    }

    const qtyDay = relatedOrders.reduce(
      (sum, o) => sum + (Number(o.qty_order) || 0),
      0,
    );

    // Hanya menghitung QTY/OUT sejak jam 08:00 pagi hari operasional berjalan
    const qtyOut = appData.keluar
      .filter((k) => {
        if (String(k.Part_Number).trim() !== partNum) return false;
        const tgl = new Date(k.tanggal || k.created_at);
        return tgl >= opStart;
      })
      .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);

    const sisaDel = Math.max(0, qtyDay - qtyOut);

    const currentStock = Number(itemBarang.stok) || 0;
    const assyFsg = Number(itemBarang.assy_fsg) || 0;
    const variance = currentStock + assyFsg - qtyDay;

    list.push({
      Customer: resolveCustomerDisplay(custName),
      No_Rel: itemBarang.No_Rel || "-",
      Part_Number: partNum,
      nama_barang: itemBarang.nama_barang || "-",
      stock: currentStock,
      qty_day: qtyDay,
      qty_out: qtyOut,
      sisa_del: sisaDel,
      assy_fsg: assyFsg,
      variance: variance,
    });
  });
  appData.seatAssyControl = list;
}

// Popup Pilih Customer langsung dari Papan Kontrol
function promptUpdateCustomerPart(partNumber, currentCust) {
  if (isProcessing) return;
  if (!appData.customer || appData.customer.length === 0) {
    return Swal.fire(
      "Info",
      "Tambahkan data di menu Master Customer terlebih dahulu!",
      "info",
    );
  }

  const inputOptions = { "-": "-- Tidak Ada / Kosongkan --" };
  appData.customer.forEach((c) => {
    const label = c.nama_customer
      ? `${c.nama_customer} (${c.id_customer})`
      : c.id_customer;
    const val = c.nama_customer || c.id_customer;
    inputOptions[val] = label;
  });

  Swal.fire({
    title: "PILIH CUSTOMER TUJUAN",
    html: `<p class="text-xs mb-2">Tentukan Customer untuk Part:<br><b class="text-base">${partNumber}</b></p>`,
    input: "select",
    inputOptions: inputOptions,
    inputValue: currentCust,
    showCancelButton: true,
    confirmButtonText: "Simpan Customer",
    confirmButtonColor: "#2563eb",
  }).then((result) => {
    if (result.isConfirmed) {
      isProcessing = true;
      Swal.fire({
        title: "Menyimpan...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiUpdateCustomerPart", {
        partNumber: partNumber,
        customer: result.value,
      }).then((res) => {
        isProcessing = false;
        if (res.success) {
          Swal.fire({
            icon: "success",
            title: "Tersimpan!",
            timer: 800,
            showConfirmButton: false,
          });
          refreshAllData();
        } else {
          Swal.fire("Gagal", res.message, "error");
        }
      });
    }
  });
}

function promptUpdateAssyFsg(partNumber, currentQty) {
  if (isProcessing) return;
  Swal.fire({
    title: "UPDATE STOK ASSY",
    html: `<p class="text-sm mb-3">Jumlah barang dirakit untuk Part:<br><b class="text-lg">${partNumber}</b></p>`,
    input: "number",
    inputValue: currentQty > 0 ? currentQty : "",
    inputAttributes: { min: 0, step: 1 },
    showCancelButton: true,
    confirmButtonText: "Simpan",
    confirmButtonColor: "#9333ea",
  }).then((result) => {
    if (result.isConfirmed) {
      isProcessing = true;
      const newVal = Number(result.value) || 0;
      Swal.fire({
        title: "Menyimpan...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiUpdateAssyFsg", { partNumber: partNumber, qty: newVal })
        .then((res) => {
          isProcessing = false;
          if (res.success) {
            Swal.fire({
              icon: "success",
              title: "Tersimpan!",
              timer: 800,
              showConfirmButton: false,
            });
            refreshAllData();
          } else {
            Swal.fire("Gagal Update", res.message, "error");
          }
        })
        .catch((err) => {
          isProcessing = false;
          Swal.fire("Error", err.message, "error");
        });
    }
  });
}

function promptUpdateQtyDay(partNumber, currentQty) {
  if (isProcessing) return;
  Swal.fire({
    title: "SET TARGET (QTY/DAY)",
    html: `<p class="text-sm mb-3">Target Harian untuk Part:<br><b class="text-lg">${partNumber}</b></p>`,
    input: "number",
    inputValue: currentQty > 0 ? currentQty : "",
    inputAttributes: { min: 0, step: 1 },
    showCancelButton: true,
    confirmButtonText: "Simpan",
    confirmButtonColor: "#10b981",
  }).then((result) => {
    if (result.isConfirmed) {
      isProcessing = true;
      const newVal = Number(result.value) || 0;
      Swal.fire({
        title: "Menyimpan...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiUpdateQtyDay", { partNumber: partNumber, qty: newVal })
        .then((res) => {
          isProcessing = false;
          if (res.success) {
            Swal.fire({
              icon: "success",
              title: "Tersimpan!",
              timer: 800,
              showConfirmButton: false,
            });
            refreshAllData();
          } else {
            Swal.fire("Gagal Update", res.message, "error");
          }
        })
        .catch((err) => {
          isProcessing = false;
          Swal.fire("Error", err.message, "error");
        });
    }
  });
}

function renderSeatAssyControlBoard(filterKeyword = "") {
  const tbody = document.getElementById("tblSeatAssyControlBody");
  if (!tbody) return;
  let dataset = appData.seatAssyControl || [];
  if (filterKeyword) {
    const kw = filterKeyword.toLowerCase();
    dataset = dataset.filter(
      (d) =>
        d.Part_Number.toLowerCase().includes(kw) ||
        d.No_Rel.toLowerCase().includes(kw) ||
        d.Customer.toLowerCase().includes(kw),
    );
  }
  document.getElementById("cntTotalSeatAssy").innerText = dataset.length;
  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">Belum ada barang di database.</td></tr>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === "Admin";
  const canEditCust =
    currentUser &&
    (currentUser.role === "Admin" || currentUser.role === "Warehouse");
  const canEditAssy =
    currentUser &&
    (currentUser.role === "Admin" || currentUser.role === "Produksi");

  tbody.innerHTML = dataset
    .map((row) => {
      const formatNum = (num) => (num === 0 ? "-" : num);
      let varFormat = row.variance;
      let varColor = "text-slate-700";
      if (row.variance > 0) {
        varFormat = "+" + row.variance;
        varColor = "text-emerald-600";
      } else if (row.variance < 0) {
        varColor = "text-red-600";
      } else {
        varFormat = "-";
      }

      const custClass = canEditCust
        ? "cursor-pointer hover:bg-blue-100 hover:text-blue-800 underline decoration-dashed underline-offset-4 transition-all"
        : "";
      const custAction = canEditCust
        ? `onclick="promptUpdateCustomerPart('${row.Part_Number}', '${row.Customer}')"`
        : "";

      const qtyDayClass = isAdmin
        ? "cursor-pointer hover:bg-yellow-300 hover:text-blue-800 underline decoration-dashed underline-offset-4 transition-all"
        : "";
      const qtyDayAction = isAdmin
        ? `onclick="promptUpdateQtyDay('${row.Part_Number}', ${row.qty_day})"`
        : "";

      const assyClass = canEditAssy
        ? "cursor-pointer hover:bg-purple-200 hover:text-purple-900 underline decoration-dashed underline-offset-4 transition-all"
        : "";
      const assyAction = canEditAssy
        ? `onclick="promptUpdateAssyFsg('${row.Part_Number}', ${row.assy_fsg})"`
        : "";

      return `<tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-black text-slate-700 break-words ${custClass}" ${custAction} title="Klik untuk pilih Customer">${row.Customer}</td>
      <td class="py-2 px-1 border-2 border-slate-800 font-black text-yellow-600 bg-slate-50">${row.No_Rel}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left">
        <div class="font-black text-slate-900 text-sm tracking-tighter">${row.Part_Number}</div>
        <div class="text-[10px] text-slate-500 truncate max-w-[120px] leading-none mt-0.5 uppercase">${row.nama_barang}</div>
      </td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-blue-700 text-base bg-blue-50/50">${formatNum(row.stock)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-slate-800 bg-slate-100 ${qtyDayClass}" ${qtyDayAction}>${formatNum(row.qty_day)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.qty_out)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-red-600">${formatNum(row.sisa_del)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-purple-700 bg-purple-50/50 ${assyClass}" ${assyAction}>${formatNum(row.assy_fsg)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black ${varColor}">${varFormat}</td>
    </tr>`;
    })
    .join("");
}

function handleGlobalSearch(keyword) {
  renderSeatAssyControlBoard(keyword);
}

// =========================================================================
// TABEL RIWAYAT TRANSAKSI
// =========================================================================
function renderRiwayatTable() {
  const tbody = document.getElementById("tblRiwayatBody");
  if (!tbody) return;
  const filterDropdown = document.getElementById("filterRiwayat");
  const filterVal = filterDropdown ? filterDropdown.value : "ALL";
  let riwayatGabungan = [];

  if (filterVal === "ALL" || filterVal === "IN") {
    (appData.masuk || []).forEach((m) => {
      riwayatGabungan.push({
        waktu: new Date(m.tanggal || m.created_at),
        tipe: "IN",
        part: m.Part_Number,
        qty: m.qty,
        petugas: m.petugas,
        catatan: m.catatan,
      });
    });
  }
  if (filterVal === "ALL" || filterVal === "OUT") {
    (appData.keluar || []).forEach((k) => {
      riwayatGabungan.push({
        waktu: new Date(k.tanggal || k.created_at),
        tipe: "OUT",
        part: k.Part_Number,
        qty: k.qty,
        petugas: k.petugas,
        catatan: k.catatan,
      });
    });
  }
  riwayatGabungan.sort((a, b) => b.waktu - a.waktu);

  if (riwayatGabungan.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 font-medium">Belum ada riwayat transaksi.</td></tr>`;
    return;
  }

  tbody.innerHTML = riwayatGabungan
    .map((r) => {
      const waktuStr = r.waktu.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const isMasuk = r.tipe === "IN";
      const badgeTipe = isMasuk
        ? `<span class="px-2 py-1 bg-emerald-400 text-slate-900 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] text-[9px] font-black uppercase">MASUK</span>`
        : `<span class="px-2 py-1 bg-red-400 text-slate-900 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] text-[9px] font-black uppercase">KELUAR</span>`;
      const colorQty = isMasuk ? "text-emerald-600" : "text-red-600";
      const signQty = isMasuk ? "+" : "-";

      return `<tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-2 border-2 border-slate-800 text-[10px] font-black text-slate-500">${waktuStr}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-center">${badgeTipe}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left font-black text-slate-900 text-sm tracking-tight">${r.part}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-base ${colorQty}">${signQty}${r.qty}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-[10px] font-black uppercase text-slate-700">${r.petugas || "-"}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left text-[10px] font-bold text-slate-700 max-w-xs truncate">${r.catatan || "-"}</td>
    </tr>`;
    })
    .join("");
}

// =========================================================================
// RENDER GRAFIK ANALITIK (CHART.JS)
// =========================================================================
function renderAnalitikCharts() {
  if (typeof Chart === "undefined") return;

  let keluarMap = {};
  (appData.keluar || []).forEach((k) => {
    let part = String(k.Part_Number).trim();
    keluarMap[part] = (keluarMap[part] || 0) + Number(k.qty);
  });

  let sortedKeluar = Object.entries(keluarMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  let fmLabels = sortedKeluar.map((item) => item[0]);
  let fmData = sortedKeluar.map((item) => item[1]);

  const ctxFM = document.getElementById("fastMovingChart").getContext("2d");
  if (chartFastMoving) chartFastMoving.destroy();
  chartFastMoving = new Chart(ctxFM, {
    type: "bar",
    data: {
      labels: fmLabels.length > 0 ? fmLabels : ["Belum ada data"],
      datasets: [
        {
          label: "Total Qty Keluar",
          data: fmData.length > 0 ? fmData : [0],
          backgroundColor: "#facc15",
          borderColor: "#1e293b",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: { font: { weight: "bold" } },
        },
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 10 } },
        },
      },
    },
  });

  let sortedBarang = [...(appData.barang || [])]
    .sort((a, b) => Number(a.stok) - Number(b.stok))
    .slice(0, 10);
  let stLabels = sortedBarang.map((b) => b.Part_Number);
  let stCurrent = sortedBarang.map((b) => Number(b.stok));
  let stMin = sortedBarang.map((b) => Number(b.stok_minimum || 0));

  const ctxStock = document.getElementById("stockStatusChart").getContext("2d");
  if (chartStock) chartStock.destroy();
  chartStock = new Chart(ctxStock, {
    type: "bar",
    data: {
      labels: stLabels.length > 0 ? stLabels : ["Belum ada data"],
      datasets: [
        {
          label: "Stok Minimum",
          data: stMin.length > 0 ? stMin : [0],
          type: "line",
          borderColor: "#ef4444",
          backgroundColor: "#ef4444",
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.3,
        },
        {
          label: "Stok Saat Ini",
          data: stCurrent.length > 0 ? stCurrent : [0],
          backgroundColor: "#34d399",
          borderColor: "#1e293b",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#e2e8f0" },
          ticks: { font: { weight: "bold" } },
        },
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 10 } },
        },
      },
    },
  });
}

// =========================================================================
// SMART SCANNER LOGIC (PILIH CUSTOMER & TANPA SURAT JALAN)
// =========================================================================
function handleScannerGun(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (isProcessing) return;
    const inputField = document.getElementById("manualSmartInput");
    if (inputField.value) {
      isProcessing = true;
      inputField.disabled = true;
      processSmartScan(inputField.value);
    }
  }
}

function startSmartScanner() {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  const wrapper = document.getElementById("smartReaderWrapper");
  document.getElementById("btnStartScan").classList.add("hidden");
  document.getElementById("btnStopScan").classList.remove("hidden");
  wrapper.classList.remove("hidden");

  smartScanner = new Html5Qrcode("smartReaderViewport");
  smartScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        const beep = new Audio(
          "https://www.soundjay.com/buttons/sounds/button-3.mp3",
        );
        beep.play().catch(() => {});
        processSmartScan(decodedText);
      },
      () => {},
    )
    .catch((err) => {
      stopSmartScanner();
    });
}

function stopSmartScanner() {
  if (smartScanner) {
    smartScanner
      .stop()
      .then(() => {
        smartScanner.clear();
        smartScanner = null;
      })
      .catch(() => {});
  }
  document.getElementById("smartReaderWrapper").classList.add("hidden");
  document.getElementById("btnStartScan").classList.remove("hidden");
  document.getElementById("btnStopScan").classList.add("hidden");
}

function populateCustomerDropdown(selectEl, selectedVal = "-") {
  if (!selectEl) return;
  let html = `<option value="-">-- Pilih Customer --</option>`;
  (appData.customer || []).forEach((c) => {
    const val = c.nama_customer || c.id_customer;
    const label = c.nama_customer
      ? `${c.nama_customer} (${c.id_customer})`
      : c.id_customer;
    const isSel =
      String(val).toLowerCase() === String(selectedVal).toLowerCase() ||
      String(c.id_customer).toLowerCase() === String(selectedVal).toLowerCase()
        ? "selected"
        : "";
    html += `<option value="${val}" ${isSel}>${label}</option>`;
  });
  selectEl.innerHTML = html;
}

function handleChangeScannerCustomer(val) {
  const badge = document.getElementById("smInfoCustomer");
  if (badge) badge.innerText = "TUJUAN: " + (val && val !== "-" ? val : "-");
}

function processSmartScan(scannedCode) {
  if (!scannedCode) {
    isProcessing = false;
    document.getElementById("manualSmartInput").disabled = false;
    return;
  }

  const part = scannedCode.trim();
  const foundData = appData.seatAssyControl.find(
    (item) => item.Part_Number.toLowerCase() === part.toLowerCase(),
  );

  if (!foundData) {
    Swal.fire({
      icon: "warning",
      title: "Tidak Dikenali!",
      text: `Part ${part} tidak terdaftar.`,
      timer: 2000,
      showConfirmButton: false,
    });
    isProcessing = false;
    document.getElementById("manualSmartInput").disabled = false;
    document.getElementById("manualSmartInput").value = "";
    document.getElementById("manualSmartInput").focus();
    return;
  }

  if (smartScanner) smartScanner.pause();
  activeScannedPart = foundData;

  const custDisplay =
    foundData.Customer &&
    foundData.Customer !== "-" &&
    foundData.Customer !== "undefined"
      ? foundData.Customer
      : "-";
  const selectCust = document.getElementById("smSelectCustomer");
  populateCustomerDropdown(selectCust, custDisplay);

  document.getElementById("smInfoCustomer").innerText =
    "TUJUAN: " +
    (selectCust && selectCust.value !== "-" ? selectCust.value : custDisplay);
  document.getElementById("smInfoRell").innerText = foundData.No_Rel;
  document.getElementById("smInfoPart").innerText = foundData.Part_Number;
  document.getElementById("smInfoNama").innerText = foundData.nama_barang;
  document.getElementById("smInfoStok").innerText = foundData.stock;
  document.getElementById("smInfoTarget").innerText = foundData.sisa_del;
  document.getElementById("smInfoAssy").innerText = foundData.assy_fsg;
  document.getElementById("smInputQty").value = 1;

  const btnWH = document.getElementById("btnGroupWH");
  const btnAssy = document.getElementById("btnGroupAssy");
  const wrapCust = document.getElementById("wrapperSelectCustomer");

  if (currentUser.role === "Admin") {
    btnWH.classList.remove("hidden");
    btnAssy.classList.remove("hidden");
    if (wrapCust) wrapCust.classList.remove("hidden");
  } else if (currentUser.role === "Produksi") {
    btnWH.classList.add("hidden");
    btnAssy.classList.remove("hidden");
    if (wrapCust) wrapCust.classList.add("hidden");
  } else {
    btnWH.classList.remove("hidden");
    btnAssy.classList.add("hidden");
    if (wrapCust) wrapCust.classList.remove("hidden");
  }

  document.getElementById("modalSmartAction").classList.remove("hidden");
  isProcessing = false;
  document.getElementById("manualSmartInput").disabled = false;
  document.getElementById("manualSmartInput").value = "";
}

function closeSmartAction() {
  document.getElementById("modalSmartAction").classList.add("hidden");
  activeScannedPart = null;
  if (smartScanner) smartScanner.resume();
  const manualInput = document.getElementById("manualSmartInput");
  if (manualInput) {
    manualInput.disabled = false;
    manualInput.value = "";
    manualInput.focus();
  }
}

function adjSmartQty(amount) {
  const input = document.getElementById("smInputQty");
  let val = parseInt(input.value) || 0;
  val += amount;
  if (val < 1) val = 1;
  input.value = val;
}

function submitSmartAction(tipeAction) {
  if (!activeScannedPart || !currentUser) return;
  if (isProcessing) return;
  const qty = parseInt(document.getElementById("smInputQty").value) || 0;
  if (qty <= 0) return Swal.fire("Error", "Jumlah harus lebih dari 0", "error");

  isProcessing = true;

  // 1. INPUT ASSY (PRODUKSI)
  if (tipeAction === "ASSY_ADD" || tipeAction === "ASSY_SET") {
    const finalQty =
      tipeAction === "ASSY_ADD" ? activeScannedPart.assy_fsg + qty : qty;
    Swal.fire({
      title: "Mencatat ke Supabase...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiUpdateAssyFsg", {
      partNumber: activeScannedPart.Part_Number,
      qty: finalQty,
    })
      .then((res) => {
        isProcessing = false;
        if (res.success) {
          Swal.fire({
            icon: "success",
            title: "Tersimpan!",
            timer: 800,
            showConfirmButton: false,
          });
          closeSmartAction();
          refreshAllData();
        } else {
          Swal.fire("Gagal", res.message, "error");
        }
      })
      .catch((err) => {
        isProcessing = false;
        Swal.fire("Error", err.message, "error");
      });
    return;
  }

  // 2. BARANG KELUAR (LANGSUNG KIRIM KE CUSTOMER TANPA SURAT JALAN / PLAT NOMOR)
  if (tipeAction === "OUT") {
    const selectedCustomer =
      document.getElementById("smSelectCustomer")?.value ||
      activeScannedPart.Customer ||
      "-";
    if (!selectedCustomer || selectedCustomer === "-") {
      isProcessing = false;
      return Swal.fire(
        "Pilih Customer!",
        "Silakan pilih Customer tujuan pengiriman terlebih dahulu pada kolom pilihan di atas.",
        "warning",
      );
    }

    const totalTersedia =
      (Number(activeScannedPart.stock) || 0) +
      (Number(activeScannedPart.assy_fsg) || 0) -
      (Number(activeScannedPart.qty_out) || 0);
    if (qty > totalTersedia) {
      isProcessing = false;
      return Swal.fire(
        "Stok Kurang!",
        `Stok tersedia hari ini sisa ${Math.max(0, totalTersedia)} Pcs.`,
        "error",
      );
    }

    localStorage.setItem(
      "cust_map_" + activeScannedPart.Part_Number,
      selectedCustomer,
    );
    Swal.fire({
      title: "Mencatat Barang Keluar...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiSaveTransaksiKeluar", {
      partNumber: activeScannedPart.Part_Number,
      qty: qty,
      petugas: currentUser.username,
      customer: selectedCustomer,
      catatan: `Kirim ke: ${selectedCustomer}`,
    })
      .then((res) => {
        isProcessing = false;
        if (res.success) {
          Swal.fire({
            icon: "success",
            title: "Berhasil Keluar!",
            timer: 800,
            showConfirmButton: false,
          });
          closeSmartAction();
          refreshAllData();
        } else {
          Swal.fire("Gagal", res.message, "error");
        }
      })
      .catch((err) => {
        isProcessing = false;
        Swal.fire("Error", err.message, "error");
      });
    return;
  }

  // 3. BARANG MASUK
  Swal.fire({
    title: "Mencatat ke Supabase...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveTransaksiMasuk", {
    partNumber: activeScannedPart.Part_Number,
    qty: qty,
    petugas: currentUser.username,
    catatan: `Scan Barang Masuk`,
  })
    .then((res) => {
      isProcessing = false;
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "Berhasil Masuk!",
          timer: 800,
          showConfirmButton: false,
        });
        closeSmartAction();
        refreshAllData();
      } else {
        Swal.fire("Gagal", res.message, "error");
      }
    })
    .catch((err) => {
      isProcessing = false;
      Swal.fire("Error", err.message, "error");
    });
}

// =========================================================================
// TABEL MASTER DATA & MANAJEMEN USER & GENERATOR BARCODE
// =========================================================================
function renderMasterBarangTable() {
  const tbody = document.getElementById("tblMasterBarangBody");
  if (!tbody) return;
  if (appData.barang.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada barang.</td></tr>`;
    return;
  }
  tbody.innerHTML = appData.barang
    .map(
      (b) => `
    <tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-3 border-2 border-slate-800 font-black">${b.Part_Number}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left font-bold text-slate-700">${b.nama_barang}</td>
      <td class="py-2 px-3 border-2 border-slate-800 font-black text-blue-700 text-base">${b.stok}</td>
      <td class="py-2 px-3 border-2 border-slate-800 font-black text-yellow-600 bg-slate-50">${b.No_Rel || "-"}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-center">
         <button onclick="printBarcode('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded border-2 border-slate-900 shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all mx-auto">
            <i class="fa-solid fa-print"></i>
         </button>
      </td>
    </tr>`,
    )
    .join("");
}

function printBarcode(partNumber, namaBarang) {
  const canvas = document.getElementById("hiddenBarcodeCanvas");
  const cleanPartNumber = String(partNumber).trim();
  JsBarcode(canvas, cleanPartNumber, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 16,
    fontOptions: "bold",
    textMargin: 4,
    margin: 5,
  });
  const imgData = canvas.toDataURL("image/png");

  const printWindow = window.open("", "_blank", "width=400,height=400");
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Label - ${cleanPartNumber}</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 2mm; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; background: white; box-sizing: border-box; }
          .title { font-size: 10px; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          img { max-width: 100%; max-height: 22mm; object-fit: contain; }
        </style>
      </head>
      <body>
        <div class="title">${namaBarang}</div><img src="${imgData}" />
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function renderCustomerTable() {
  const tbody = document.getElementById("tblCustomerBody");
  if (!tbody) return;
  if (appData.customer.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = appData.customer
    .map(
      (c) =>
        `<tr class="hover:bg-yellow-50 transition-colors"><td class="py-2 px-3 border-2 border-slate-800 font-black">${c.id_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left font-black text-slate-900">${c.nama_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left">${c.alamat || "-"}</td></tr>`,
    )
    .join("");
}

function renderUsersTable() {
  const tbody = document.getElementById("tblUsersBody");
  if (!tbody) return;
  const usersList = (appData.users || []).filter(
    (u) => u.username !== "__SYSTEM_ROLLOVER__",
  );
  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }
  tbody.innerHTML = usersList
    .map((u) => {
      const btnDelete = `<button onclick="deleteUser('${u.username}')" class="px-3 py-1.5 bg-red-400 hover:bg-red-500 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all text-slate-900"><i class="fa-solid fa-trash-can"></i></button>`;
      return `<tr class="hover:bg-yellow-50 transition-colors"><td class="py-2 px-3 border-2 border-slate-800 font-black text-slate-900">${u.username}</td><td class="py-2 px-3 border-2 border-slate-800"><span class="px-2.5 py-1 bg-slate-800 text-white font-bold text-[10px] uppercase rounded shadow-[2px_2px_0px_rgba(0,0,0,1)]">${u.role}</span></td><td class="py-2 px-3 border-2 border-slate-800 text-center">${btnDelete}</td></tr>`;
    })
    .join("");
}

function deleteUser(usernameTarget) {
  if (currentUser && currentUser.username === usernameTarget)
    return Swal.fire("Ditolak!", "Tidak bisa hapus akun sendiri.", "warning");
  if (isProcessing) return;
  Swal.fire({
    title: `Hapus Akun ${usernameTarget}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Hapus!",
  }).then((result) => {
    if (result.isConfirmed) {
      isProcessing = true;
      Swal.fire({
        title: "Menghapus...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiDeleteUser", { usernameTarget: usernameTarget }).then(
        (res) => {
          isProcessing = false;
          if (res.success) {
            Swal.fire({
              icon: "success",
              title: "Terhapus!",
              timer: 1500,
              showConfirmButton: false,
            });
            refreshAllData();
          } else {
            Swal.fire("Gagal", res.message, "error");
          }
        },
      );
    }
  });
}

function openModalBarang() {
  populateCustomerDropdown(document.getElementById("mbCustomer"), "-");
  document.getElementById("modalMasterBarang").classList.remove("hidden");
}
function closeModalBarang() {
  document.getElementById("modalMasterBarang").classList.add("hidden");
  document.getElementById("formMasterBarang").reset();
}
function openModalCustomer() {
  document.getElementById("modalMasterCustomer").classList.remove("hidden");
}
function closeModalCustomer() {
  document.getElementById("modalMasterCustomer").classList.add("hidden");
  document.getElementById("formMasterCustomer").reset();
}
function openModalUser() {
  document.getElementById("modalMasterUser").classList.remove("hidden");
}
function closeModalUser() {
  document.getElementById("modalMasterUser").classList.add("hidden");
  document.getElementById("formMasterUser").reset();
}

function handleSaveBarang(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;
  const selectedCust = document.getElementById("mbCustomer")
    ? document.getElementById("mbCustomer").value
    : "-";
  const payload = {
    customer: selectedCust,
    item: {
      Part_Number: document.getElementById("mbPartNumber").value.trim(),
      nama_barang: document.getElementById("mbNamaBarang").value.trim(),
      kategori: document.getElementById("mbKategori").value.trim(),
      satuan: document.getElementById("mbSatuan").value.trim(),
      standar_packing: document.getElementById("mbStdPack").value,
      stok: document.getElementById("mbStok").value,
      stok_minimum: document.getElementById("mbStokMin").value,
      No_Rel: document.getElementById("mbNoRel").value.trim(),
    },
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveBarang", payload).then((res) => {
    isProcessing = false;
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      closeModalBarang();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

function handleSaveCustomer(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;
  const payload = {
    cust: {
      id_customer: document.getElementById("mcId").value.trim(),
      nama_customer: document.getElementById("mcNama").value.trim(),
      kontak: document.getElementById("mcKontak").value.trim(),
      alamat: document.getElementById("mcAlamat").value.trim(),
    },
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveCustomer", payload).then((res) => {
    isProcessing = false;
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      closeModalCustomer();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

function handleSaveUser(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;
  const payload = {
    userData: {
      username: document.getElementById("muUsername").value.trim(),
      password: document.getElementById("muPassword").value.trim(),
      role: document.getElementById("muRole").value,
    },
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveUser", payload).then((res) => {
    isProcessing = false;
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      closeModalUser();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

// =========================================================================
// LOGIN
// =========================================================================
function openLoginModal() {
  document.getElementById("modalLogin").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("modalLogin").classList.add("hidden");
  document.getElementById("loginUsername").value = "";
  document.getElementById("loginPassword").value = "";
}
function logoutAction() {
  Swal.fire({
    title: "Keluar Sistem?",
    showCancelButton: true,
    confirmButtonColor: "#d33",
  }).then((res) => {
    if (res.isConfirmed) {
      currentUser = null;
      sessionStorage.removeItem("sim_inventory_user");
      applyRbacUI();
      switchTab("overview");
    }
  });
}
function handleLoginSubmit(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;
  const payload = {
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim(),
  };
  Swal.fire({
    title: "Menghubungkan ke Supabase...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiLogin", payload).then((res) => {
    isProcessing = false;
    if (res.success) {
      currentUser = res.user;
      sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
      applyRbacUI();
      closeLoginModal();
      Swal.fire({
        icon: "success",
        title: "Masuk!",
        timer: 1000,
        showConfirmButton: false,
      });
      switchTab("scanner");
    } else {
      Swal.fire("Gagal Login", res.message, "error");
    }
  });
}

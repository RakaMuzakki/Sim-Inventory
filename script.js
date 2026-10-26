/**
 * ============================================================================
 * SIM-INVENTORY — NORDIC WORKSPACE (FULL SPA ENGINE)
 * ============================================================================
 */

// 1. KONFIGURASI SUPABASE & CUSTOM HEADER RLS
const SUPABASE_URL = "https://qvvpfsndszxdjtgpudfp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dnBmc25kc3p4ZGp0Z3B1ZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTExMTksImV4cCI6MjEwNjkyNzExOX0.VuvLwmjVTpdl9vgwaZcWqvWIk_C8PacK5h1M4m6E2mg";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    global: {
      headers: {
        "x-sim-secret": "KunciGudang2026!",
      },
    },
  },
);

// 2. STATE GLOBAL APLIKASI
let masterBarangList = [];
let masterCustomerList = [];
let listOrderData = [];
let transaksiMasukList = [];
let transaksiKeluarList = [];
let usersList = [];

let currentUser = null; // { username, role }
let activeTab = "dashboard";
let isProcessing = false;
let pollingIntervalId = null;

// Anti-Refresh Bulk Delete State
let selectedForDelete = [];

// Smart Scanner & Batch Trolley State
let scannerMode = "GUN";
let batchTrolley = []; // Array of { Part_Number, nama_barang, No_Rel, trolleyCount, qtyInput }
let zxingReader = null;
let activeScannedItem = null;

// Chart.js Instances
let chartFastMovingInstance = null;
let chartLowestStockInstance = null;

// SweetAlert2 Nordic Mixin (`swalUI`)
const swalUI = Swal.mixin({
  customClass: {
    popup: "nordic-swal-popup",
    confirmButton:
      "px-6 py-2.5 rounded-full bg-gray-900 text-white text-xs font-extrabold hover:bg-gray-800 mx-1 transition",
    cancelButton:
      "px-6 py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-extrabold hover:bg-gray-200 mx-1 transition",
    denyButton:
      "px-6 py-2.5 rounded-full bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 mx-1 transition",
    input: "nordic-swal-input",
  },
  buttonsStyling: false,
});

/**
 * ============================================================================
 * INISIALISASI APLIKASI SAAT DOM READY
 * ============================================================================
 */
document.addEventListener("DOMContentLoaded", async () => {
  initClockAndMonthDefault();
  loadSessionUser();
  applyRbacUI();
  setupGunScannerListener();

  await fetchAllDatabaseData(false);
  await checkAndRunDailyRollover();

  // Live Andon Polling setiap 3000ms (3 detik)
  pollingIntervalId = setInterval(async () => {
    if (!document.hidden && !isProcessing) {
      await fetchAllDatabaseData(true);
    }
  }, 3000);
});

/**
 * ============================================================================
 * UTILITAS WAKTU OPERASIONAL (ROLLOVER JAM 08:00 PAGI) & TOAST
 * ============================================================================
 */
function getOperationalDateInfo() {
  const now = new Date();
  const opDate = new Date(now);
  // Hari operasional dimulai jam 08:00 pagi. Jika sebelum 08:00, ikut tanggal kemarin.
  if (now.getHours() < 8) {
    opDate.setDate(opDate.getDate() - 1);
  }
  const yyyy = opDate.getFullYear();
  const mm = String(opDate.getMonth() + 1).padStart(2, "0");
  const dd = String(opDate.getDate()).padStart(2, "0");
  const dateString = `${yyyy}-${mm}-${dd}`;

  const startTime = new Date(`${dateString}T08:00:00`);
  return { dateString, startTime };
}

function initClockAndMonthDefault() {
  const updateClock = () => {
    const now = new Date();
    const clockEl = document.getElementById("liveClockDisplay");
    if (clockEl) {
      clockEl.textContent =
        now.toLocaleTimeString("id-ID", { hour12: false }) + " WIB";
    }
    const { dateString } = getOperationalDateInfo();
    const badgeEl = document.getElementById("operationalDateBadge");
    if (badgeEl) {
      badgeEl.textContent = dateString;
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  const monthInput = document.getElementById("filterBulanRiwayat");
  if (monthInput) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${yyyy}-${mm}`;
  }
}

function showToast(type, title, message) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const iconMap = {
    success:
      '<i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>',
    error: '<i class="fa-solid fa-circle-xmark text-rose-400 text-base"></i>',
    warning:
      '<i class="fa-solid fa-triangle-exclamation text-amber-400 text-base"></i>',
    info: '<i class="fa-solid fa-circle-info text-sky-400 text-base"></i>',
  };

  const pill = document.createElement("div");
  pill.className =
    "pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full bg-gray-900 text-white shadow-xl border border-gray-800 transform transition-all duration-300 -translate-y-4 opacity-0";
  pill.innerHTML = `
    ${iconMap[type] || iconMap.info}
    <div class="text-left">
      <p class="text-xs font-extrabold leading-tight">${escapeHtml(title)}</p>
      <p class="text-[11px] font-medium text-gray-300 leading-tight">${escapeHtml(message)}</p>
    </div>
  `;

  container.appendChild(pill);
  requestAnimationFrame(() => {
    pill.classList.remove("-translate-y-4", "opacity-0");
    pill.classList.add("translate-y-0", "opacity-100");
  });

  setTimeout(() => {
    pill.classList.remove("translate-y-0", "opacity-100");
    pill.classList.add("-translate-y-4", "opacity-0");
    setTimeout(() => pill.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanAlphanumeric(str) {
  return String(str || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

/**
 * ============================================================================
 * SINKRONISASI DATA SUPABASE & FALLBACK LOCALSTORAGE MULTI-CUSTOMER
 * ============================================================================
 */
function getLocalOrderFallback() {
  try {
    const raw = localStorage.getItem("sim_inventory_list_order_fallback");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalOrderFallback(orders) {
  try {
    localStorage.setItem(
      "sim_inventory_list_order_fallback",
      JSON.stringify(orders),
    );
  } catch (e) {
    // Abaikan jika storage penuh
  }
}

async function fetchAllDatabaseData(silent = true) {
  if (!silent) {
    const spinner = document.getElementById("refreshSpinnerIcon");
    if (spinner) spinner.classList.add("fa-spin");
  }

  try {
    const [resBarang, resCustomer, resOrder, resMasuk, resKeluar, resUsers] =
      await Promise.all([
        supabaseClient.from("Master_Barang").select("*"),
        supabaseClient.from("Master_Customer").select("*"),
        supabaseClient.from("List_Order").select("*"),
        supabaseClient
          .from("Transaksi_Masuk")
          .select("*")
          .order("tanggal", { ascending: false })
          .limit(1000),
        supabaseClient
          .from("Transaksi_Keluar")
          .select("*")
          .order("tanggal", { ascending: false })
          .limit(1000),
        supabaseClient.from("Users").select("*"),
      ]);

    if (!resBarang.error && resBarang.data) masterBarangList = resBarang.data;
    if (!resCustomer.error && resCustomer.data)
      masterCustomerList = resCustomer.data;

    if (!resOrder.error && resOrder.data && resOrder.data.length > 0) {
      listOrderData = resOrder.data;
      saveLocalOrderFallback(listOrderData);
    } else if (resOrder.data && resOrder.data.length === 0) {
      listOrderData = getLocalOrderFallback();
    }

    if (!resMasuk.error && resMasuk.data) transaksiMasukList = resMasuk.data;
    if (!resKeluar.error && resKeluar.data)
      transaksiKeluarList = resKeluar.data;
    if (!resUsers.error && resUsers.data) usersList = resUsers.data;

    populateCustomerDropdowns();
    renderAllActiveViews();
  } catch (err) {
    if (!silent) {
      showToast(
        "error",
        "Koneksi Database",
        "Gagal memuat data terbaru dari Supabase.",
      );
    }
  } finally {
    if (!silent) {
      const spinner = document.getElementById("refreshSpinnerIcon");
      if (spinner) spinner.classList.remove("fa-spin");
    }
  }
}

async function manualRefreshData() {
  await fetchAllDatabaseData(false);
  showToast(
    "info",
    "Sinkronisasi Selesai",
    "Data Papan Kontrol telah diperbarui.",
  );
}

function renderAllActiveViews() {
  renderDashboardTable();
  if (activeTab === "analytics") renderAnalyticsCharts();
  if (activeTab === "history") renderHistoryTable();
  if (activeTab === "master-barang") renderMasterBarangTable();
  if (activeTab === "master-customer") renderMasterCustomerTable();
  if (activeTab === "users") renderUsersTable();
}

/**
 * ============================================================================
 * LOGIKA AUTO-ROLLOVER JAM 08:00 PAGI (`checkAndRunDailyRollover`)
 * ============================================================================
 */
async function checkAndRunDailyRollover() {
  const { dateString } = getOperationalDateInfo();

  try {
    const { data: sysRow, error } = await supabaseClient
      .from("Users")
      .select("*")
      .eq("username", "__SYSTEM_ROLLOVER__")
      .maybeSingle();

    if (error) return;

    if (!sysRow) {
      // Inisialisasi baris penanda tanggal operasional pertama kali
      await supabaseClient.from("Users").insert({
        username: "__SYSTEM_ROLLOVER__",
        password: dateString,
        role: "SYSTEM",
      });
      return;
    }

    // Jika tanggal operasional saat ini berbeda dengan yang tercatat di __SYSTEM_ROLLOVER__
    if (sysRow.password !== dateString) {
      isProcessing = true;
      showToast(
        "info",
        "Auto-Rollover 08:00",
        `Memproses tutup buku harian ke tanggal ${dateString}...`,
      );

      for (const item of masterBarangList) {
        const partOrders = getOrdersForPart(item.Part_Number);
        const totalQtyDay = partOrders.reduce(
          (acc, o) => acc + (Number(o.qty_order) || 0),
          0,
        );
        const currentStok = Number(item.stok) || 0;
        const currentAssy = Number(item.assy_fsg) || 0;

        const newOpeningStock = currentStok + currentAssy - totalQtyDay;

        await supabaseClient
          .from("Master_Barang")
          .update({
            stok: newOpeningStock,
            assy_fsg: 0,
          })
          .eq("Part_Number", item.Part_Number);
      }

      await supabaseClient
        .from("Users")
        .update({ password: dateString })
        .eq("username", "__SYSTEM_ROLLOVER__");

      await fetchAllDatabaseData(true);
      showToast(
        "success",
        "Rollover Selesai",
        "Stok awal telah diperbarui dan Assy FSG di-reset ke 0.",
      );
    }
  } catch (err) {
    console.error("Rollover error:", err);
  } finally {
    isProcessing = false;
  }
}

/**
 * ============================================================================
 * OTENTIKASI & HAK AKSES (RBAC)
 * ============================================================================
 */
function loadSessionUser() {
  try {
    const saved = sessionStorage.getItem("sim_inventory_user");
    if (saved) {
      currentUser = JSON.parse(saved);
    }
  } catch (e) {
    currentUser = null;
  }
}

function applyRbacUI() {
  const role = currentUser ? currentUser.role : "Guest";
  const username = currentUser ? currentUser.username : "Mode Tamu";

  const avatarEl = document.getElementById("userAvatarBadge");
  const nameEl = document.getElementById("sidebarUserName");
  const roleEl = document.getElementById("sidebarUserRole");
  const btnAuth = document.getElementById("btnSidebarAuth");

  if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = username;
  if (roleEl) roleEl.textContent = role === "Guest" ? "Read-Only" : role;

  if (btnAuth) {
    if (currentUser) {
      btnAuth.innerHTML =
        '<i class="fa-solid fa-right-from-bracket"></i><span>Keluar Sesi</span>';
      btnAuth.className =
        "w-full py-2.5 px-4 rounded-full bg-rose-50 text-rose-600 text-xs font-extrabold hover:bg-rose-100 transition flex items-center justify-center gap-2";
      btnAuth.onclick = logoutSession;
    } else {
      btnAuth.innerHTML =
        '<i class="fa-solid fa-right-to-bracket"></i><span>Masuk Akun</span>';
      btnAuth.className =
        "w-full py-2.5 px-4 rounded-full bg-gray-900 text-white text-xs font-extrabold hover:bg-gray-800 transition flex items-center justify-center gap-2";
      btnAuth.onclick = openLoginModal;
    }
  }

  const secOperasional = document.getElementById("sectionOperasional");
  const secMaster = document.getElementById("sectionMasterData");

  if (role === "Guest") {
    secOperasional.classList.add("hidden");
    secMaster.classList.add("hidden");
    if (activeTab !== "dashboard" && activeTab !== "analytics") {
      switchTab("dashboard");
    }
  } else if (role === "Warehouse" || role === "Produksi") {
    secOperasional.classList.remove("hidden");
    secMaster.classList.add("hidden");
    if (["master-barang", "master-customer", "users"].includes(activeTab)) {
      switchTab("dashboard");
    }
  } else if (role === "Admin") {
    secOperasional.classList.remove("hidden");
    secMaster.classList.remove("hidden");
  }

  // Visibilitas tombol pada Smart Scanner (Gun Batch & Camera Modal)
  const btnBatchIn = document.getElementById("btnBatchIn");
  const btnBatchOut = document.getElementById("btnBatchOut");
  const btnBatchAssy = document.getElementById("btnBatchAssy");

  const btnSmartIn = document.getElementById("btnSmartModalIn");
  const btnSmartOut = document.getElementById("btnSmartModalOut");
  const btnSmartAssy = document.getElementById("btnSmartModalAssy");
  const smartCustWrap = document.getElementById("smartModalCustomerWrap");

  if (role === "Admin") {
    btnBatchIn?.classList.remove("hidden");
    btnBatchOut?.classList.remove("hidden");
    btnBatchAssy?.classList.remove("hidden");
    btnSmartIn?.classList.remove("hidden");
    btnSmartOut?.classList.remove("hidden");
    btnSmartAssy?.classList.remove("hidden");
    smartCustWrap?.classList.remove("hidden");
  } else if (role === "Warehouse") {
    btnBatchIn?.classList.remove("hidden");
    btnBatchOut?.classList.remove("hidden");
    btnBatchAssy?.classList.add("hidden");
    btnSmartIn?.classList.remove("hidden");
    btnSmartOut?.classList.remove("hidden");
    btnSmartAssy?.classList.add("hidden");
    smartCustWrap?.classList.remove("hidden");
  } else if (role === "Produksi") {
    btnBatchIn?.classList.add("hidden");
    btnBatchOut?.classList.add("hidden");
    btnBatchAssy?.classList.remove("hidden");
    btnSmartIn?.classList.add("hidden");
    btnSmartOut?.classList.add("hidden");
    btnSmartAssy?.classList.remove("hidden");
    smartCustWrap?.classList.add("hidden");
  }

  renderDashboardTable();
}

async function openLoginModal() {
  const { value: formValues } = await swalUI.fire({
    title: "Masuk SIM-INVENTORY",
    html: `
      <div class="space-y-3 text-left mt-3">
        <div>
          <label class="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">Username</label>
          <input id="swalLoginUser" type="text" placeholder="Masukkan username..." class="w-full px-4 py-3 rounded-full bg-gray-50 border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-gray-900">
        </div>
        <div>
          <label class="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-1">Password</label>
          <input id="swalLoginPass" type="password" placeholder="Masukkan password..." class="w-full px-4 py-3 rounded-full bg-gray-50 border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:border-gray-900">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Masuk Sekarang",
    cancelButtonText: "Batal",
    preConfirm: () => {
      const u = document.getElementById("swalLoginUser").value.trim();
      const p = document.getElementById("swalLoginPass").value.trim();
      if (!u || !p) {
        Swal.showValidationMessage("Username dan Password wajib diisi");
        return false;
      }
      return { username: u, password: p };
    },
  });

  if (!formValues) return;

  isProcessing = true;
  try {
    const { data: allUsers } = await supabaseClient.from("Users").select("*");
    const realUsers = (allUsers || []).filter(
      (u) => u.username !== "__SYSTEM_ROLLOVER__" && u.role !== "SYSTEM",
    );

    // Auto-create admin/admin jika tabel Users belum memiliki akun sama sekali
    if (
      realUsers.length === 0 &&
      formValues.username.toLowerCase() === "admin"
    ) {
      const newAdmin = {
        username: "admin",
        password: formValues.password,
        role: "Admin",
      };
      await supabaseClient.from("Users").insert(newAdmin);
      currentUser = { username: "admin", role: "Admin" };
      sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
      await fetchAllDatabaseData(true);
      applyRbacUI();
      showToast(
        "success",
        "Inisialisasi Admin",
        "Akun Admin perdana berhasil dibuat dan masuk.",
      );
      return;
    }

    const matched = realUsers.find(
      (u) =>
        u.username.toLowerCase() === formValues.username.toLowerCase() &&
        u.password === formValues.password,
    );

    if (!matched) {
      showToast("error", "Gagal Masuk", "Username atau password tidak sesuai.");
      return;
    }

    currentUser = { username: matched.username, role: matched.role };
    sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
    applyRbacUI();
    showToast(
      "success",
      `Selamat Datang, ${matched.username}`,
      `Anda masuk dengan hak akses ${matched.role}.`,
    );
  } catch (err) {
    showToast(
      "error",
      "Kesalahan Sistem",
      "Tidak dapat memverifikasi sesi login.",
    );
  } finally {
    isProcessing = false;
  }
}

function logoutSession() {
  sessionStorage.removeItem("sim_inventory_user");
  currentUser = null;
  stopCameraScanner();
  applyRbacUI();
  showToast("info", "Sesi Berakhir", "Anda kembali ke Mode Tamu (Read-Only).");
}

/**
 * ============================================================================
 * NAVIGASI TAB & SIDEBAR
 * ============================================================================
 */
function switchTab(tabId) {
  activeTab = tabId;

  document
    .querySelectorAll(".tab-pane")
    .forEach((el) => el.classList.add("hidden"));
  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) targetPane.classList.remove("hidden");

  document.querySelectorAll(".nav-pill").forEach((btn) => {
    btn.className =
      "nav-pill w-full flex items-center gap-3.5 px-4 py-3 rounded-full text-xs font-bold transition-all text-gray-600 hover:bg-gray-100";
  });
  const activeBtn = document.getElementById(`nav-${tabId}`);
  if (activeBtn) {
    activeBtn.className =
      "nav-pill w-full flex items-center gap-3.5 px-4 py-3 rounded-full text-xs font-bold transition-all bg-gray-900 text-white";
  }

  const headerMap = {
    dashboard: [
      "Papan Kontrol Seat Assy",
      "Live Andon Monitoring & Kalkulasi Otomatis Multi-Customer (Auto-refresh 3 dtk)",
    ],
    analytics: [
      "Analitik Visual",
      "Top 5 Fast-Moving Seat Assy & Radar 10 Stok Terendah",
    ],
    scanner: [
      "Smart Scanner Operasional",
      "Penerjemah Barcode Otomotif ISO/EDI & Keranjang Troli Massal",
    ],
    history: [
      "Riwayat Transaksi & Log Target",
      "Rekapitulasi Pergerakan Stok Masuk, Pengiriman, dan Koreksi",
    ],
    "master-barang": [
      "Master Database Barang",
      "Manajemen SKU Seat Assy, Cetak Barcode CODE128 & Cascading Update",
    ],
    "master-customer": [
      "Master Database Customer",
      "Manajemen Pelanggan & Tujuan Pengiriman",
    ],
    users: [
      "Kelola Pengguna (RBAC)",
      "Pengaturan Akun Admin, Warehouse, dan Produksi",
    ],
  };

  if (headerMap[tabId]) {
    document.getElementById("pageHeaderTitle").textContent =
      headerMap[tabId][0];
    document.getElementById("pageHeaderSubtitle").textContent =
      headerMap[tabId][1];
  }

  if (tabId !== "scanner") {
    stopCameraScanner();
  } else if (scannerMode === "GUN") {
    setTimeout(() => document.getElementById("gunScannerInput")?.focus(), 100);
  }

  renderAllActiveViews();

  // Tutup sidebar mobile jika terbuka
  const sidebar = document.getElementById("mainSidebar");
  if (
    window.innerWidth < 1024 &&
    sidebar &&
    !sidebar.classList.contains("-translate-x-full")
  ) {
    sidebar.classList.add("-translate-x-full");
  }
}

function toggleSidebarMobile() {
  const sidebar = document.getElementById("mainSidebar");
  if (sidebar) {
    sidebar.classList.toggle("-translate-x-full");
  }
}

/**
 * ============================================================================
 * PAPAN KONTROL SEAT ASSY (MULTI-CUSTOMER, ROWSPAN, & KALKULATOR SELISIH)
 * ============================================================================
 */
function getCustomerDisplayName(idOrName) {
  if (!idOrName || idOrName === "-") return "-";
  const found = masterCustomerList.find(
    (c) => c.id_customer === idOrName || c.nama_customer === idOrName,
  );
  return found ? found.nama_customer : idOrName;
}

function getOrdersForPart(partNumber) {
  const orders = listOrderData.filter((o) => o.Part_Number === partNumber);
  if (orders.length > 0) return orders;

  // Fallback jika belum ada baris di List_Order: gunakan id_customer dari Master_Barang
  const barang = masterBarangList.find((b) => b.Part_Number === partNumber);
  return [
    {
      id: null,
      Part_Number: partNumber,
      id_customer: barang && barang.id_customer ? barang.id_customer : "-",
      qty_order: 0,
    },
  ];
}

function calculateQtyOutToday(partNumber, customerIdOrName) {
  const { startTime } = getOperationalDateInfo();
  const custName = getCustomerDisplayName(customerIdOrName).toUpperCase();
  const custCode = String(customerIdOrName || "-").toUpperCase();
  const partOrders = getOrdersForPart(partNumber);

  return transaksiKeluarList
    .filter((tx) => {
      if (tx.Part_Number !== partNumber) return false;
      const txTime = new Date(tx.tanggal);
      if (txTime < startTime) return false;

      const note = String(tx.catatan || "").toUpperCase();
      if (custName !== "-" && note.includes(custName)) return true;
      if (custCode !== "-" && note.includes(custCode)) return true;

      // Jika Part hanya memiliki 1 Customer dan catatan tidak mencantumkan nama customer lain
      if (
        partOrders.length === 1 &&
        !note.includes("TUJUAN:") &&
        !note.includes("DARI:")
      ) {
        return true;
      }
      return false;
    })
    .reduce((sum, tx) => sum + (Number(tx.qty) || 0), 0);
}

function buildExpandedDashboardRows() {
  const searchVal = (
    document.getElementById("searchDashboardInput")?.value || ""
  )
    .trim()
    .toLowerCase();
  const filterCust =
    document.getElementById("filterCustomerDashboard")?.value || "ALL";

  const rows = [];

  for (const item of masterBarangList) {
    const partOrders = getOrdersForPart(item.Part_Number);
    const totalQtyDayAllCustomers = partOrders.reduce(
      (acc, o) => acc + (Number(o.qty_order) || 0),
      0,
    );
    const stokAwal = Number(item.stok) || 0;
    const assyFsg = Number(item.assy_fsg) || 0;
    const variance = stokAwal + assyFsg - totalQtyDayAllCustomers;

    for (const ord of partOrders) {
      const custName = getCustomerDisplayName(ord.id_customer);
      const qtyDay = Number(ord.qty_order) || 0;
      const qtyOut = calculateQtyOutToday(item.Part_Number, ord.id_customer);
      const sisaDel = Math.max(0, qtyDay - qtyOut);

      if (
        filterCust !== "ALL" &&
        custName !== filterCust &&
        ord.id_customer !== filterCust
      ) {
        continue;
      }

      if (searchVal) {
        const haystack =
          `${item.Part_Number} ${item.nama_barang} ${item.No_Rel} ${custName}`.toLowerCase();
        if (!haystack.includes(searchVal)) continue;
      }

      rows.push({
        orderId: ord.id,
        id_customer: ord.id_customer || "-",
        customerName: custName,
        No_Rel: item.No_Rel || "-",
        Part_Number: item.Part_Number,
        nama_barang: item.nama_barang || "-",
        stokAwal,
        qtyDay,
        qtyOut,
        sisaDel,
        assyFsg,
        variance,
        totalQtyDayAllCustomers,
      });
    }
  }

  // Urutkan berdasarkan Customer (A-Z), lalu No_Rel (A-Z), lalu Part_Number
  rows.sort((a, b) => {
    const cComp = a.customerName.localeCompare(b.customerName, "id", {
      sensitivity: "base",
    });
    if (cComp !== 0) return cComp;
    const rComp = String(a.No_Rel).localeCompare(String(b.No_Rel), "id", {
      numeric: true,
      sensitivity: "base",
    });
    if (rComp !== 0) return rComp;
    return a.Part_Number.localeCompare(b.Part_Number);
  });

  return rows;
}

function renderDashboardTable() {
  const tbody = document.getElementById("dashboardTableBody");
  if (!tbody) return;

  const rows = buildExpandedDashboardRows();

  // Update KPI Cards
  const uniqueParts = new Set(masterBarangList.map((b) => b.Part_Number)).size;
  const totalTarget = rows.reduce((acc, r) => acc + r.qtyDay, 0);
  const totalOut = rows.reduce((acc, r) => acc + r.qtyOut, 0);
  const totalAssy = masterBarangList.reduce(
    (acc, b) => acc + (Number(b.assy_fsg) || 0),
    0,
  );

  document.getElementById("kpiTotalParts").textContent =
    uniqueParts.toLocaleString("id-ID");
  document.getElementById("kpiTotalTarget").textContent =
    totalTarget.toLocaleString("id-ID");
  document.getElementById("kpiTotalOut").textContent =
    totalOut.toLocaleString("id-ID");
  document.getElementById("kpiTotalAssy").textContent =
    totalAssy.toLocaleString("id-ID");

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-12 px-4 text-center text-xs font-bold text-gray-400">
          Tidak ada data Seat Assy yang cocok dengan filter pencarian.
        </td>
      </tr>
    `;
    return;
  }

  // Hitung rowspan untuk kolom Customer yang berurutan sama
  const customerRowSpans = new Array(rows.length).fill(0);
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && rows[j].customerName === rows[i].customerName) {
      j++;
    }
    customerRowSpans[i] = j - i;
    i = j;
  }

  const role = currentUser ? currentUser.role : "Guest";
  const canEditCust = role === "Admin" || role === "Warehouse";
  const canEditQtyDay = role === "Admin";
  const canEditQtyOut = role === "Admin" || role === "Warehouse";
  const canEditAssy = role === "Admin" || role === "Produksi";

  let html = "";

  rows.forEach((row, idx) => {
    const spanCount = customerRowSpans[idx];

    const varianceBadge =
      row.variance >= 0
        ? `<span class="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700">+${row.variance}</span>`
        : `<span class="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700">${row.variance}</span>`;

    const sisaBadge =
      row.sisaDel === 0 && row.qtyDay > 0
        ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700">SELESAI (0)</span>`
        : `<span class="text-sm font-extrabold text-gray-700">${row.sisaDel}</span>`;

    html += `<tr class="hover:bg-gray-50/70 transition">`;

    // Kolom CUST dengan penggabungan sel vertikal (rowspan)
    if (spanCount > 0) {
      html += `
        <td rowspan="${spanCount}" class="py-4 px-4 align-top bg-white">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gray-900 text-white text-xs font-extrabold shadow-xs">
            <i class="fa-solid fa-industry text-[10px] text-gray-300"></i>
            <span>${escapeHtml(row.customerName)}</span>
          </div>
        </td>
      `;
    }

    // Kolom NO REL + tombol ubah Customer per baris Part
    html += `
      <td class="py-4 px-4">
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-extrabold">${escapeHtml(row.No_Rel)}</span>
          ${
            canEditCust
              ? `
            <button
              onclick="promptUpdateCustomerPart('${escapeHtml(row.Part_Number)}', '${escapeHtml(row.id_customer)}', ${row.orderId || "null"})"
              title="Ubah / Tambah Customer untuk Part ini"
              class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-500 text-[10px] flex items-center justify-center transition"
            >
              <i class="fa-solid fa-user-gear"></i>
            </button>
          `
              : ""
          }
        </div>
      </td>
    `;

    // Kolom PART NUMBER & NAMA BARANG (Hirarki Tipografi Sesuai Design System)
    html += `
      <td class="py-4 px-4">
        <div class="text-base lg:text-lg font-extrabold text-gray-900 tracking-tight leading-snug">${escapeHtml(row.Part_Number)}</div>
        <div class="text-xs font-medium text-gray-400 uppercase tracking-wide">${escapeHtml(row.nama_barang)}</div>
      </td>
    `;

    // Kolom STOK AWAL
    html += `
      <td class="py-4 px-4 text-right">
        <span class="text-base lg:text-lg font-extrabold text-gray-900">${row.stokAwal}</span>
      </td>
    `;

    // Kolom QTY/DAY
    html += `
      <td class="py-4 px-4 text-center">
        ${
          canEditQtyDay
            ? `
          <button
            onclick="promptUpdateQtyDay('${escapeHtml(row.Part_Number)}', '${escapeHtml(row.id_customer)}', ${row.qtyDay}, ${row.orderId || "null"})"
            class="px-4 py-1.5 rounded-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-sm font-extrabold transition"
          >
            ${row.qtyDay}
          </button>
        `
            : `<span class="text-sm font-extrabold text-gray-800">${row.qtyDay}</span>`
        }
      </td>
    `;

    // Kolom QTY/OUT
    html += `
      <td class="py-4 px-4 text-center">
        ${
          canEditQtyOut
            ? `
          <button
            onclick="promptUpdateQtyOut('${escapeHtml(row.Part_Number)}', '${escapeHtml(row.id_customer)}', ${row.qtyOut})"
            class="px-4 py-1.5 rounded-full bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-800 text-sm font-extrabold transition"
          >
            ${row.qtyOut}
          </button>
        `
            : `<span class="text-sm font-extrabold text-gray-800">${row.qtyOut}</span>`
        }
      </td>
    `;

    // Kolom SISA DEL
    html += `<td class="py-4 px-4 text-center">${sisaBadge}</td>`;

    // Kolom ASSY IN STORE FSG
    html += `
      <td class="py-4 px-4 text-center">
        ${
          canEditAssy
            ? `
          <button
            onclick="promptUpdateAssyFsg('${escapeHtml(row.Part_Number)}', ${row.assyFsg})"
            class="px-4 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-sm font-extrabold transition"
          >
            ${row.assyFsg}
          </button>
        `
            : `<span class="text-sm font-extrabold text-gray-800">${row.assyFsg}</span>`
        }
      </td>
    `;

    // Kolom VARIANCE [+/-]
    html += `<td class="py-4 px-4 text-right">${varianceBadge}</td>`;

    html += `</tr>`;
  });

  tbody.innerHTML = html;
}

/**
 * ============================================================================
 * 4 POPUP KALKULATOR SELISIH OTOMATIS PAPAN KONTROL
 * ============================================================================
 */

// 1. Klik Kolom Stok Assy (`promptUpdateAssyFsg`) - Hanya Admin & Produksi
async function promptUpdateAssyFsg(partNumber, currentAssy) {
  const role = currentUser ? currentUser.role : "Guest";
  if (role !== "Admin" && role !== "Produksi") {
    showToast(
      "warning",
      "Akses Ditolak",
      "Hanya Produksi dan Admin yang diizinkan mengubah ASSY IN STORE FSG.",
    );
    return;
  }

  const { value: newTotalRaw } = await swalUI.fire({
    title: "Update ASSY IN STORE FSG",
    html: `
      <p class="text-xs font-bold text-gray-400 uppercase mb-2">${escapeHtml(partNumber)}</p>
      <div class="p-3 rounded-2xl bg-gray-50 border border-gray-100 mb-3">
        <span class="text-xs font-semibold text-gray-500">Stok Assy Saat Ini:</span>
        <span class="text-lg font-extrabold text-indigo-600 ml-1">${currentAssy} PCS</span>
      </div>
      <p class="text-xs text-gray-500">Masukkan <b>Total Akhir</b> stok Assy yang baru:</p>
    `,
    input: "number",
    inputValue: currentAssy,
    showCancelButton: true,
    confirmButtonText: "Simpan Total Baru",
    cancelButtonText: "Batal",
  });

  if (newTotalRaw === undefined || newTotalRaw === null || newTotalRaw === "")
    return;
  const newTotal = parseInt(newTotalRaw, 10);
  if (isNaN(newTotal) || newTotal < 0) {
    showToast(
      "error",
      "Input Tidak Valid",
      "Total akhir Assy tidak boleh negatif.",
    );
    return;
  }

  const diff = newTotal - Number(currentAssy);
  if (diff === 0) return;

  isProcessing = true;
  try {
    await supabaseClient
      .from("Master_Barang")
      .update({ assy_fsg: newTotal })
      .eq("Part_Number", partNumber);

    const catatanLog =
      diff > 0
        ? "Masuk Gudang FSG (Hasil Assy)"
        : "Koreksi Pengurangan Stok Assy";

    await supabaseClient.from("Transaksi_Masuk").insert({
      Part_Number: partNumber,
      qty: diff,
      petugas: currentUser.username,
      catatan: catatanLog,
      tanggal: new Date().toISOString(),
    });

    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Assy Diperbarui",
      `${partNumber}: Selisih ${diff > 0 ? "+" + diff : diff} tercatat.`,
    );
  } catch (err) {
    showToast(
      "error",
      "Gagal Update Assy",
      "Terjadi kesalahan saat menyimpan ke database.",
    );
  } finally {
    isProcessing = false;
  }
}

// 2. Klik Kolom Terkirim / QTY/OUT (`promptUpdateQtyOut`) - Hanya Admin & Warehouse
async function promptUpdateQtyOut(partNumber, idCustomer, currentQtyOut) {
  const role = currentUser ? currentUser.role : "Guest";
  if (role !== "Admin" && role !== "Warehouse") {
    showToast(
      "warning",
      "Akses Ditolak",
      "Hanya Warehouse dan Admin yang dapat mengubah QTY/OUT.",
    );
    return;
  }

  const customerName = getCustomerDisplayName(idCustomer);

  const { value: newTotalRaw } = await swalUI.fire({
    title: "Update Pengiriman (QTY/OUT)",
    html: `
      <p class="text-xs font-bold text-gray-400 uppercase">${escapeHtml(partNumber)}</p>
      <p class="text-xs font-extrabold text-gray-800 mb-3">Tujuan: ${escapeHtml(customerName)}</p>
      <div class="p-3 rounded-2xl bg-amber-50/70 border border-amber-100 mb-3">
        <span class="text-xs font-semibold text-amber-800">Terkirim Hari Ini:</span>
        <span class="text-lg font-extrabold text-amber-900 ml-1">${currentQtyOut} PCS</span>
      </div>
      <p class="text-xs text-gray-500">Masukkan <b>Total Akhir</b> pengiriman hari ini:</p>
    `,
    input: "number",
    inputValue: currentQtyOut,
    showCancelButton: true,
    confirmButtonText: "Simpan Pengiriman",
    cancelButtonText: "Batal",
  });

  if (newTotalRaw === undefined || newTotalRaw === null || newTotalRaw === "")
    return;
  const newTotal = parseInt(newTotalRaw, 10);
  if (isNaN(newTotal) || newTotal < 0) {
    showToast(
      "error",
      "Input Tidak Valid",
      "Total pengiriman tidak boleh kurang dari 0.",
    );
    return;
  }

  const diff = newTotal - Number(currentQtyOut);
  if (diff === 0) return;

  isProcessing = true;
  try {
    const catatanLog =
      diff > 0
        ? `Pengiriman Papan Kontrol - Tujuan: ${customerName}`
        : `Koreksi Batal Kirim - Dari: ${customerName}`;

    await supabaseClient.from("Transaksi_Keluar").insert({
      Part_Number: partNumber,
      qty: diff,
      petugas: currentUser.username,
      catatan: catatanLog,
      tanggal: new Date().toISOString(),
    });

    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "QTY/OUT Diperbarui",
      `${partNumber} (${customerName}): Selisih ${diff > 0 ? "+" + diff : diff} PCS.`,
    );
  } catch (err) {
    showToast(
      "error",
      "Gagal Update QTY/OUT",
      "Terjadi kendala koneksi database.",
    );
  } finally {
    isProcessing = false;
  }
}

// 3. Klik Kolom Target/Hari / QTY/DAY (`promptUpdateQtyDay`) - Hanya Admin
async function promptUpdateQtyDay(
  partNumber,
  idCustomer,
  currentQtyDay,
  orderId,
) {
  const role = currentUser ? currentUser.role : "Guest";
  if (role !== "Admin") {
    showToast(
      "warning",
      "Akses Ditolak",
      "Hanya Admin yang dapat mengubah Target Harian (QTY/DAY).",
    );
    return;
  }

  const customerName = getCustomerDisplayName(idCustomer);

  const { value: newTargetRaw } = await swalUI.fire({
    title: "Set Target Harian (QTY/DAY)",
    html: `
      <p class="text-xs font-bold text-gray-400 uppercase">${escapeHtml(partNumber)}</p>
      <p class="text-xs font-extrabold text-blue-600 mb-3">Customer: ${escapeHtml(customerName)}</p>
      <p class="text-xs text-gray-500">Masukkan target kuantitas order harian:</p>
    `,
    input: "number",
    inputValue: currentQtyDay,
    showCancelButton: true,
    confirmButtonText: "Simpan Target",
    cancelButtonText: "Batal",
  });

  if (
    newTargetRaw === undefined ||
    newTargetRaw === null ||
    newTargetRaw === ""
  )
    return;
  const newTarget = parseInt(newTargetRaw, 10);
  if (isNaN(newTarget) || newTarget < 0) return;

  isProcessing = true;
  try {
    if (orderId) {
      await supabaseClient
        .from("List_Order")
        .update({ qty_order: newTarget })
        .eq("id", orderId);
    } else {
      const { data: existing } = await supabaseClient
        .from("List_Order")
        .select("*")
        .eq("Part_Number", partNumber)
        .eq("id_customer", idCustomer)
        .maybeSingle();

      if (existing) {
        await supabaseClient
          .from("List_Order")
          .update({ qty_order: newTarget })
          .eq("id", existing.id);
      } else {
        await supabaseClient.from("List_Order").insert({
          Part_Number: partNumber,
          id_customer: idCustomer,
          qty_order: newTarget,
        });
      }
    }

    // Catat ke Transaksi_Masuk dengan qty: 0
    await supabaseClient.from("Transaksi_Masuk").insert({
      Part_Number: partNumber,
      qty: 0,
      petugas: currentUser.username,
      catatan: `Set Target QTY/DAY menjadi ${newTarget} Pcs (${customerName})`,
      tanggal: new Date().toISOString(),
    });

    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Target Disimpan",
      `Target ${partNumber} (${customerName}) diset ke ${newTarget} PCS.`,
    );
  } catch (err) {
    showToast("error", "Gagal Update Target", "Periksa koneksi database.");
  } finally {
    isProcessing = false;
  }
}

// 4. Klik Pengaturan Customer Baris Part (`promptUpdateCustomerPart`) - Admin & Warehouse
async function promptUpdateCustomerPart(
  partNumber,
  currentCustomerId,
  orderId,
) {
  const role = currentUser ? currentUser.role : "Guest";
  if (role !== "Admin" && role !== "Warehouse") return;

  const partOrders = getOrdersForPart(partNumber);
  const optionsHtml = masterCustomerList
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id_customer)}" ${c.id_customer === currentCustomerId ? "selected" : ""}>${escapeHtml(c.nama_customer)} (${escapeHtml(c.id_customer)})</option>`,
    )
    .join("");

  const result = await swalUI.fire({
    title: "Kelola Customer Part",
    html: `
      <p class="text-xs font-extrabold text-gray-900 mb-3">${escapeHtml(partNumber)}</p>
      <div class="text-left space-y-3">
        <div>
          <label class="block text-[11px] font-extrabold uppercase text-gray-400 mb-1">Pilih Customer</label>
          <select id="swalSelectCustPart" class="w-full px-4 py-3 rounded-full bg-gray-50 border border-gray-200 text-xs font-bold text-gray-900">
            <option value="-">-- Belum Ditentukan (-) --</option>
            ${optionsHtml}
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-extrabold uppercase text-gray-400 mb-1">Mode Aksi</label>
          <select id="swalModeCustAction" class="w-full px-4 py-3 rounded-full bg-gray-50 border border-gray-200 text-xs font-bold text-gray-900">
            <option value="UPDATE">Ubah Customer pada Baris Ini</option>
            <option value="ADD">Tambah Customer Baru untuk Part Ini (Multi-Customer)</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    showDenyButton: partOrders.length > 1,
    confirmButtonText: "Terapkan",
    denyButtonText: "Hapus Baris Customer Ini",
    cancelButtonText: "Batal",
    preConfirm: () => {
      return {
        selectedCust: document.getElementById("swalSelectCustPart").value,
        actionMode: document.getElementById("swalModeCustAction").value,
      };
    },
  });

  isProcessing = true;
  try {
    if (result.isDenied && orderId) {
      await supabaseClient.from("List_Order").delete().eq("id", orderId);
      await fetchAllDatabaseData(true);
      showToast(
        "info",
        "Baris Dihapus",
        "Alokasi customer untuk part tersebut telah dihapus.",
      );
      return;
    }

    if (result.isConfirmed && result.value) {
      const { selectedCust, actionMode } = result.value;

      if (actionMode === "ADD") {
        await supabaseClient.from("List_Order").insert({
          Part_Number: partNumber,
          id_customer: selectedCust,
          qty_order: 0,
        });
        showToast(
          "success",
          "Multi-Customer Ditambahkan",
          `Part ${partNumber} kini memiliki alokasi untuk ${getCustomerDisplayName(selectedCust)}.`,
        );
      } else {
        if (orderId) {
          await supabaseClient
            .from("List_Order")
            .update({ id_customer: selectedCust })
            .eq("id", orderId);
        } else {
          await supabaseClient.from("List_Order").insert({
            Part_Number: partNumber,
            id_customer: selectedCust,
            qty_order: 0,
          });
        }
        await supabaseClient
          .from("Master_Barang")
          .update({ id_customer: selectedCust })
          .eq("Part_Number", partNumber);
        showToast(
          "success",
          "Customer Diubah",
          `Customer untuk ${partNumber} diperbarui.`,
        );
      }
      await fetchAllDatabaseData(true);
    }
  } catch (err) {
    showToast(
      "error",
      "Gagal Memproses Customer",
      "Terjadi kesalahan pada database.",
    );
  } finally {
    isProcessing = false;
  }
}

/**
 * ============================================================================
 * PENERJEMAH BARCODE CERDAS (`parseYimmBarcode`) & DUAL SCANNER
 * ============================================================================
 */
function parseYimmBarcode(rawCode) {
  const raw = String(rawCode || "").trim();
  if (!raw) return { partNumber: "", qty: 1, format: "UNKNOWN" };

  // 1. Format 1 — Standar Otomotif Global (ISO/IEC 15434 / EDI): Diawali `[)>`
  if (raw.startsWith("[)>")) {
    const partMatch = raw.match(/P([A-Z0-9]+)V/i);
    const qtyMatch = raw.match(/Q(\d{6})/i);

    const extractedPart = partMatch ? partMatch[1].toUpperCase() : raw;
    const extractedQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

    return {
      partNumber: extractedPart,
      qty: isNaN(extractedQty) || extractedQty <= 0 ? 1 : extractedQty,
      format: "ISO_EDI_2D",
    };
  }

  // 2. Format 2 — Kanban / Troli Internal: Mengandung `|`
  if (raw.includes("|")) {
    const beforePipe = raw.split("|")[0].trim();
    const segments = beforePipe.split("-");

    if (segments.length > 1) {
      const lastSeg = segments[segments.length - 1];
      if (/^\d+$/.test(lastSeg)) {
        const extractedQty = parseInt(lastSeg, 10);
        const extractedPart = segments.slice(0, -1).join("-");
        return {
          partNumber: extractedPart,
          qty: isNaN(extractedQty) || extractedQty <= 0 ? 1 : extractedQty,
          format: "KANBAN_INTERNAL",
        };
      }
    }

    return {
      partNumber: beforePipe,
      qty: 1,
      format: "KANBAN_INTERNAL",
    };
  }

  // 3. Fallback Barcode 1D Standar (atau berakhiran -QTY)
  if (raw.includes("-")) {
    const segments = raw.split("-");
    const lastSeg = segments[segments.length - 1];
    // Jika segmen terakhir 3 digit dengan leading zero seperti -020 atau -040 dan bukan bagian dari kode part di DB
    const exactMatchInDb = masterBarangList.some(
      (b) => cleanAlphanumeric(b.Part_Number) === cleanAlphanumeric(raw),
    );
    if (!exactMatchInDb && /^\d{3}$/.test(lastSeg)) {
      const extractedQty = parseInt(lastSeg, 10);
      const extractedPart = segments.slice(0, -1).join("-");
      return {
        partNumber: extractedPart,
        qty: extractedQty > 0 ? extractedQty : 1,
        format: "KANBAN_SHORT",
      };
    }
  }

  return {
    partNumber: raw,
    qty: 1,
    format: "STANDARD_1D",
  };
}

function findMasterItemByScannedPart(scannedPart) {
  const targetClean = cleanAlphanumeric(scannedPart);
  if (!targetClean) return null;

  return (
    masterBarangList.find(
      (item) => cleanAlphanumeric(item.Part_Number) === targetClean,
    ) || null
  );
}

function switchScannerMode(mode) {
  scannerMode = mode;
  const gunWrap = document.getElementById("scannerGunContainer");
  const camWrap = document.getElementById("scannerCameraContainer");
  const btnGun = document.getElementById("btnModeGun");
  const btnCam = document.getElementById("btnModeCamera");

  if (mode === "GUN") {
    stopCameraScanner();
    gunWrap.classList.remove("hidden");
    camWrap.classList.add("hidden");
    btnGun.className =
      "px-5 py-2.5 rounded-full text-xs font-extrabold transition bg-gray-900 text-white flex items-center gap-2";
    btnCam.className =
      "px-5 py-2.5 rounded-full text-xs font-extrabold transition bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2";
    setTimeout(() => document.getElementById("gunScannerInput")?.focus(), 100);
  } else {
    gunWrap.classList.add("hidden");
    camWrap.classList.remove("hidden");
    btnCam.className =
      "px-5 py-2.5 rounded-full text-xs font-extrabold transition bg-gray-900 text-white flex items-center gap-2";
    btnGun.className =
      "px-5 py-2.5 rounded-full text-xs font-extrabold transition bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2";
    startCameraScanner();
  }
}

// MODE 1: GUN SCANNER (BATCH TROLLEY)
function setupGunScannerListener() {
  const input = document.getElementById("gunScannerInput");
  if (!input) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleGunScannerSubmit();
    }
  });
}

function handleGunScannerSubmit() {
  const input = document.getElementById("gunScannerInput");
  if (!input) return;
  const rawCode = input.value.trim();
  if (!rawCode) return;

  const parsed = parseYimmBarcode(rawCode);
  const matchedItem = findMasterItemByScannedPart(parsed.partNumber);

  if (!matchedItem) {
    showToast(
      "error",
      "Part Tidak Ditemukan",
      `Kode "${parsed.partNumber}" tidak cocok dengan Master Barang.`,
    );
    input.value = "";
    input.focus();
    return;
  }

  const existingIndex = batchTrolley.findIndex(
    (t) => t.Part_Number === matchedItem.Part_Number,
  );
  if (existingIndex > -1) {
    batchTrolley[existingIndex].trolleyCount += 1;
    batchTrolley[existingIndex].qtyInput += parsed.qty;
  } else {
    batchTrolley.push({
      Part_Number: matchedItem.Part_Number,
      nama_barang: matchedItem.nama_barang,
      No_Rel: matchedItem.No_Rel || "-",
      trolleyCount: 1,
      qtyInput: parsed.qty,
    });
  }

  input.value = "";
  input.focus();
  renderBatchTrolleyTable();
  showToast(
    "success",
    "Masuk Troli",
    `${matchedItem.Part_Number} (+${parsed.qty} PCS) ditambahkan.`,
  );
}

function renderBatchTrolleyTable() {
  const tbody = document.getElementById("batchTrolleyTableBody");
  const badge = document.getElementById("trolleyBadgeCount");
  if (!tbody) return;

  const totalTrolleys = batchTrolley.reduce(
    (acc, i) => acc + i.trolleyCount,
    0,
  );
  if (badge) badge.textContent = totalTrolleys;

  if (batchTrolley.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-10 px-4 text-center text-xs font-bold text-gray-400">
          Keranjang Troli masih kosong. Silakan tembak barcode menggunakan Gun Scanner.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = batchTrolley
    .map(
      (item, idx) => `
    <tr class="hover:bg-gray-50/70 transition">
      <td class="py-4 px-4">
        <div class="text-base font-extrabold text-gray-900">${escapeHtml(item.Part_Number)}</div>
        <div class="text-xs font-medium text-gray-400 uppercase">${escapeHtml(item.nama_barang)}</div>
      </td>
      <td class="py-4 px-4 text-center">
        <span class="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-extrabold">${escapeHtml(item.No_Rel)}</span>
      </td>
      <td class="py-4 px-4 text-center">
        <span class="px-3.5 py-1 rounded-full bg-gray-900 text-white text-xs font-extrabold">${item.trolleyCount}x Scan</span>
      </td>
      <td class="py-4 px-4 text-center">
        <input
          type="number"
          value="${item.qtyInput}"
          onchange="updateBatchTrolleyQty(${idx}, this.value)"
          class="w-28 py-1.5 px-3 rounded-full bg-gray-50 border border-gray-200 text-center text-sm font-extrabold text-gray-900 focus:outline-none focus:border-gray-900"
        />
      </td>
      <td class="py-4 px-4 text-right">
        <button
          onclick="removeBatchTrolleyItem(${idx})"
          class="w-8 h-8 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition inline-flex items-center justify-center"
        >
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function updateBatchTrolleyQty(idx, val) {
  const num = parseInt(val, 10);
  if (!isNaN(num) && num > 0 && batchTrolley[idx]) {
    batchTrolley[idx].qtyInput = num;
  }
}

function removeBatchTrolleyItem(idx) {
  batchTrolley.splice(idx, 1);
  renderBatchTrolleyTable();
}

function clearBatchTrolley() {
  batchTrolley = [];
  renderBatchTrolleyTable();
}

async function executeBatchTrolley(actionType) {
  if (batchTrolley.length === 0) {
    showToast(
      "warning",
      "Keranjang Kosong",
      "Scan minimal 1 barang terlebih dahulu.",
    );
    return;
  }

  const role = currentUser ? currentUser.role : "Guest";
  if (actionType === "ASSY" && role !== "Admin" && role !== "Produksi") {
    showToast(
      "error",
      "Akses Ditolak",
      "Warehouse dilarang mengisi ASSY IN STORE FSG.",
    );
    return;
  }
  if (
    (actionType === "IN" || actionType === "OUT") &&
    role !== "Admin" &&
    role !== "Warehouse"
  ) {
    showToast(
      "error",
      "Akses Ditolak",
      "Akun Produksi hanya untuk pengisian Assy FSG.",
    );
    return;
  }

  const selectedCustDropdown =
    document.getElementById("batchCustomerSelect")?.value || "-";

  isProcessing = true;
  try {
    for (const trolleyItem of batchTrolley) {
      const master = masterBarangList.find(
        (b) => b.Part_Number === trolleyItem.Part_Number,
      );
      if (!master) continue;
      const qty = Number(trolleyItem.qtyInput) || 0;
      if (qty <= 0) continue;

      if (actionType === "IN") {
        const newStok = (Number(master.stok) || 0) + qty;
        await supabaseClient
          .from("Master_Barang")
          .update({ stok: newStok })
          .eq("Part_Number", master.Part_Number);

        await supabaseClient.from("Transaksi_Masuk").insert({
          Part_Number: master.Part_Number,
          qty,
          petugas: currentUser.username,
          catatan: `Batch Gun Scanner Masuk (${trolleyItem.trolleyCount} Troli)`,
          tanggal: new Date().toISOString(),
        });
      } else if (actionType === "OUT") {
        const targetCust =
          selectedCustDropdown !== "-"
            ? selectedCustDropdown
            : master.id_customer || "-";
        const custDisplay = getCustomerDisplayName(targetCust);

        await supabaseClient.from("Transaksi_Keluar").insert({
          Part_Number: master.Part_Number,
          qty,
          petugas: currentUser.username,
          catatan: `Batch Scanner Delivery - Tujuan: ${custDisplay}`,
          tanggal: new Date().toISOString(),
        });
      } else if (actionType === "ASSY") {
        const newAssy = (Number(master.assy_fsg) || 0) + qty;
        await supabaseClient
          .from("Master_Barang")
          .update({ assy_fsg: newAssy })
          .eq("Part_Number", master.Part_Number);

        await supabaseClient.from("Transaksi_Masuk").insert({
          Part_Number: master.Part_Number,
          qty,
          petugas: currentUser.username,
          catatan: `Masuk Gudang FSG (Hasil Assy - ${trolleyItem.trolleyCount} Troli)`,
          tanggal: new Date().toISOString(),
        });
      }
    }

    batchTrolley = [];
    renderBatchTrolleyTable();
    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Eksekusi Massal Berhasil",
      "Seluruh item di keranjang troli telah disimpan ke database.",
    );
  } catch (err) {
    showToast(
      "error",
      "Eksekusi Gagal",
      "Terjadi kesalahan saat menyimpan transaksi batch.",
    );
  } finally {
    isProcessing = false;
  }
}

// MODE 2: KAMERA HP ZXING (`BrowserMultiFormatReader`)
async function startCameraScanner() {
  try {
    if (!zxingReader) {
      zxingReader = new ZXing.BrowserMultiFormatReader();
    }
    const videoInputDevices = await zxingReader.listVideoInputDevices();
    const selectEl = document.getElementById("cameraVideoSelect");

    if (
      selectEl &&
      selectEl.options.length === 0 &&
      videoInputDevices.length > 0
    ) {
      selectEl.innerHTML = videoInputDevices
        .map(
          (dev, idx) =>
            `<option value="${dev.deviceId}">${escapeHtml(dev.label || "Kamera " + (idx + 1))}</option>`,
        )
        .join("");
    }

    const selectedDeviceId =
      selectEl?.value ||
      (videoInputDevices[0] ? videoInputDevices[0].deviceId : undefined);

    await zxingReader.decodeFromVideoDevice(
      selectedDeviceId,
      "zxingVideoPreview",
      (result, err) => {
        if (result) {
          const rawText = result.getText();
          handleCameraCodeDetected(rawText);
        }
      },
    );
  } catch (err) {
    showToast(
      "warning",
      "Kamera Tidak Aktif",
      "Pastikan izin kamera diberikan pada browser Anda.",
    );
  }
}

function restartCameraScanner() {
  stopCameraScanner();
  startCameraScanner();
}

function stopCameraScanner() {
  if (zxingReader) {
    zxingReader.reset();
  }
}

function handleCameraCodeDetected(rawCode) {
  // Jeda kamera saat barcode terbaca
  stopCameraScanner();

  const parsed = parseYimmBarcode(rawCode);
  const matched = findMasterItemByScannedPart(parsed.partNumber);

  if (!matched) {
    showToast(
      "error",
      "Barcode Tidak Dikenal",
      `Part "${parsed.partNumber}" tidak ditemukan di Master Barang.`,
    );
    setTimeout(() => startCameraScanner(), 1500);
    return;
  }

  activeScannedItem = matched;

  document.getElementById("smartModalPartNumber").textContent =
    matched.Part_Number;
  document.getElementById("smartModalNamaBarang").textContent =
    matched.nama_barang;
  document.getElementById("smartModalNoRel").textContent =
    `No Rel: ${matched.No_Rel || "-"}`;
  document.getElementById("smartModalCurrentStock").textContent =
    `Stok Awal: ${matched.stok || 0}`;
  document.getElementById("smartModalCurrentAssy").textContent =
    `Assy FSG: ${matched.assy_fsg || 0}`;
  document.getElementById("smartModalQtyInput").value = parsed.qty;

  // Isi pilihan customer untuk part tersebut
  const custSelect = document.getElementById("smartModalCustomerSelect");
  if (custSelect) {
    const partOrders = getOrdersForPart(matched.Part_Number);
    custSelect.innerHTML = partOrders
      .map(
        (o) =>
          `<option value="${escapeHtml(o.id_customer)}">${escapeHtml(getCustomerDisplayName(o.id_customer))}</option>`,
      )
      .join("");
  }

  document.getElementById("modalSmartAction").classList.remove("hidden");
}

function closeSmartActionModal() {
  document.getElementById("modalSmartAction").classList.add("hidden");
  activeScannedItem = null;
  if (activeTab === "scanner" && scannerMode === "CAMERA") {
    startCameraScanner();
  }
}

async function submitSmartCameraAction(actionType) {
  if (!activeScannedItem) return;
  const qty = parseInt(document.getElementById("smartModalQtyInput").value, 10);
  if (isNaN(qty) || qty <= 0) {
    showToast(
      "warning",
      "Kuantitas Tidak Valid",
      "Masukkan jumlah lebih dari 0.",
    );
    return;
  }

  const custId =
    document.getElementById("smartModalCustomerSelect")?.value ||
    activeScannedItem.id_customer ||
    "-";
  const custName = getCustomerDisplayName(custId);

  isProcessing = true;
  try {
    if (actionType === "IN") {
      const newStok = (Number(activeScannedItem.stok) || 0) + qty;
      await supabaseClient
        .from("Master_Barang")
        .update({ stok: newStok })
        .eq("Part_Number", activeScannedItem.Part_Number);

      await supabaseClient.from("Transaksi_Masuk").insert({
        Part_Number: activeScannedItem.Part_Number,
        qty,
        petugas: currentUser.username,
        catatan: "Scan Kamera Masuk (Stok Utama)",
        tanggal: new Date().toISOString(),
      });
    } else if (actionType === "OUT") {
      await supabaseClient.from("Transaksi_Keluar").insert({
        Part_Number: activeScannedItem.Part_Number,
        qty,
        petugas: currentUser.username,
        catatan: `Scan Kamera Delivery - Tujuan: ${custName}`,
        tanggal: new Date().toISOString(),
      });
    } else if (actionType === "ASSY") {
      const newAssy = (Number(activeScannedItem.assy_fsg) || 0) + qty;
      await supabaseClient
        .from("Master_Barang")
        .update({ assy_fsg: newAssy })
        .eq("Part_Number", activeScannedItem.Part_Number);

      await supabaseClient.from("Transaksi_Masuk").insert({
        Part_Number: activeScannedItem.Part_Number,
        qty,
        petugas: currentUser.username,
        catatan: "Masuk Gudang FSG (Hasil Assy via Kamera)",
        tanggal: new Date().toISOString(),
      });
    }

    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Transaksi Berhasil",
      `${activeScannedItem.Part_Number} (${qty} PCS) berhasil diproses.`,
    );
    closeSmartActionModal();
  } catch (err) {
    showToast("error", "Transaksi Gagal", "Gagal menyimpan transaksi kamera.");
  } finally {
    isProcessing = false;
  }
}

/**
 * ============================================================================
 * MASTER DATA SUPER UNLOCKED (CASCADING PRIMARY KEY) & BULK DELETE ANTI-REFRESH
 * ============================================================================
 */
function renderMasterBarangTable() {
  const tbody = document.getElementById("masterBarangTableBody");
  if (!tbody) return;

  const q = (document.getElementById("searchMasterBarangInput")?.value || "")
    .trim()
    .toLowerCase();
  const filtered = masterBarangList.filter((b) => {
    if (!q) return true;
    return `${b.Part_Number} ${b.nama_barang} ${b.No_Rel} ${b.kategori}`
      .toLowerCase()
      .includes(q);
  });

  // Bersihkan item di selectedForDelete yang sudah tidak ada di database
  selectedForDelete = selectedForDelete.filter((pn) =>
    masterBarangList.some((b) => b.Part_Number === pn),
  );
  updateBulkDeleteButtonUI();

  const selectAllEl = document.getElementById("checkboxSelectAllBarang");
  if (selectAllEl) {
    selectAllEl.checked =
      filtered.length > 0 &&
      filtered.every((b) => selectedForDelete.includes(b.Part_Number));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-10 text-center text-xs font-bold text-gray-400">Belum ada data Master Barang.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((item) => {
      const isChecked = selectedForDelete.includes(item.Part_Number)
        ? "checked"
        : "";
      const custDisplay = getCustomerDisplayName(item.id_customer);

      return `
      <tr class="hover:bg-gray-50/70 transition">
        <td class="py-4 px-4 text-center">
          <input
            type="checkbox"
            ${isChecked}
            onchange="toggleSelectBarangItem('${escapeHtml(item.Part_Number)}', this.checked)"
            class="w-4 h-4 rounded accent-gray-900 cursor-pointer"
          />
        </td>
        <td class="py-4 px-4">
          <div class="text-base font-extrabold text-gray-900">${escapeHtml(item.Part_Number)}</div>
          <div class="text-xs font-medium text-gray-400 uppercase">${escapeHtml(item.nama_barang)}</div>
        </td>
        <td class="py-4 px-4">
          <span class="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-extrabold">${escapeHtml(item.No_Rel || "-")}</span>
        </td>
        <td class="py-4 px-4">
          <span class="text-xs font-bold text-gray-700">${escapeHtml(custDisplay)}</span>
        </td>
        <td class="py-4 px-4 text-center">
          <span class="text-xs font-extrabold text-gray-600">${item.standar_packing || 1} ${escapeHtml(item.satuan || "PCS")}</span>
        </td>
        <td class="py-4 px-4 text-right">
          <span class="text-base font-extrabold text-gray-900">${item.stok || 0}</span>
        </td>
        <td class="py-4 px-4 text-right">
          <span class="text-base font-extrabold text-indigo-600">${item.assy_fsg || 0}</span>
        </td>
        <td class="py-4 px-4 text-right space-x-1">
          <button
            onclick="printItemBarcode('${escapeHtml(item.Part_Number)}', '${escapeHtml(item.nama_barang)}', '${escapeHtml(item.No_Rel || "-")}')"
            title="Cetak Label Barcode CODE128"
            class="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-700 text-xs font-bold transition"
          >
            <i class="fa-solid fa-print"></i>
          </button>
          <button
            onclick="openModalMasterBarang('${escapeHtml(item.Part_Number)}')"
            title="Edit Barang (Termasuk Part Number)"
            class="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-700 text-xs font-bold transition"
          >
            <i class="fa-solid fa-pen"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function toggleSelectBarangItem(partNumber, checked) {
  if (checked) {
    if (!selectedForDelete.includes(partNumber))
      selectedForDelete.push(partNumber);
  } else {
    selectedForDelete = selectedForDelete.filter((id) => id !== partNumber);
  }
  updateBulkDeleteButtonUI();
}

function toggleSelectAllBarang(checkbox) {
  const q = (document.getElementById("searchMasterBarangInput")?.value || "")
    .trim()
    .toLowerCase();
  const visibleItems = masterBarangList.filter((b) => {
    if (!q) return true;
    return `${b.Part_Number} ${b.nama_barang} ${b.No_Rel} ${b.kategori}`
      .toLowerCase()
      .includes(q);
  });

  if (checkbox.checked) {
    visibleItems.forEach((b) => {
      if (!selectedForDelete.includes(b.Part_Number)) {
        selectedForDelete.push(b.Part_Number);
      }
    });
  } else {
    const visibleIds = visibleItems.map((b) => b.Part_Number);
    selectedForDelete = selectedForDelete.filter(
      (id) => !visibleIds.includes(id),
    );
  }
  renderMasterBarangTable();
}

function updateBulkDeleteButtonUI() {
  const btn = document.getElementById("btnBulkDeleteBarang");
  const txt = document.getElementById("bulkDeleteText");
  if (!btn || !txt) return;

  if (selectedForDelete.length > 0) {
    btn.classList.remove("hidden");
    txt.textContent = `Hapus (${selectedForDelete.length})`;
  } else {
    btn.classList.add("hidden");
  }
}

async function confirmBulkDeleteBarang() {
  if (selectedForDelete.length === 0) return;

  const { isConfirmed } = await swalUI.fire({
    title: `Hapus ${selectedForDelete.length} Barang?`,
    text: "Data barang beserta relasi ordernya akan dihapus secara permanen.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus Semua",
    cancelButtonText: "Batal",
  });

  if (!isConfirmed) return;

  isProcessing = true;
  try {
    await supabaseClient
      .from("List_Order")
      .delete()
      .in("Part_Number", selectedForDelete);
    await supabaseClient
      .from("Master_Barang")
      .delete()
      .in("Part_Number", selectedForDelete);

    selectedForDelete = [];
    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Bulk Delete Selesai",
      "Data barang terpilih berhasil dihapus.",
    );
  } catch (err) {
    showToast(
      "error",
      "Gagal Menghapus",
      "Terjadi kesalahan saat penghapusan massal.",
    );
  } finally {
    isProcessing = false;
  }
}

// Form Tambah / Edit Master Barang (Primary Key Unlocked + Cascading Update)
async function openModalMasterBarang(editPartNumber = null) {
  const existing = editPartNumber
    ? masterBarangList.find((b) => b.Part_Number === editPartNumber)
    : null;

  const custOptions = masterCustomerList
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id_customer)}" ${existing && existing.id_customer === c.id_customer ? "selected" : ""}>${escapeHtml(c.nama_customer)} (${escapeHtml(c.id_customer)})</option>`,
    )
    .join("");

  const { value: formData } = await swalUI.fire({
    title: existing
      ? "Edit Master Barang (PK Unlocked)"
      : "Tambah Master Barang",
    html: `
      <div class="space-y-3 text-left mt-2 text-xs">
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Part Number (Primary Key - Bisa Diedit)</label>
          <input id="mbPartNumber" type="text" value="${escapeHtml(existing ? existing.Part_Number : "")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Nama / Deskripsi Barang</label>
          <input id="mbNama" type="text" value="${escapeHtml(existing ? existing.nama_barang : "")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="font-extrabold text-gray-500 uppercase">No Rel</label>
            <input id="mbNoRel" type="text" value="${escapeHtml(existing ? existing.No_Rel : "-")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
          </div>
          <div>
            <label class="font-extrabold text-gray-500 uppercase">Customer Utama</label>
            <select id="mbCustomer" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
              <option value="-">-- Pilih --</option>
              ${custOptions}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="font-extrabold text-gray-500 uppercase">Stok Awal</label>
            <input id="mbStok" type="number" value="${existing ? existing.stok : 0}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
          </div>
          <div>
            <label class="font-extrabold text-gray-500 uppercase">Assy FSG</label>
            <input id="mbAssy" type="number" value="${existing ? existing.assy_fsg : 0}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
          </div>
          <div>
            <label class="font-extrabold text-gray-500 uppercase">Std Packing</label>
            <input id="mbStdPack" type="number" value="${existing ? existing.standar_packing : 1}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan Data",
    cancelButtonText: "Batal",
    preConfirm: () => {
      const pn = document.getElementById("mbPartNumber").value.trim();
      const nama = document.getElementById("mbNama").value.trim();
      if (!pn || !nama) {
        Swal.showValidationMessage("Part Number dan Nama Barang wajib diisi");
        return false;
      }
      return {
        Part_Number: pn,
        nama_barang: nama,
        No_Rel: document.getElementById("mbNoRel").value.trim() || "-",
        id_customer: document.getElementById("mbCustomer").value,
        stok: parseInt(document.getElementById("mbStok").value, 10) || 0,
        assy_fsg: parseInt(document.getElementById("mbAssy").value, 10) || 0,
        standar_packing:
          parseInt(document.getElementById("mbStdPack").value, 10) || 1,
        kategori: existing ? existing.kategori : "SEAT ASSY",
        satuan: existing ? existing.satuan : "PCS",
        stok_minimum: existing ? existing.stok_minimum : 10,
      };
    },
  });

  if (!formData) return;

  isProcessing = true;
  try {
    if (!existing) {
      await supabaseClient.from("Master_Barang").insert(formData);
      await supabaseClient.from("List_Order").insert({
        Part_Number: formData.Part_Number,
        id_customer: formData.id_customer,
        qty_order: 0,
      });
      showToast(
        "success",
        "Barang Ditambahkan",
        `${formData.Part_Number} berhasil disimpan.`,
      );
    } else {
      const oldPK = existing.Part_Number;
      const newPK = formData.Part_Number;

      if (oldPK !== newPK) {
        // Cascading Primary Key Update: Insert baru, update seluruh tabel anak, lalu hapus PK lama
        await supabaseClient.from("Master_Barang").insert(formData);
        await Promise.all([
          supabaseClient
            .from("List_Order")
            .update({ Part_Number: newPK })
            .eq("Part_Number", oldPK),
          supabaseClient
            .from("Transaksi_Masuk")
            .update({ Part_Number: newPK })
            .eq("Part_Number", oldPK),
          supabaseClient
            .from("Transaksi_Keluar")
            .update({ Part_Number: newPK })
            .eq("Part_Number", oldPK),
        ]);
        await supabaseClient
          .from("Master_Barang")
          .delete()
          .eq("Part_Number", oldPK);
        showToast(
          "success",
          "Cascading Update Berhasil",
          `Part Number ${oldPK} diubah menjadi ${newPK} di seluruh transaksi.`,
        );
      } else {
        await supabaseClient
          .from("Master_Barang")
          .update(formData)
          .eq("Part_Number", oldPK);
        showToast(
          "success",
          "Data Diperbarui",
          `${newPK} berhasil diperbarui.`,
        );
      }
    }
    await fetchAllDatabaseData(true);
  } catch (err) {
    showToast(
      "error",
      "Gagal Menyimpan",
      "Periksa apakah Part Number sudah digunakan.",
    );
  } finally {
    isProcessing = false;
  }
}

// Cetak Barcode CODE128 ke Jendela Print
function printItemBarcode(partNumber, namaBarang, noRel) {
  const canvas = document.getElementById("hiddenBarcodeCanvas");
  if (!canvas) return;

  JsBarcode(canvas, partNumber, {
    format: "CODE128",
    lineColor: "#111827",
    width: 2,
    height: 60,
    displayValue: true,
    fontSize: 14,
    font: "Plus Jakarta Sans",
    margin: 10,
  });

  const dataUrl = canvas.toDataURL("image/png");
  const printWin = window.open("", "_blank", "width=500,height=400");
  if (!printWin) {
    showToast(
      "warning",
      "Popup Diblokir",
      "Izinkan popup pada browser untuk mencetak label barcode.",
    );
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cetak Label — ${escapeHtml(partNumber)}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; margin: 0; }
        .label-box { border: 2px solid #000; border-radius: 12px; padding: 16px; display: inline-block; max-width: 340px; }
        .rel { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
        .desc { font-size: 11px; color: #444; text-transform: uppercase; margin-bottom: 10px; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body onload="window.print(); setTimeout(() => window.close(), 500);">
      <div class="label-box">
        <div class="rel">NO REL: ${escapeHtml(noRel)}</div>
        <div class="desc">${escapeHtml(namaBarang)}</div>
        <img src="${dataUrl}" alt="Barcode" />
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
}

/**
 * ============================================================================
 * MASTER CUSTOMER & KELOLA PENGGUNA (PRIMARY KEY UNLOCKED)
 * ============================================================================
 */
function populateCustomerDropdowns() {
  const dashSelect = document.getElementById("filterCustomerDashboard");
  const batchSelect = document.getElementById("batchCustomerSelect");

  if (dashSelect) {
    const currentVal = dashSelect.value || "ALL";
    dashSelect.innerHTML =
      `<option value="ALL">Semua Customer</option>` +
      masterCustomerList
        .map(
          (c) =>
            `<option value="${escapeHtml(c.nama_customer)}">${escapeHtml(c.nama_customer)}</option>`,
        )
        .join("");
    dashSelect.value = currentVal;
  }

  if (batchSelect) {
    const currentBatch = batchSelect.value || "-";
    batchSelect.innerHTML =
      `<option value="-">Pilih Otomatis / Default Part</option>` +
      masterCustomerList
        .map(
          (c) =>
            `<option value="${escapeHtml(c.id_customer)}">${escapeHtml(c.nama_customer)}</option>`,
        )
        .join("");
    batchSelect.value = currentBatch;
  }
}

function renderMasterCustomerTable() {
  const tbody = document.getElementById("masterCustomerTableBody");
  if (!tbody) return;

  if (masterCustomerList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-xs font-bold text-gray-400">Belum ada data Master Customer.</td></tr>`;
    return;
  }

  tbody.innerHTML = masterCustomerList
    .map(
      (c) => `
    <tr class="hover:bg-gray-50/70 transition">
      <td class="py-4 px-4">
        <span class="px-3.5 py-1 rounded-full bg-gray-900 text-white text-xs font-extrabold">${escapeHtml(c.id_customer)}</span>
      </td>
      <td class="py-4 px-4 font-extrabold text-gray-900">${escapeHtml(c.nama_customer)}</td>
      <td class="py-4 px-4 text-xs font-semibold text-gray-600">${escapeHtml(c.kontak || "-")}</td>
      <td class="py-4 px-4 text-xs font-medium text-gray-500">${escapeHtml(c.alamat || "-")}</td>
      <td class="py-4 px-4 text-right space-x-1">
        <button onclick="openModalMasterCustomer('${escapeHtml(c.id_customer)}')" class="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-700 text-xs font-bold transition">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button onclick="deleteMasterCustomer('${escapeHtml(c.id_customer)}')" class="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 text-xs font-bold transition">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function openModalMasterCustomer(editId = null) {
  const existing = editId
    ? masterCustomerList.find((c) => c.id_customer === editId)
    : null;

  const { value: formData } = await swalUI.fire({
    title: existing
      ? "Edit Master Customer (PK Unlocked)"
      : "Tambah Customer Baru",
    html: `
      <div class="space-y-3 text-left mt-2 text-xs">
        <div>
          <label class="font-extrabold text-gray-500 uppercase">ID Customer (Primary Key)</label>
          <input id="mcId" type="text" value="${escapeHtml(existing ? existing.id_customer : "")}" placeholder="Contoh: YIMM / SIM" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Nama Perusahaan / Customer</label>
          <input id="mcNama" type="text" value="${escapeHtml(existing ? existing.nama_customer : "")}" placeholder="Contoh: PT. YIMM" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Kontak PIC</label>
          <input id="mcKontak" type="text" value="${escapeHtml(existing ? existing.kontak : "-")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Alamat</label>
          <input id="mcAlamat" type="text" value="${escapeHtml(existing ? existing.alamat : "-")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan Customer",
    cancelButtonText: "Batal",
    preConfirm: () => {
      const id = document.getElementById("mcId").value.trim();
      const nama = document.getElementById("mcNama").value.trim();
      if (!id || !nama) {
        Swal.showValidationMessage("ID Customer dan Nama wajib diisi");
        return false;
      }
      return {
        id_customer: id,
        nama_customer: nama,
        kontak: document.getElementById("mcKontak").value.trim() || "-",
        alamat: document.getElementById("mcAlamat").value.trim() || "-",
      };
    },
  });

  if (!formData) return;

  isProcessing = true;
  try {
    if (!existing) {
      await supabaseClient.from("Master_Customer").insert(formData);
    } else {
      const oldId = existing.id_customer;
      const newId = formData.id_customer;
      if (oldId !== newId) {
        await supabaseClient.from("Master_Customer").insert(formData);
        await Promise.all([
          supabaseClient
            .from("Master_Barang")
            .update({ id_customer: newId })
            .eq("id_customer", oldId),
          supabaseClient
            .from("List_Order")
            .update({ id_customer: newId })
            .eq("id_customer", oldId),
        ]);
        await supabaseClient
          .from("Master_Customer")
          .delete()
          .eq("id_customer", oldId);
      } else {
        await supabaseClient
          .from("Master_Customer")
          .update(formData)
          .eq("id_customer", oldId);
      }
    }
    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Customer Disimpan",
      `Data ${formData.nama_customer} berhasil diperbarui.`,
    );
  } catch (err) {
    showToast(
      "error",
      "Gagal Menyimpan Customer",
      "Pastikan ID Customer tidak duplikat.",
    );
  } finally {
    isProcessing = false;
  }
}

async function deleteMasterCustomer(idCust) {
  const { isConfirmed } = await swalUI.fire({
    title: `Hapus Customer ${idCust}?`,
    text: "Data customer akan dihapus dari daftar.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
  });
  if (!isConfirmed) return;

  isProcessing = true;
  try {
    await supabaseClient
      .from("Master_Customer")
      .delete()
      .eq("id_customer", idCust);
    await fetchAllDatabaseData(true);
    showToast("info", "Customer Dihapus", `${idCust} telah dihapus.`);
  } finally {
    isProcessing = false;
  }
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const visibleUsers = usersList.filter(
    (u) => u.username !== "__SYSTEM_ROLLOVER__" && u.role !== "SYSTEM",
  );

  if (visibleUsers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-xs font-bold text-gray-400">Belum ada pengguna terdaftar.</td></tr>`;
    return;
  }

  const descMap = {
    Admin: "Akses Penuh (Master Data, Scanner, Semua Kolom Papan Kontrol)",
    Warehouse: "Scanner (Masuk & Keluar), Edit CUST & QTY/OUT di Papan Kontrol",
    Produksi: "Scanner (Tambah Assy), Edit ASSY IN STORE FSG di Papan Kontrol",
  };

  tbody.innerHTML = visibleUsers
    .map(
      (u) => `
    <tr class="hover:bg-gray-50/70 transition">
      <td class="py-4 px-4 font-extrabold text-gray-900">${escapeHtml(u.username)}</td>
      <td class="py-4 px-4">
        <span class="px-3.5 py-1 rounded-full bg-gray-900 text-white text-xs font-extrabold">${escapeHtml(u.role)}</span>
      </td>
      <td class="py-4 px-4 text-xs font-medium text-gray-500">${escapeHtml(descMap[u.role] || "-")}</td>
      <td class="py-4 px-4 text-right space-x-1">
        <button onclick="openModalUser('${escapeHtml(u.username)}')" class="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-700 text-xs font-bold transition">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button onclick="deleteUserAccount('${escapeHtml(u.username)}')" class="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 text-xs font-bold transition">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function openModalUser(editUsername = null) {
  const existing = editUsername
    ? usersList.find((u) => u.username === editUsername)
    : null;

  const { value: formData } = await swalUI.fire({
    title: existing ? "Edit Pengguna (PK Unlocked)" : "Tambah Pengguna Baru",
    html: `
      <div class="space-y-3 text-left mt-2 text-xs">
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Username</label>
          <input id="usrName" type="text" value="${escapeHtml(existing ? existing.username : "")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-extrabold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Password</label>
          <input id="usrPass" type="text" value="${escapeHtml(existing ? existing.password : "")}" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
        </div>
        <div>
          <label class="font-extrabold text-gray-500 uppercase">Role / Hak Akses</label>
          <select id="usrRole" class="w-full mt-1 px-4 py-2.5 rounded-full bg-gray-50 border border-gray-200 font-bold text-gray-900">
            <option value="Admin" ${existing && existing.role === "Admin" ? "selected" : ""}>Admin</option>
            <option value="Warehouse" ${existing && existing.role === "Warehouse" ? "selected" : ""}>Warehouse</option>
            <option value="Produksi" ${existing && existing.role === "Produksi" ? "selected" : ""}>Produksi</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan Akun",
    cancelButtonText: "Batal",
    preConfirm: () => {
      const u = document.getElementById("usrName").value.trim();
      const p = document.getElementById("usrPass").value.trim();
      const r = document.getElementById("usrRole").value;
      if (!u || !p) {
        Swal.showValidationMessage("Username dan Password wajib diisi");
        return false;
      }
      return { username: u, password: p, role: r };
    },
  });

  if (!formData) return;

  isProcessing = true;
  try {
    if (!existing) {
      await supabaseClient.from("Users").insert(formData);
    } else {
      const oldU = existing.username;
      const newU = formData.username;
      if (oldU !== newU) {
        await supabaseClient.from("Users").insert(formData);
        await Promise.all([
          supabaseClient
            .from("Transaksi_Masuk")
            .update({ petugas: newU })
            .eq("petugas", oldU),
          supabaseClient
            .from("Transaksi_Keluar")
            .update({ petugas: newU })
            .eq("petugas", oldU),
        ]);
        await supabaseClient.from("Users").delete().eq("username", oldU);
      } else {
        await supabaseClient
          .from("Users")
          .update(formData)
          .eq("username", oldU);
      }
    }
    await fetchAllDatabaseData(true);
    showToast(
      "success",
      "Akun Disimpan",
      `Pengguna ${formData.username} (${formData.role}) berhasil disimpan.`,
    );
  } catch (err) {
    showToast(
      "error",
      "Gagal Menyimpan Akun",
      "Username mungkin sudah terdaftar.",
    );
  } finally {
    isProcessing = false;
  }
}

async function deleteUserAccount(username) {
  const { isConfirmed } = await swalUI.fire({
    title: `Hapus Akun ${username}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Ya, Hapus",
    cancelButtonText: "Batal",
  });
  if (!isConfirmed) return;

  isProcessing = true;
  try {
    await supabaseClient.from("Users").delete().eq("username", username);
    await fetchAllDatabaseData(true);
    showToast("info", "Akun Dihapus", `${username} telah dihapus.`);
  } finally {
    isProcessing = false;
  }
}

/**
 * ============================================================================
 * FILTER BULANAN, RIWAYAT CERDAS, & EKSPOR EXCEL (.XLSX)
 * ============================================================================
 */
function getFilteredHistoryRecords() {
  const monthFilter =
    document.getElementById("filterBulanRiwayat")?.value || ""; // YYYY-MM
  const typeFilter =
    document.getElementById("filterTipeRiwayat")?.value || "ALL";
  const searchVal = (document.getElementById("searchHistoryInput")?.value || "")
    .trim()
    .toLowerCase();

  const merged = [];

  if (typeFilter === "ALL" || typeFilter === "IN") {
    transaksiMasukList.forEach((tx) => {
      merged.push({ ...tx, txType: "IN" });
    });
  }

  if (typeFilter === "ALL" || typeFilter === "OUT") {
    transaksiKeluarList.forEach((tx) => {
      merged.push({ ...tx, txType: "OUT" });
    });
  }

  const filtered = merged.filter((tx) => {
    if (monthFilter && tx.tanggal) {
      const d = new Date(tx.tanggal);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      if (`${yyyy}-${mm}` !== monthFilter) return false;
    }

    if (searchVal) {
      const barang = masterBarangList.find(
        (b) => b.Part_Number === tx.Part_Number,
      );
      const nama = barang ? barang.nama_barang : "";
      const hay =
        `${tx.Part_Number} ${nama} ${tx.petugas} ${tx.catatan}`.toLowerCase();
      if (!hay.includes(searchVal)) return false;
    }

    return true;
  });

  filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  return filtered;
}

function renderHistoryTable() {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  const records = getFilteredHistoryRecords();

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-xs font-bold text-gray-400">
          Tidak ada riwayat transaksi pada periode bulan dan filter yang dipilih.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = records
    .map((tx) => {
      const barang = masterBarangList.find(
        (b) => b.Part_Number === tx.Part_Number,
      );
      const namaBarang = barang ? barang.nama_barang : "-";
      const waktuStr = tx.tanggal
        ? new Date(tx.tanggal).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "-";

      const note = String(tx.catatan || "");
      const qtyNum = Number(tx.qty) || 0;

      let typeBadgeHtml = "";
      let qtyDisplayHtml = "";

      // Logika tampilan kolom Jumlah di tabel Riwayat sesuai spesifikasi
      if (note.toUpperCase().includes("QTY/DAY")) {
        typeBadgeHtml = `<span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold">SET</span>`;
        qtyDisplayHtml = `<span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">TARGET</span>`;
      } else if (tx.txType === "IN") {
        typeBadgeHtml = `<span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold">IN</span>`;
        if (qtyNum >= 0) {
          qtyDisplayHtml = `<span class="text-base font-extrabold text-emerald-600">+${qtyNum}</span>`;
        } else {
          qtyDisplayHtml = `<span class="text-base font-extrabold text-rose-600">${qtyNum}</span>`;
        }
      } else {
        typeBadgeHtml = `<span class="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-extrabold">OUT</span>`;
        if (qtyNum >= 0) {
          qtyDisplayHtml = `<span class="text-base font-extrabold text-rose-600">-${qtyNum}</span>`;
        } else {
          qtyDisplayHtml = `<span class="text-base font-extrabold text-emerald-600">+${Math.abs(qtyNum)}</span>`;
        }
      }

      return `
      <tr class="hover:bg-gray-50/70 transition">
        <td class="py-4 px-4 text-xs font-bold text-gray-500">${escapeHtml(waktuStr)}</td>
        <td class="py-4 px-4">${typeBadgeHtml}</td>
        <td class="py-4 px-4">
          <div class="text-base font-extrabold text-gray-900">${escapeHtml(tx.Part_Number)}</div>
          <div class="text-xs font-medium text-gray-400 uppercase">${escapeHtml(namaBarang)}</div>
        </td>
        <td class="py-4 px-4 text-center">${qtyDisplayHtml}</td>
        <td class="py-4 px-4">
          <span class="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">${escapeHtml(tx.petugas || "System")}</span>
        </td>
        <td class="py-4 px-4 text-xs font-semibold text-gray-700">${escapeHtml(note)}</td>
      </tr>
    `;
    })
    .join("");
}

// Ekspor Papan Kontrol ke Excel (.xlsx)
function exportDashboardToExcel() {
  const rows = buildExpandedDashboardRows();
  const { dateString } = getOperationalDateInfo();

  const excelData = rows.map((r) => ({
    CUSTOMER: r.customerName,
    "NO REL": r.No_Rel,
    "PART NUMBER": r.Part_Number,
    "NAMA BARANG": r.nama_barang,
    "STOK AWAL": r.stokAwal,
    "QTY/DAY (TARGET)": r.qtyDay,
    "QTY/OUT (TERKIRIM)": r.qtyOut,
    "SISA DELIVERY": r.sisaDel,
    "ASSY IN STORE FSG": r.assyFsg,
    "VARIANCE [+/-]": r.variance,
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Papan_Kontrol");
  XLSX.writeFile(wb, `Laporan_Papan_Kontrol_${dateString}.xlsx`);
  showToast(
    "success",
    "Ekspor Berhasil",
    `File Laporan_Papan_Kontrol_${dateString}.xlsx diunduh.`,
  );
}

// Ekspor Riwayat Transaksi ke Excel (.xlsx)
function exportHistoryToExcel() {
  const records = getFilteredHistoryRecords();
  const monthFilter =
    document.getElementById("filterBulanRiwayat")?.value || "ALL";

  const excelData = records.map((tx) => {
    const barang = masterBarangList.find(
      (b) => b.Part_Number === tx.Part_Number,
    );
    return {
      "WAKTU TRANSAKSI": tx.tanggal
        ? new Date(tx.tanggal).toLocaleString("id-ID")
        : "-",
      TIPE: String(tx.catatan || "").includes("QTY/DAY")
        ? "SET TARGET"
        : tx.txType,
      "PART NUMBER": tx.Part_Number,
      "NAMA BARANG": barang ? barang.nama_barang : "-",
      JUMLAH: tx.qty,
      PETUGAS: tx.petugas || "System",
      CATATAN: tx.catatan || "-",
    };
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat_Transaksi");
  XLSX.writeFile(wb, `Laporan_Riwayat_Transaksi_${monthFilter}.xlsx`);
  showToast(
    "success",
    "Ekspor Berhasil",
    `File Laporan_Riwayat_Transaksi_${monthFilter}.xlsx diunduh.`,
  );
}

/**
 * ============================================================================
 * ANALITIK VISUAL (CHART.JS MINIMALIS NORDIC)
 * ============================================================================
 */
function renderAnalyticsCharts() {
  const ctxFast = document.getElementById("chartFastMoving");
  const ctxLow = document.getElementById("chartLowestStock");
  if (!ctxFast || !ctxLow) return;

  // 1. Hitung Top 5 Fast-Moving dari akumulasi Transaksi_Keluar
  const outMap = {};
  transaksiKeluarList.forEach((tx) => {
    const q = Number(tx.qty) || 0;
    if (q > 0) {
      outMap[tx.Part_Number] = (outMap[tx.Part_Number] || 0) + q;
    }
  });

  const sortedFast = Object.entries(outMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const fastLabels =
    sortedFast.length > 0 ? sortedFast.map((i) => i[0]) : ["Belum Ada Data"];
  const fastData = sortedFast.length > 0 ? sortedFast.map((i) => i[1]) : [0];

  if (chartFastMovingInstance) chartFastMovingInstance.destroy();
  chartFastMovingInstance = new Chart(ctxFast, {
    type: "bar",
    data: {
      labels: fastLabels,
      datasets: [
        {
          label: "Total Terkirim (PCS)",
          data: fastData,
          backgroundColor: "#111827",
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: {
            font: { family: "Plus Jakarta Sans", weight: "700", size: 11 },
            color: "#6B7280",
          },
        },
        y: {
          grid: { color: "#F3F4F6", drawBorder: false },
          border: { display: false },
          ticks: {
            font: { family: "Plus Jakarta Sans", weight: "600", size: 11 },
            color: "#9CA3AF",
          },
        },
      },
    },
  });

  // 2. Hitung Radar 10 Stok Terendah
  const sortedLow = [...masterBarangList]
    .map((b) => ({
      part: b.Part_Number,
      totalReady: (Number(b.stok) || 0) + (Number(b.assy_fsg) || 0),
    }))
    .sort((a, b) => a.totalReady - b.totalReady)
    .slice(0, 10);

  const lowLabels =
    sortedLow.length > 0 ? sortedLow.map((i) => i.part) : ["Belum Ada Barang"];
  const lowData =
    sortedLow.length > 0 ? sortedLow.map((i) => i.totalReady) : [0];

  if (chartLowestStockInstance) chartLowestStockInstance.destroy();
  chartLowestStockInstance = new Chart(ctxLow, {
    type: "bar",
    data: {
      labels: lowLabels,
      datasets: [
        {
          label: "Stok Ready (Stok Awal + Assy)",
          data: lowData,
          backgroundColor: "#E11D48",
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 22,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          border: { display: false },
          ticks: {
            font: { family: "Plus Jakarta Sans", weight: "700", size: 10 },
            color: "#6B7280",
          },
        },
        y: {
          grid: { color: "#F3F4F6", drawBorder: false },
          border: { display: false },
          ticks: {
            font: { family: "Plus Jakarta Sans", weight: "600", size: 11 },
            color: "#9CA3AF",
          },
        },
      },
    },
  });
}

// =========================================================================
// KONFIGURASI API & STATE GLOBAL
// =========================================================================
const API_URL =
  "https://script.google.com/macros/s/AKfycbwzjcbbXsU6_lj5Y2X6lEDMsIyUt545kky3Akw4Hdb2atVB0wejFTRSaXaJASxDhs6MjA/exec";

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

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  // AUTO REFRESH DIAM-DIAM SETIAP 30 DETIK
  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    if (overviewTab && !overviewTab.classList.contains("hidden")) {
      fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "apiGetMasterData", payload: {} }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res && res.success) {
            appData.barang = res.barang || [];
            appData.customer = res.customer || [];
            appData.orders = res.orders || [];
            appData.masuk = res.masuk || [];
            appData.keluar = res.keluar || [];

            buildSeatAssyControlDataset();
            renderSeatAssyControlBoard();

            const spinner = document.getElementById("syncSpinner");
            if (spinner) {
              spinner.classList.add(
                "rotate-180",
                "text-brand-500",
                "transition-transform",
                "duration-700",
              );
              setTimeout(
                () => spinner.classList.remove("rotate-180", "text-brand-500"),
                1000,
              );
            }
          }
        })
        .catch(() => console.log("Auto-refresh background tertunda."));
    }
  }, 30000);
});

// =========================================================================
// KOMUNIKASI API (FETCH) DILENGKAPI AUTO-RETRY
// =========================================================================
async function sendToBackend(action, payload = {}) {
  if (API_URL === "PASTE_URL_WEB_APP_ANDA_DISINI" || !API_URL) {
    throw new Error(
      "PENTING: Anda belum memasukkan API_URL dari Google Apps Script!",
    );
  }

  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload }),
      });
      const textResult = await response.text();
      try {
        return JSON.parse(textResult);
      } catch (jsonErr) {
        throw new Error("Server Google sedang sibuk. Mengulangi koneksi...");
      }
    } catch (error) {
      retries--;
      if (retries === 0)
        throw new Error(
          "Gagal terhubung ke database server. Pastikan jaringan stabil.",
        );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

// =========================================================================
// TAMPILAN, NAVIGASI & HAK AKSES
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
  document
    .getElementById("sidebarBackdrop")
    .classList.add("opacity-0", "pointer-events-none");
  document.getElementById("sidebarBackdrop").classList.remove("opacity-100");
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
    btn.classList.remove("bg-brand-50", "text-brand-600", "font-semibold");
    btn.classList.add("text-slate-600");
  });

  const activeNav = document.getElementById(`btn-tab-${tabId}`);
  if (activeNav) {
    activeNav.classList.add("bg-brand-50", "text-brand-600", "font-semibold");
    activeNav.classList.remove("text-slate-600");
  }

  if (tabId === "overview") renderSeatAssyControlBoard();
}

function applyRbacUI() {
  const pCard = document.getElementById("userProfileCard"),
    gPrompt = document.getElementById("guestLoginPrompt"),
    qBtn = document.getElementById("quickNavLoginBtn"),
    gTitle = document.getElementById("greetingTitle");

  document
    .querySelectorAll(".role-admin")
    .forEach((el) => el.classList.add("hidden"));

  if (currentUser) {
    pCard.classList.remove("hidden");
    pCard.classList.add("flex");
    gPrompt.classList.add("hidden");
    qBtn.classList.add("hidden");
    document.getElementById("userNameDisplay").innerText = currentUser.username;
    document.getElementById("userRoleBadge").innerText = currentUser.role;
    document.getElementById("avatarLetter").innerText = currentUser.username
      .charAt(0)
      .toUpperCase();
    gTitle.innerText = `Halo, ${currentUser.username}!`;

    if (currentUser.role === "Admin")
      document
        .querySelectorAll(".role-admin")
        .forEach((el) => el.classList.remove("hidden"));
  } else {
    pCard.classList.add("hidden");
    pCard.classList.remove("flex");
    gPrompt.classList.remove("hidden");
    qBtn.classList.remove("hidden");
    gTitle.innerText = "Halo, Selamat Datang!";
  }
}

// =========================================================================
// AMBIL DATA & RENDER TABEL (DASHBOARD LOGIC)
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
    .then((res) => {
      showSyncSpinner(false);
      if (res && res.success) {
        appData.barang = res.barang || [];
        appData.customer = res.customer || [];
        appData.orders = res.orders || [];
        appData.masuk = res.masuk || [];
        appData.keluar = res.keluar || [];

        buildSeatAssyControlDataset();
        refreshAllUI();
      } else {
        Swal.fire(
          "Error Database",
          res.message || "Gagal memuat data dari spreadsheet",
          "error",
        );
      }
    })
    .catch((err) => {
      showSyncSpinner(false);
      Swal.fire("Koneksi Terputus", err.message, "error");
    });
}

function buildSeatAssyControlDataset() {
  const list = [];

  appData.barang.forEach((itemBarang, index) => {
    const partNum = String(itemBarang.Part_Number).trim();

    // Cek apakah barang ini punya target order (QTY/DAY)
    const relatedOrders = appData.orders.filter(
      (o) => String(o.Part_Number).trim() === partNum,
    );

    // CUSTOMER: Ambil dari pesanan, jika tidak ada cek master barang
    let custName = "-";
    if (relatedOrders.length > 0) custName = relatedOrders[0].id_customer;
    else if (itemBarang.id_customer) custName = itemBarang.id_customer;

    // QTY/DAY = Total target pesanan
    const qtyDay = relatedOrders.reduce(
      (sum, o) => sum + (Number(o.qty_order) || 0),
      0,
    );

    // QTY OUT = Total barang yang sudah di-scan keluar
    const qtyOut = appData.keluar
      .filter((k) => String(k.Part_Number).trim() === partNum)
      .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);

    // SISA DEL = Target - Keluar
    const sisaDel = Math.max(0, qtyDay - qtyOut);

    // STOCK = Stok fisik gudang saat ini (dibaca langsung dari master)
    const currentStock = Number(itemBarang.stok) || 0;

    // ASSY & VARIANCE
    const assyFsg = Math.floor(currentStock * 0.4);
    const variance = currentStock - qtyOut;

    list.push({
      Customer: custName,
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

function refreshAllUI() {
  renderSeatAssyControlBoard();
  renderMasterBarangTable();
  renderCustomerTable();
  renderUsersTable();
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
        d.nama_barang.toLowerCase().includes(kw) ||
        d.No_Rel.toLowerCase().includes(kw),
    );
  }

  document.getElementById("cntTotalSeatAssy").innerText = dataset.length;

  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map((row) => {
      const formatNum = (num) => (num === 0 ? "-" : num);

      return `<tr class="hover:bg-blue-50 transition-colors">
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-extrabold text-slate-500 break-words">${row.Customer}</td>
      <td class="py-2 px-1 border-2 border-slate-800 font-extrabold text-slate-800 bg-slate-100">${row.No_Rel}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left">
        <div class="font-black text-slate-900 text-sm tracking-tighter">${row.Part_Number}</div>
        <div class="text-[10px] text-slate-500 truncate max-w-[120px] leading-none mt-0.5">${row.nama_barang}</div>
      </td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-blue-800 text-base bg-blue-50/30">${formatNum(row.stock)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.qty_day)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.qty_out)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.sisa_del)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.assy_fsg)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${row.variance > 0 ? "+" + row.variance : row.variance}</td>
    </tr>`;
    })
    .join("");
}

function handleGlobalSearch(keyword) {
  renderSeatAssyControlBoard(keyword);
}

// =========================================================================
// MASTER DATA TABLES
// =========================================================================
function renderMasterBarangTable() {
  const tbody = document.getElementById("tblMasterBarangBody");
  if (!tbody) return;
  if (appData.barang.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">Tidak ada barang.</td></tr>`;
    return;
  }
  tbody.innerHTML = appData.barang
    .map(
      (b) =>
        `<tr class="hover:bg-slate-50 border-b"><td class="py-2 font-bold">${b.Part_Number}</td><td class="py-2">${b.nama_barang}</td><td class="py-2 font-bold">${b.stok}</td><td class="py-2 text-brand-700">${b.No_Rel || "-"}</td></tr>`,
    )
    .join("");
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
        `<tr class="hover:bg-slate-50 border-b"><td class="py-2 font-bold">${c.id_customer}</td><td class="py-2 font-bold text-slate-900">${c.nama_customer}</td><td class="py-2 text-slate-600">${c.alamat || "-"}</td></tr>`,
    )
    .join("");
}

function renderUsersTable() {
  const tbody = document.getElementById("tblUsersBody");
  if (!tbody) return;
  const usersList = [
    { username: "admin", role: "Admin" },
    { username: "prod01", role: "Produksi" },
    { username: "wh01", role: "Warehouse" },
  ];
  tbody.innerHTML = usersList
    .map(
      (u) =>
        `<tr class="hover:bg-slate-50 border-b"><td class="py-2 font-bold">${u.username}</td><td class="py-2"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">${u.role}</span></td></tr>`,
    )
    .join("");
}

// =========================================================================
// API MASTER DATA (Hanya untuk simpan Master Data & Login)
// =========================================================================
function handleSaveBarang(e) {
  e.preventDefault();
  const payload = {
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
    user: currentUser ? currentUser.username : "Admin",
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveBarang", payload).then((res) => {
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      document.getElementById("formMasterBarang").reset();
      closeModalBarang();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

function handleSaveCustomer(e) {
  e.preventDefault();
  const payload = {
    cust: {
      id_customer: document.getElementById("mcId").value.trim(),
      nama_customer: document.getElementById("mcNama").value.trim(),
      kontak: document.getElementById("mcKontak").value.trim(),
      alamat: document.getElementById("mcAlamat").value.trim(),
    },
    user: currentUser ? currentUser.username : "Admin",
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveCustomer", payload).then((res) => {
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      document.getElementById("formMasterCustomer").reset();
      closeModalCustomer();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

function handleSaveUser(e) {
  e.preventDefault();
  const payload = {
    userData: {
      username: document.getElementById("muUsername").value.trim(),
      password: document.getElementById("muPassword").value.trim(),
      role: document.getElementById("muRole").value,
    },
    adminUser: currentUser ? currentUser.username : "Admin",
  };
  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveUser", payload).then((res) => {
    if (res.success) {
      Swal.fire("Berhasil", res.message, "success");
      document.getElementById("formMasterUser").reset();
      closeModalUser();
      refreshAllData();
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim(),
  };
  Swal.fire({
    title: "Autentikasi...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiLogin", payload).then((res) => {
    if (res.success) {
      currentUser = res.user;
      sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
      applyRbacUI();
      closeLoginModal();
      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        timer: 1500,
        showConfirmButton: false,
      });
      switchTab("overview"); // Langsung ke dashboard (karena menu lain dihapus)
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

// =========================================================================
// MODAL UTILITIES
// =========================================================================
function openModalBarang() {
  document.getElementById("modalMasterBarang").classList.remove("hidden");
}
function closeModalBarang() {
  document.getElementById("modalMasterBarang").classList.add("hidden");
}
function openModalCustomer() {
  document.getElementById("modalMasterCustomer").classList.remove("hidden");
}
function closeModalCustomer() {
  document.getElementById("modalMasterCustomer").classList.add("hidden");
}
function openModalUser() {
  document.getElementById("modalMasterUser").classList.remove("hidden");
}
function closeModalUser() {
  document.getElementById("modalMasterUser").classList.add("hidden");
}
function openLoginModal() {
  document.getElementById("modalLogin").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("modalLogin").classList.add("hidden");
}
function logoutAction() {
  Swal.fire({
    title: "Keluar",
    text: "Yakin keluar?",
    showCancelButton: true,
  }).then((res) => {
    if (res.isConfirmed) {
      currentUser = null;
      sessionStorage.removeItem("sim_inventory_user");
      applyRbacUI();
      switchTab("overview");
    }
  });
}

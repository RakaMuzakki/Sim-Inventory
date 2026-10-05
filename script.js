// =========================================================================
// !!! PENTING: PASTE LINK URL GOOGLE APPS SCRIPT ANDA DI SINI !!!
// =========================================================================
const API_URL =
  "https://script.google.com/macros/s/AKfycbwzjcbbXsU6_lj5Y2X6lEDMsIyUt545kky3Akw4Hdb2atVB0wejFTRSaXaJASxDhs6MjA/exec";

let currentUser = null;
let appData = {
  barang: [],
  customer: [],
  orders: [],
  seatAssyControl: [],
  users: [],
};
let massScanBuffer = [];
let massScannerInstance = null;
let singleScannerInstance = null;
let singleScannerTargetInput = null;

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  // ========================================================
  // KODE AUTO REFRESH (Jalan setiap 60.000 milidetik / 60 detik)
  // ========================================================
  // AUTO REFRESH DIAM-DIAM (STEALTH MODE) SETIAP 60 DETIK
  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    if (overviewTab && !overviewTab.classList.contains("hidden")) {
      // Kirim fetch diam-diam tanpa memicu pop-up error di layar
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
            buildSeatAssyControlDataset();
            renderSeatAssyControlBoard();

            // Efek putar ikon kecil di pojok kanan atas
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
        .catch((err) => {
          // Jika gagal, sistem HANYA mencatat di console laptop, TIDAK MEMUNCULKAN POP-UP KE USER
          console.log("Auto-refresh tertunda, koneksi sibuk.");
        });
    }
  }, 60000); // 60 Detik
  // Angka 60000 bisa Anda ganti jadi 30000 jika ingin 30 detik.
});

// =========================================================================
// KOMUNIKASI API (FETCH) KE GOOGLE APPS SCRIPT
// =========================================================================
// =========================================================================
// KOMUNIKASI API (FETCH) KE GOOGLE APPS SCRIPT (DILENGKAPI AUTO-RETRY)
// =========================================================================
async function sendToBackend(action, payload = {}) {
  if (API_URL === "1ZnOPjXr4ND6nA8Dmulq9Dcj-QTwywi1CVq6dgiiqScY" || !API_URL) {
    throw new Error(
      "PENTING: Anda belum memasukkan API_URL dari Google Apps Script!",
    );
  }

  // Coba kirim data, berikan 3 kali kesempatan jika koneksi gagal/terputus
  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload }),
      });

      const textResult = await response.text();
      try {
        const jsonResult = JSON.parse(textResult);
        return jsonResult;
      } catch (jsonErr) {
        throw new Error("Server Google sedang sibuk. Mengulangi koneksi...");
      }
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error("Fetch API Error:", error);
        throw new Error(
          "Gagal terhubung ke database server. Pastikan jaringan stabil dan URL API benar.",
        );
      }
      // Tunggu 1,5 detik sebelum mencoba ulang otomatis
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

// =========================================================================
// TAMPILAN, NAVIGASI & HAK AKSES
// =========================================================================
function startLiveClock() {
  setInterval(() => {
    document.getElementById("liveClock").innerText =
      new Date().toLocaleTimeString("id-ID", { hour12: false });
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
    .querySelectorAll(".role-admin, .role-prod, .role-wh")
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
        .querySelectorAll(".role-admin, .role-prod, .role-wh")
        .forEach((el) => el.classList.remove("hidden"));
    else if (currentUser.role === "Produksi")
      document
        .querySelectorAll(".role-prod")
        .forEach((el) => el.classList.remove("hidden"));
    else if (currentUser.role === "Warehouse")
      document
        .querySelectorAll(".role-wh")
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
// AMBIL DATA & RENDER TABEL
// =========================================================================
function showSyncSpinner(show) {
  const s = document.getElementById("syncSpinner");
  if (show) s.classList.add("animate-spin");
  else s.classList.remove("animate-spin");
}

function refreshAllData() {
  showSyncSpinner(true);
  loadInitialOrMockData();
}

function loadInitialOrMockData() {
  showSyncSpinner(true);

  if (API_URL === "PASTE_URL_WEB_APP_ANDA_DISINI") {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "URL API belum disetting, menggunakan data lokal",
      showConfirmButton: false,
      timer: 4000,
    });
    useMockInitialData();
    showSyncSpinner(false);
    return;
  }

  sendToBackend("apiGetMasterData")
    .then((res) => {
      showSyncSpinner(false);
      if (res && res.success) {
        appData.barang = res.barang || [];
        appData.customer = res.customer || [];
        appData.orders = res.orders || [];
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
      useMockInitialData();
    });
}

function useMockInitialData() {
  appData.barang = [
    {
      Part_Number: "PN-ELC-001",
      nama_barang: "Relay Box 12V Type A",
      stok: 150,
      standar_packing: 1,
      No_Rel: "REL-A-01",
    },
    {
      Part_Number: "PN-MCH-101",
      nama_barang: "Bracket Mounting Iron",
      stok: 350,
      standar_packing: 1,
      No_Rel: "REL-B-05",
    },
    {
      Part_Number: "PN-PLT-303",
      nama_barang: "Casing Front Cover Black",
      stok: 45,
      standar_packing: 1,
      No_Rel: "REL-C-12",
    },
  ];
  appData.customer = [
    {
      id_customer: "CUST-001",
      nama_customer: "PT. Astra Agro Lestari",
      alamat: "Cikarang",
    },
    {
      id_customer: "CUST-002",
      nama_customer: "PT. Toyota Motor Mfg",
      alamat: "Karawang",
    },
    {
      id_customer: "CUST-003",
      nama_customer: "PT. Denso Indonesia",
      alamat: "Cibitung",
    },
  ];
  appData.orders = [
    {
      no_order: "ORD-1001",
      id_customer: "CUST-001",
      Part_Number: "PN-ELC-001",
      qty_order: 25,
      qty_delivery: 0,
      status_order: "Diproses",
    },
    {
      no_order: "ORD-1002",
      id_customer: "CUST-002",
      Part_Number: "PN-MCH-101",
      qty_order: 50,
      qty_delivery: 0,
      status_order: "Diproses",
    },
    {
      no_order: "ORD-1003",
      id_customer: "CUST-003",
      Part_Number: "PN-PLT-303",
      qty_order: 100,
      qty_delivery: 0,
      status_order: "Diproses",
    },
  ];
  buildSeatAssyControlDataset();
  refreshAllUI();
}

function buildSeatAssyControlDataset() {
  const list = [];
  appData.orders.forEach((ord, index) => {
    const itemBarang =
      appData.barang.find((b) => b.Part_Number === ord.Part_Number) || {};
    const itemCust =
      appData.customer.find((c) => c.id_customer === ord.id_customer) || {};

    const qtyOrder = Number(ord.qty_order) || 0;
    const qtyDelivery = Number(ord.qty_delivery) || 0;
    const sisa = Math.max(0, qtyOrder - qtyDelivery);
    const stock = Number(itemBarang.stok) || 0;

    // Kalkulasi ASSY IN STORE FSG dan VARIANS
    const assy_fsg = Math.floor(stock * 0.4);
    const variance = stock - qtyDelivery;

    list.push({
      no: index + 1,
      no_order: ord.no_order,
      Part_Number: ord.Part_Number,
      nama_barang: itemBarang.nama_barang || "-",
      stock: stock,
      qty_order: qtyOrder,
      qty_delivery: qtyDelivery,
      sisa: sisa,
      assy_fsg: assy_fsg,
      variance: variance,
      No_Rel: itemBarang.No_Rel || "-",
      customer: itemCust.nama_customer || ord.id_customer,
      status: sisa === 0 ? "Selesai" : "On Progress",
    });
  });
  appData.seatAssyControl = list;
}

function refreshAllUI() {
  renderSeatAssyControlBoard();
  populateDropdowns();
  renderOrdersTable();
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
        d.customer.toLowerCase().includes(kw) ||
        d.No_Rel.toLowerCase().includes(kw),
    );
  }

  document.getElementById("cntTotalSeatAssy").innerText = dataset.length;
  document.getElementById("cntOnProgressSeatAssy").innerText = dataset.filter(
    (d) => d.status === "On Progress",
  ).length;
  document.getElementById("cntSelesaiSeatAssy").innerText = dataset.filter(
    (d) => d.status === "Selesai",
  ).length;

  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map((row) => {
      const stockWarningClass =
        row.stock < row.sisa
          ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded font-extrabold"
          : "text-slate-700 font-extrabold";
      const varianceFormatted =
        row.variance > 0 ? `+${row.variance}` : row.variance;

      return `<tr class="hover:bg-slate-50 transition-colors">
        <td class="py-3 px-3 border-r border-slate-100 text-center font-bold text-slate-700">
          <span class="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] text-slate-700 border border-slate-200">${row.No_Rel}</span>
        </td>
        <td class="py-3 px-3 border-r border-slate-100">
          <div class="font-extrabold text-slate-900 tracking-tight">${row.Part_Number}</div>
          <div class="text-[11px] text-slate-400 truncate max-w-xs">${row.nama_barang}</div>
        </td>
        <td class="py-3 px-3 border-r border-slate-100 text-center">
          <span class="${stockWarningClass}">${row.stock}</span>
        </td>
        <td class="py-3 px-3 text-center border-r border-slate-100 font-semibold text-slate-600">${row.qty_order}</td>
        <td class="py-3 px-3 text-center border-r border-slate-100 font-bold text-emerald-600">${row.qty_delivery}</td>
        <td class="py-3 px-3 text-center border-r border-slate-100 font-extrabold text-amber-600">${row.sisa}</td>
        <td class="py-3 px-3 text-center border-r border-slate-100 font-extrabold text-indigo-700">${row.assy_fsg}</td>
        <td class="py-3 px-3 text-center border-r border-slate-100 font-extrabold text-slate-700">${varianceFormatted}</td>
      </tr>`;
    })
    .join("");
}
if (outPartSelect)
  outPartSelect.innerHTML =
    '<option value="">-- Pilih Part Number --</option>' +
    appData.barang
      .map(
        (b) =>
          `<option value="${b.Part_Number}">${b.Part_Number} (Stok: ${b.stok})</option>`,
      )
      .join("");
if (outOrderSelect)
  outOrderSelect.innerHTML =
    '<option value="">-- Pengiriman Bebas --</option>' +
    appData.orders
      .filter((o) => o.status_order !== "Selesai")
      .map((o) => `<option value="${o.no_order}">${o.no_order}</option>`)
      .join("");
if (outCustSelect)
  outCustSelect.innerHTML =
    '<option value="">-- Pilih Customer --</option>' +
    appData.customer
      .map(
        (c) => `<option value="${c.id_customer}">${c.nama_customer}</option>`,
      )
      .join("");

function handleSelectBarangMasuk(part) {
  const item = appData.barang.find((b) => b.Part_Number === part);
  if (item) {
    document.getElementById("lblInNamaBarang").innerText = item.nama_barang;
    document.getElementById("lblInStokCurrent").innerText = item.stok;
    document.getElementById("lblInStdPack").innerText =
      item.standar_packing || 1;
    document.getElementById("lblInNoRel").innerText = item.No_Rel || "-";
    calculateInTotalQty();
  }
}

function calculateInTotalQty() {
  const p = document.getElementById("inPartNumber").value,
    b = Number(document.getElementById("inBoxCount").value) || 0,
    i = appData.barang.find((x) => x.Part_Number === p),
    std = i ? Number(i.standar_packing) || 1 : 1;
  document.getElementById("inTotalQty").value = b * std;
}

function handleSelectBarangKeluar(part) {
  const item = appData.barang.find((b) => b.Part_Number === part);
  if (item) {
    document.getElementById("lblOutStokAvailable").innerText = item.stok;
    document.getElementById("lblOutStdPack").innerText =
      item.standar_packing || 1;
  }
}

function handleSelectOrderRef(noOrder) {
  if (!noOrder) return;
  const ord = appData.orders.find((o) => o.no_order === noOrder);
  if (ord) {
    document.getElementById("outCustomer").value = ord.id_customer;
    document.getElementById("outPartNumber").value = ord.Part_Number;
    handleSelectBarangKeluar(ord.Part_Number);
    const sisa = Math.max(
      0,
      (Number(ord.qty_order) || 0) - (Number(ord.qty_delivery) || 0),
    );
    document.getElementById("outQty").value = sisa > 0 ? sisa : 1;
  }
}

function renderOrdersTable() {
  const tbody = document.getElementById("tblOrderBody");
  if (!tbody) return;
  if (appData.orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada order.</td></tr>`;
    return;
  }
  tbody.innerHTML = appData.orders
    .map(
      (o) =>
        `<tr class="hover:bg-slate-50"><td class="py-3 px-3 font-extrabold">${o.no_order}</td><td class="py-3 px-3">${o.id_customer}</td><td class="py-3 px-3 font-semibold">${o.Part_Number}</td><td class="py-3 px-3 font-bold">${o.qty_order} Pcs</td><td class="py-3 px-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">${o.status_order || "Pending"}</span></td></tr>`,
    )
    .join("");
}

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
// TRANSAKSI API (KIRIM DATA KE BACKEND)
// =========================================================================
function handleFormBarangMasuk(e) {
  e.preventDefault();
  if (!currentUser) {
    openLoginModal();
    return;
  }

  const payload = {
    partNumber: document.getElementById("inPartNumber").value,
    qty: document.getElementById("inTotalQty").value,
    catatan: document.getElementById("inCatatan").value,
    petugas: currentUser.username,
  };

  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSaveTransaksiMasuk", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Berhasil", res.message, "success");
        document.getElementById("formBarangMasuk").reset();
        handleSelectBarangMasuk("");
        refreshAllData();
      } else {
        Swal.fire("Gagal", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
}

function handleFormBarangKeluar(e) {
  e.preventDefault();
  if (!currentUser) {
    openLoginModal();
    return;
  }

  const payload = {
    noOrder: document.getElementById("outNoOrder").value,
    idCustomer: document.getElementById("outCustomer").value,
    partNumber: document.getElementById("outPartNumber").value,
    qty: document.getElementById("outQty").value,
    catatan: document.getElementById("outCatatan").value,
    petugas: currentUser.username,
  };

  Swal.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSaveTransaksiKeluar", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Berhasil", res.message, "success");
        document.getElementById("formBarangKeluar").reset();
        handleSelectBarangKeluar("");
        refreshAllData();
      } else {
        Swal.fire("Gagal", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
}

function submitMassScanTransaction() {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  if (massScanBuffer.length === 0) {
    Swal.fire("Kosong", "Silakan scan barcode terlebih dahulu!", "info");
    return;
  }

  const payload = {
    items: massScanBuffer,
    petugas: currentUser.username,
    catatanUmum: document.getElementById("massCatatan").value,
  };

  Swal.fire({
    title: "Memproses Batch...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSubmitScanMassal", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Batch Berhasil", res.message, "success");
        clearMassScanBuffer();
        refreshAllData();
      } else {
        Swal.fire("Gagal Memproses", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
}

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
    title: "Menyimpan Part...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSaveBarang", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Tersimpan", res.message, "success");
        document.getElementById("formMasterBarang").reset();
        closeModalBarang();
        refreshAllData();
      } else {
        Swal.fire("Gagal Menyimpan", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
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
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSaveCustomer", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Tersimpan", res.message, "success");
        document.getElementById("formMasterCustomer").reset();
        closeModalCustomer();
        refreshAllData();
      } else {
        Swal.fire("Gagal Menyimpan", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
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
    title: "Mendaftarkan User...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiSaveUser", payload)
    .then((res) => {
      if (res.success) {
        Swal.fire("Terdaftar", res.message, "success");
        document.getElementById("formMasterUser").reset();
        closeModalUser();
        refreshAllData();
      } else {
        Swal.fire("Gagal Daftar", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
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
    didOpen: () => {
      Swal.showLoading();
    },
  });
  sendToBackend("apiLogin", payload)
    .then((res) => {
      if (res.success) {
        currentUser = res.user;
        sessionStorage.setItem(
          "sim_inventory_user",
          JSON.stringify(currentUser),
        );
        applyRbacUI();
        closeLoginModal();
        Swal.fire({
          icon: "success",
          title: "Login Berhasil!",
          text: `Selamat datang ${currentUser.username}`,
          timer: 1500,
          showConfirmButton: false,
        });
        if (currentUser.role === "Produksi") switchTab("masuk");
        else if (currentUser.role === "Warehouse") switchTab("keluar");
        else switchTab("overview");
      } else {
        Swal.fire(
          "Gagal Masuk",
          res.message || "Username atau password salah!",
          "error",
        );
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
}

// =========================================================================
// CAMERA & SCANNER FUNCTIONS (BEKERJA DI GITHUB PAGES)
// =========================================================================
function handleMassBarcodeInput(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const code = e.target.value.trim();
    if (code) {
      processScannedMassBarcode(code);
      e.target.value = "";
    }
  }
}

function processScannedMassBarcode(scannedCode) {
  const found = appData.barang.find(
    (b) => b.Part_Number.toLowerCase() === scannedCode.toLowerCase(),
  );
  if (!found) {
    Swal.fire({
      icon: "warning",
      title: "Part Tidak Dikenal",
      timer: 1500,
      showConfirmButton: false,
    });
    return;
  }
  const existing = massScanBuffer.find(
    (item) => item.Part_Number === found.Part_Number,
  );
  if (existing) existing.qty += 1;
  else
    massScanBuffer.push({
      Part_Number: found.Part_Number,
      nama_barang: found.nama_barang,
      qty: 1,
      stok: found.stok,
    });

  document.getElementById("massScanCount").innerText = massScanBuffer.length;
  renderMassScanTable();
}

function renderMassScanTable() {
  const tbody = document.getElementById("tblMassScanBody");
  if (massScanBuffer.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">Belum ada item yang di-scan.</td></tr>`;
    return;
  }
  tbody.innerHTML = massScanBuffer
    .map(
      (item, idx) =>
        `<tr class="hover:bg-slate-50"><td class="py-2.5 px-3 font-bold">${idx + 1}</td><td class="py-2.5 px-3 font-bold">${item.Part_Number}</td><td class="py-2.5 px-3">${item.nama_barang}</td><td class="py-2.5 px-3"><span class="px-2.5 py-1 rounded-lg bg-emerald-50 text-brand-700 font-extrabold">${item.qty}</span></td><td class="py-2.5 px-3 font-bold">${item.stok}</td><td class="py-2.5 px-3 text-center"><button onclick="massScanBuffer.splice(${idx}, 1); renderMassScanTable();" class="text-rose-500"><i class="fa-solid fa-trash-can"></i></button></td></tr>`,
    )
    .join("");
}

function clearMassScanBuffer() {
  massScanBuffer = [];
  renderMassScanTable();
  document.getElementById("massScanCount").innerText = "0";
}

function toggleContinuousCamera() {
  const wrapper = document.getElementById("massScannerWrapper"),
    lbl = document.getElementById("lblCamStatus");
  if (massScannerInstance) {
    massScannerInstance.stop().then(() => {
      massScannerInstance.clear();
      massScannerInstance = null;
      wrapper.classList.add("hidden");
      lbl.innerText = "Buka Kamera HP / PC";
    });
  } else {
    wrapper.classList.remove("hidden");
    lbl.innerText = "Tutup Kamera";
    massScannerInstance = new Html5Qrcode("interactiveScanner");
    massScannerInstance
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          processScannedMassBarcode(decodedText);
        },
        () => {},
      )
      .catch((err) => {
        Swal.fire(
          "Error Kamera",
          "Kamera gagal terbuka. Pastikan Anda telah memberikan izin kamera pada browser Anda.",
          "error",
        );
        wrapper.classList.add("hidden");
        lbl.innerText = "Buka Kamera HP / PC";
        massScannerInstance = null;
      });
  }
}

function startSingleQrScanner(targetInputId) {
  singleScannerTargetInput = targetInputId;
  document.getElementById("modalSingleScanner").classList.remove("hidden");
  singleScannerInstance = new Html5Qrcode("singleReaderViewport");
  singleScannerInstance
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (decodedText) => {
        document.getElementById(singleScannerTargetInput).value = decodedText;
        if (singleScannerTargetInput === "inPartNumber")
          handleSelectBarangMasuk(decodedText);
        if (singleScannerTargetInput === "outPartNumber")
          handleSelectBarangKeluar(decodedText);
        stopSingleQrScanner();
      },
      () => {},
    )
    .catch((err) => {
      Swal.fire("Error Kamera", "Gagal mengakses kamera.", "error");
      stopSingleQrScanner();
    });
}

function stopSingleQrScanner() {
  if (singleScannerInstance) {
    singleScannerInstance
      .stop()
      .then(() => {
        singleScannerInstance.clear();
        singleScannerInstance = null;
        document.getElementById("modalSingleScanner").classList.add("hidden");
      })
      .catch(() => {
        document.getElementById("modalSingleScanner").classList.add("hidden");
        singleScannerInstance = null;
      });
  } else {
    document.getElementById("modalSingleScanner").classList.add("hidden");
  }
}

// =========================================================================
// MODAL UTILITIES
// =========================================================================
function previewSuratJalanCurrentForm() {
  document.getElementById("modalSuratJalan").classList.remove("hidden");
}
function closeModalSuratJalan() {
  document.getElementById("modalSuratJalan").classList.add("hidden");
}
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
    text: "Keluar dari akun?",
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

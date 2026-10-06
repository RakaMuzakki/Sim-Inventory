// =========================================================================
// KONFIGURASI API & STATE GLOBAL
// =========================================================================
// !!! PASTE LINK GOOGLE APPS SCRIPT ANDA DI BAWAH INI !!!
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
let smartScanner = null;
let activeScannedPart = null;

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    const riwayatTab = document.getElementById("tab-riwayat");

    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden"))
    ) {
      fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "apiGetMasterData", payload: {} }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res && res.success) {
            appData.barang = res.barang || [];
            appData.orders = res.orders || [];
            appData.masuk = res.masuk || [];
            appData.keluar = res.keluar || [];
            appData.users = res.users || [];
            buildSeatAssyControlDataset();
            refreshAllUI();
            const spinner = document.getElementById("syncSpinner");
            if (spinner) {
              spinner.classList.add("rotate-180");
              setTimeout(() => spinner.classList.remove("rotate-180"), 1000);
            }
          }
        })
        .catch(() => console.log("Auto-refresh tertunda."));
    }
  }, 30000);
});

async function sendToBackend(action, payload = {}) {
  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: action, payload: payload }),
      });
      return JSON.parse(await response.text());
    } catch (error) {
      retries--;
      if (retries === 0)
        throw new Error(
          "Gagal terhubung ke database. Pastikan jaringan stabil.",
        );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
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
// DASHBOARD LOGIC (PAPAN KONTROL) - PERBAIKAN RUMUS STOK
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
        appData.users = res.users || [];
        buildSeatAssyControlDataset();
        refreshAllUI();
      } else Swal.fire("Error", res.message || "Gagal memuat data", "error");
    })
    .catch((err) => {
      showSyncSpinner(false);
      Swal.fire("Error", err.message, "error");
    });
}

function refreshAllUI() {
  renderSeatAssyControlBoard();
  renderRiwayatTable();
  renderMasterBarangTable();
  renderCustomerTable();
  renderUsersTable();
}

function buildSeatAssyControlDataset() {
  const list = [];
  appData.barang.forEach((itemBarang) => {
    const partNum = String(itemBarang.Part_Number).trim();
    const relatedOrders = appData.orders.filter(
      (o) => String(o.Part_Number).trim() === partNum,
    );

    let custName = "-";
    if (relatedOrders.length > 0) custName = relatedOrders[0].id_customer;
    else if (itemBarang.id_customer) custName = itemBarang.id_customer;

    // Menghitung Target Keluar Harian
    const qtyDay = relatedOrders.reduce(
      (sum, o) => sum + (Number(o.qty_order) || 0),
      0,
    );
    // Menghitung yang SUDAH keluar (untuk kolom pengurang sisa delivery)
    const qtyOut = appData.keluar
      .filter((k) => String(k.Part_Number).trim() === partNum)
      .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);
    const sisaDel = Math.max(0, qtyDay - qtyOut);

    // PERBAIKAN: Stok langsung murni membaca dari Master_Barang tanpa ditambahkan transaksi lagi
    const currentStock = Number(itemBarang.stok) || 0;

    const assyFsg = Math.floor(currentStock * 0.4);
    const variance = currentStock + assyFsg - qtyDay;

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

function promptUpdateQtyDay(partNumber, currentQty) {
  Swal.fire({
    title: "SET TARGET (QTY/DAY)",
    html: `<p class="text-sm mb-3">Target Harian untuk Part:<br><b class="text-lg">${partNumber}</b></p>`,
    input: "number",
    inputValue: currentQty > 0 ? currentQty : "",
    inputAttributes: { min: 0, step: 1, placeholder: "Ketik angka..." },
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-check"></i> Simpan',
    cancelButtonText: "Batal",
    confirmButtonColor: "#10b981",
  }).then((result) => {
    if (result.isConfirmed) {
      const newVal = Number(result.value) || 0;
      Swal.fire({
        title: "Menyimpan...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiUpdateQtyDay", {
        partNumber: partNumber,
        qty: newVal,
        user: currentUser.username,
      })
        .then((res) => {
          if (res.success) {
            Swal.fire({
              icon: "success",
              title: "Tersimpan!",
              timer: 1000,
              showConfirmButton: false,
            });
            refreshAllData();
          } else {
            Swal.fire("Gagal", res.message, "error");
          }
        })
        .catch((err) => Swal.fire("Error", err.message, "error"));
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
        d.No_Rel.toLowerCase().includes(kw),
    );
  }
  document.getElementById("cntTotalSeatAssy").innerText = dataset.length;
  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === "Admin";

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

      const qtyDayClass = isAdmin
        ? "cursor-pointer hover:bg-yellow-300 hover:text-blue-800 underline decoration-dashed underline-offset-4 transition-all"
        : "";
      const qtyDayAction = isAdmin
        ? `onclick="promptUpdateQtyDay('${row.Part_Number}', ${row.qty_day})"`
        : "";
      const qtyDayTitle = isAdmin
        ? `title="Klik untuk Edit Target Harian"`
        : "";

      return `<tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-black text-slate-500 break-words">${row.Customer}</td>
      <td class="py-2 px-1 border-2 border-slate-800 font-black text-yellow-600 bg-slate-50">${row.No_Rel}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left">
        <div class="font-black text-slate-900 text-sm tracking-tighter">${row.Part_Number}</div>
        <div class="text-[10px] text-slate-500 truncate max-w-[120px] leading-none mt-0.5 uppercase">${row.nama_barang}</div>
      </td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-blue-700 text-base bg-blue-50/50">${formatNum(row.stock)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-slate-800 bg-slate-100 ${qtyDayClass}" ${qtyDayAction} ${qtyDayTitle}>${formatNum(row.qty_day)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-slate-700">${formatNum(row.qty_out)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-black text-red-600">${formatNum(row.sisa_del)}</td>
      <td class="py-2 px-2 border-2 border-slate-800 font-bold text-purple-700 bg-purple-50/50">${formatNum(row.assy_fsg)}</td>
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
        waktu: new Date(m.tanggal),
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
        waktu: new Date(k.tanggal),
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
      <td class="py-2 px-3 border-2 border-slate-800 text-left text-[10px] text-slate-500 italic max-w-xs truncate">${r.catatan || "-"}</td>
    </tr>`;
    })
    .join("");
}

// =========================================================================
// SMART SCANNER & GUN SCANNER LOGIC
// =========================================================================
function handleScannerGun(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const scanValue = document.getElementById("manualSmartInput").value;
    if (scanValue) {
      processSmartScan(scanValue);
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
      Swal.fire("Kamera Error", "Gagal membuka kamera.", "error");
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

function processSmartScan(scannedCode) {
  if (!scannedCode) return;
  const part = scannedCode.trim();
  const foundData = appData.seatAssyControl.find(
    (item) => item.Part_Number.toLowerCase() === part.toLowerCase(),
  );

  if (!foundData) {
    Swal.fire({
      icon: "warning",
      title: "Tidak Dikenali!",
      text: `Part ${part} tidak terdaftar di sistem.`,
      timer: 2000,
      showConfirmButton: false,
    });
    document.getElementById("manualSmartInput").value = "";
    document.getElementById("manualSmartInput").focus();
    return;
  }

  if (smartScanner) smartScanner.pause();
  activeScannedPart = foundData;

  document.getElementById("smInfoRell").innerText = foundData.No_Rel;
  document.getElementById("smInfoPart").innerText = foundData.Part_Number;
  document.getElementById("smInfoNama").innerText = foundData.nama_barang;
  document.getElementById("smInfoStok").innerText = foundData.stock;
  document.getElementById("smInfoTarget").innerText = foundData.sisa_del;
  document.getElementById("smInputQty").value = 1;

  document.getElementById("modalSmartAction").classList.remove("hidden");
  document.getElementById("manualSmartInput").value = "";
}

function closeSmartAction() {
  document.getElementById("modalSmartAction").classList.add("hidden");
  activeScannedPart = null;
  if (smartScanner) smartScanner.resume();

  const manualInput = document.getElementById("manualSmartInput");
  if (manualInput) manualInput.focus();
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
  const qty = parseInt(document.getElementById("smInputQty").value) || 0;
  if (qty <= 0) return Swal.fire("Error", "Jumlah harus lebih dari 0", "error");

  const actionName =
    tipeAction === "IN" ? "apiSaveTransaksiMasuk" : "apiSaveTransaksiKeluar";
  const actionText = tipeAction === "IN" ? "Barang Masuk" : "Barang Keluar";

  if (tipeAction === "OUT" && qty > activeScannedPart.stock) {
    return Swal.fire(
      "Stok Kurang!",
      `Stok sistem hanya sisa ${activeScannedPart.stock} Pcs.`,
      "error",
    );
  }

  const payload = {
    partNumber: activeScannedPart.Part_Number,
    qty: qty,
    petugas: currentUser.username,
    catatan: `Smart Scan ${actionText}`,
  };
  Swal.fire({
    title: "Mencatat ke Sistem...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  sendToBackend(actionName, payload)
    .then((res) => {
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: `${qty} Pcs ${actionText} dicatat.`,
          timer: 1500,
          showConfirmButton: false,
        });
        closeSmartAction();
        refreshAllData();
      } else {
        Swal.fire("Gagal", res.message, "error");
      }
    })
    .catch((err) => Swal.fire("Error Koneksi", err.message, "error"));
}

// =========================================================================
// MASTER DATA TABLES & FUNGSI HAPUS USER
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
        `<tr class="hover:bg-yellow-50 transition-colors"><td class="py-2 px-3 border-2 border-slate-800">${b.Part_Number}</td><td class="py-2 px-3 border-2 border-slate-800 text-left">${b.nama_barang}</td><td class="py-2 px-3 border-2 border-slate-800 font-black text-blue-700">${b.stok}</td><td class="py-2 px-3 border-2 border-slate-800 font-black text-yellow-600 bg-slate-50">${b.No_Rel || "-"}</td></tr>`,
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
        `<tr class="hover:bg-yellow-50 transition-colors"><td class="py-2 px-3 border-2 border-slate-800 font-black">${c.id_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left font-black text-slate-900">${c.nama_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left">${c.alamat || "-"}</td></tr>`,
    )
    .join("");
}

function renderUsersTable() {
  const tbody = document.getElementById("tblUsersBody");
  if (!tbody) return;
  const usersList = appData.users || [];
  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">Tidak ada data.</td></tr>`;
    return;
  }

  tbody.innerHTML = usersList
    .map((u) => {
      const btnDelete = `<button onclick="deleteUser('${u.username}')" class="px-3 py-1.5 bg-red-400 hover:bg-red-500 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none transition-all text-slate-900" title="Hapus User"><i class="fa-solid fa-trash-can"></i></button>`;
      return `<tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-3 border-2 border-slate-800 font-black text-slate-900">${u.username}</td>
      <td class="py-2 px-3 border-2 border-slate-800"><span class="px-2.5 py-1 bg-slate-800 text-white font-bold text-[10px] uppercase rounded shadow-[2px_2px_0px_rgba(0,0,0,1)]">${u.role}</span></td>
      <td class="py-2 px-3 border-2 border-slate-800 text-center">${btnDelete}</td>
    </tr>`;
    })
    .join("");
}

function deleteUser(usernameTarget) {
  if (currentUser && currentUser.username === usernameTarget) {
    return Swal.fire(
      "Ditolak!",
      "Anda tidak bisa menghapus akun Anda sendiri.",
      "warning",
    );
  }
  Swal.fire({
    title: `Hapus Akun ${usernameTarget}?`,
    text: "Akun ini akan dihapus permanen.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#334155",
    confirmButtonText: "Ya, Hapus!",
    cancelButtonText: "Batal",
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "Menghapus...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiDeleteUser", {
        usernameTarget: usernameTarget,
        adminUser: currentUser.username,
      })
        .then((res) => {
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
        })
        .catch((err) => Swal.fire("Error", err.message, "error"));
    }
  });
}

// =========================================================================
// MODAL & FORM MASTER DATA
// =========================================================================
function openModalBarang() {
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
        title: "Masuk!",
        timer: 1000,
        showConfirmButton: false,
      });
      switchTab("scanner");
    } else {
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

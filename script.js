// =========================================================================
// KONFIGURASI SUPABASE DATABASE
// =========================================================================
// ⚠️ GANTI DENGAN URL & KEY SUPABASE MILIK ANDA! ⚠️
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

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    const riwayatTab = document.getElementById("tab-riwayat");
    if (isProcessing) return;
    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden"))
    ) {
      sendToBackend("apiGetMasterData").then((res) => {
        if (res && res.success) {
          appData.barang = res.barang || [];
          appData.customer = res.customer || [];
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
      });
    }
  }, 30000); // Otomatis refresh Papan Kontrol setiap 30 detik
});

// =========================================================================
// CORE ENGINE: KOMUNIKASI KE SUPABASE
// =========================================================================
async function sendToBackend(action, payload = {}) {
  try {
    switch (action) {
      case "apiGetMasterData":
        const [b, c, o, m, k, u] = await Promise.all([
          _supabase.from("Master_Barang").select("*"),
          _supabase.from("Master_Customer").select("*"),
          _supabase.from("List_Order").select("*"),
          _supabase.from("Transaksi_Masuk").select("*"),
          _supabase.from("Transaksi_Keluar").select("*"),
          _supabase.from("Users").select("*"),
        ]);
        return {
          success: true,
          barang: b.data,
          customer: c.data,
          orders: o.data,
          masuk: m.data,
          keluar: k.data,
          users: u.data,
        };

      case "apiLogin":
        // Cek darurat: Jika tabel Users kosong, otomatis buatkan 1 Admin pertama
        const { data: cekUsers } = await _supabase.from("Users").select("*");
        if (!cekUsers || cekUsers.length === 0) {
          if (payload.username === "admin") {
            await _supabase
              .from("Users")
              .insert([
                { username: "admin", password: "admin", role: "Admin" },
              ]);
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
        if (loginData && loginData.length > 0)
          return { success: true, user: loginData[0] };
        return { success: false, message: "Username atau password salah!" };

      case "apiSaveTransaksiMasuk":
        const { data: bIn } = await _supabase
          .from("Master_Barang")
          .select("stok")
          .eq("Part_Number", payload.partNumber)
          .single();
        const newStokIn = (Number(bIn?.stok) || 0) + Number(payload.qty);
        await _supabase
          .from("Master_Barang")
          .update({ stok: newStokIn })
          .eq("Part_Number", payload.partNumber);
        await _supabase.from("Transaksi_Masuk").insert([
          {
            Part_Number: payload.partNumber,
            qty: payload.qty,
            petugas: payload.petugas,
            catatan: payload.catatan,
            tanggal: new Date().toISOString(),
          },
        ]);
        return { success: true };

      case "apiSaveTransaksiKeluar":
        const { data: bOut } = await _supabase
          .from("Master_Barang")
          .select("stok")
          .eq("Part_Number", payload.partNumber)
          .single();
        const currentStokOut = Number(bOut?.stok) || 0;
        if (currentStokOut < payload.qty)
          throw new Error("Stok sistem tidak cukup!");
        await _supabase
          .from("Master_Barang")
          .update({ stok: currentStokOut - Number(payload.qty) })
          .eq("Part_Number", payload.partNumber);
        await _supabase.from("Transaksi_Keluar").insert([
          {
            Part_Number: payload.partNumber,
            qty: payload.qty,
            petugas: payload.petugas,
            catatan: payload.catatan,
            tanggal: new Date().toISOString(),
          },
        ]);
        return { success: true };

      case "apiUpdateAssyFsg":
        await _supabase
          .from("Master_Barang")
          .update({ assy_fsg: payload.qty })
          .eq("Part_Number", payload.partNumber);
        return { success: true };

      case "apiUpdateQtyDay":
        const { data: checkO } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);
        if (checkO && checkO.length > 0) {
          await _supabase
            .from("List_Order")
            .update({ qty_order: payload.qty })
            .eq("Part_Number", payload.partNumber);
        } else {
          await _supabase
            .from("List_Order")
            .insert([
              { Part_Number: payload.partNumber, qty_order: payload.qty },
            ]);
        }
        return { success: true };

      case "apiSaveBarang":
        const { data: checkB } = await _supabase
          .from("Master_Barang")
          .select("*")
          .eq("Part_Number", payload.item.Part_Number);
        if (checkB && checkB.length > 0) {
          await _supabase
            .from("Master_Barang")
            .update(payload.item)
            .eq("Part_Number", payload.item.Part_Number);
        } else {
          await _supabase.from("Master_Barang").insert([payload.item]);
        }
        return { success: true, message: "Barang berhasil disimpan!" };

      case "apiSaveCustomer":
        const { data: checkC } = await _supabase
          .from("Master_Customer")
          .select("*")
          .eq("id_customer", payload.cust.id_customer);
        if (checkC && checkC.length > 0) {
          await _supabase
            .from("Master_Customer")
            .update(payload.cust)
            .eq("id_customer", payload.cust.id_customer);
        } else {
          await _supabase.from("Master_Customer").insert([payload.cust]);
        }
        return { success: true, message: "Customer tersimpan!" };

      case "apiSaveUser":
        const { data: checkU } = await _supabase
          .from("Users")
          .select("*")
          .eq("username", payload.userData.username);
        if (checkU && checkU.length > 0) throw new Error("Username sudah ada!");
        await _supabase.from("Users").insert([payload.userData]);
        return { success: true, message: "User baru berhasil dibuat!" };

      case "apiDeleteUser":
        await _supabase
          .from("Users")
          .delete()
          .eq("username", payload.usernameTarget);
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
// DASHBOARD LOGIC
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

    const qtyDay = relatedOrders.reduce(
      (sum, o) => sum + (Number(o.qty_order) || 0),
      0,
    );
    const qtyOut = appData.keluar
      .filter((k) => String(k.Part_Number).trim() === partNum)
      .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);
    const sisaDel = Math.max(0, qtyDay - qtyOut);

    const currentStock = Number(itemBarang.stok) || 0;
    const assyFsg = Number(itemBarang.assy_fsg) || 0;
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
              timer: 1000,
              showConfirmButton: false,
            });
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
              timer: 1000,
              showConfirmButton: false,
            });
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
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">Belum ada barang di database Supabase Anda. Silakan tambah di menu Master Barang.</td></tr>`;
    return;
  }

  const isAdmin = currentUser && currentUser.role === "Admin";
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
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-black text-slate-500 break-words">${row.Customer}</td>
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
      <td class="py-2 px-3 border-2 border-slate-800 text-left text-[10px] text-slate-500 italic max-w-xs truncate">${r.catatan || "-"}</td>
    </tr>`;
    })
    .join("");
}

// =========================================================================
// SMART SCANNER LOGIC
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

  document.getElementById("smInfoRell").innerText = foundData.No_Rel;
  document.getElementById("smInfoPart").innerText = foundData.Part_Number;
  document.getElementById("smInfoNama").innerText = foundData.nama_barang;
  document.getElementById("smInfoStok").innerText = foundData.stock;
  document.getElementById("smInfoTarget").innerText = foundData.sisa_del;
  document.getElementById("smInfoAssy").innerText = foundData.assy_fsg;
  document.getElementById("smInputQty").value = 1;

  const btnWH = document.getElementById("btnGroupWH");
  const btnAssy = document.getElementById("btnGroupAssy");
  if (currentUser.role === "Admin") {
    btnWH.classList.remove("hidden");
    btnAssy.classList.remove("hidden");
  } else if (currentUser.role === "Produksi") {
    btnWH.classList.add("hidden");
    btnAssy.classList.remove("hidden");
  } else {
    btnWH.classList.remove("hidden");
    btnAssy.classList.add("hidden");
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
            timer: 1500,
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

  const actionName =
    tipeAction === "IN" ? "apiSaveTransaksiMasuk" : "apiSaveTransaksiKeluar";
  if (tipeAction === "OUT" && qty > activeScannedPart.stock) {
    isProcessing = false;
    return Swal.fire(
      "Stok Kurang!",
      `Stok hanya sisa ${activeScannedPart.stock} Pcs.`,
      "error",
    );
  }

  Swal.fire({
    title: "Mencatat ke Supabase...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend(actionName, {
    partNumber: activeScannedPart.Part_Number,
    qty: qty,
    petugas: currentUser.username,
    catatan: `Smart Scan`,
  })
    .then((res) => {
      isProcessing = false;
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "Berhasil!",
          timer: 1500,
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
// TABEL MASTER DATA & MANAJEMEN USER
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
// LOGIN - DENGAN AUTO CREATE ADMIN PERTAMA
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
      Swal.fire("Gagal", res.message, "error");
    }
  });
}

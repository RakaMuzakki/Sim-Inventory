// =========================================================================
// FITUR TRANSLATE (INDONESIA - MANDARIN)
// =========================================================================
const dict = {
  id: {
    nav_ops: "Operasional",
    nav_board: "Papan Kontrol",
    nav_scan: "Smart Scanner",
    nav_hist: "Riwayat Transaksi",
    nav_master: "Master Data",
    nav_item: "Master Barang",
    nav_cust: "Master Customer",
    nav_user: "Kelola Pengguna",
    btn_login: "Masuk Sistem",
    hdr_overview: "Overview",
    title_board: "Papan Kontrol Seat Assy",
    desc_board: "Monitoring Live Stok & Delivery (Rollover 08:00)",
    lbl_tot_row: "Total Baris:",
    search_part: "Cari Part Number...",
    search_cust: "Cari customer...",
    search_user: "Cari akun...",
    th_cust: "Cust",
    th_rak: "Rak",
    th_part: "Part Number",
    th_stock: "Stock",
    th_del: "Delivery",
    th_target: "QTY/DAY",
    th_out: "QTY/OUT",
    th_sisa: "SISA DEL",
    th_assy: "Assy In<br>FSG",
    btn_cam_on: "Aktifkan Kamera",
    btn_cam_off: "Matikan Kamera",
    lbl_gun: "Mode Gun Scanner (Batch Troli)",
    input_gun: "Klik & Scan barcode...",
    title_trolley: "Daftar Troli",
    lbl_dest: "Tujuan Pengiriman Massal",
    btn_assy: "Tambah ke Assy",
    opt_all: "Semua Aktivitas",
    btn_export: "Ekspor",
    th_time: "Waktu",
    th_type: "Tipe",
    th_diff: "Selisih",
    th_pic: "Petugas",
    th_note: "Catatan",
    th_item_name: "Nama Barang",
    th_main_stock: "Stok Utama",
    th_action: "Aksi",
    btn_new_item: "Part Baru",
    btn_new_cust: "Customer Baru",
    btn_new_user: "Akun Baru",
    th_id_cust: "ID Customer",
    th_company: "Perusahaan",
    th_address: "Alamat",
    th_user: "Username",
    th_auth: "Otorisasi",
  },
  zh: {
    nav_ops: "运营",
    nav_board: "控制面板",
    nav_scan: "智能扫码",
    nav_hist: "交易记录",
    nav_master: "主数据",
    nav_item: "物料主数据",
    nav_cust: "客户主数据",
    nav_user: "用户管理",
    btn_login: "登录系统",
    hdr_overview: "总览",
    title_board: "座椅总成控制面板",
    desc_board: "实时库存与发货监控（每日 08:00 重置）",
    lbl_tot_row: "总行数：",
    search_part: "搜索零件号...",
    search_cust: "搜索客户...",
    search_user: "搜索账号...",
    th_cust: "客户",
    th_rak: "货架",
    th_part: "零件号",
    th_stock: "库存",
    th_del: "发货量",
    th_target: "日目标量",
    th_out: "出库量",
    th_sisa: "剩余发货量",
    th_assy: "总成入库<br>FSG",
    btn_cam_on: "启用相机",
    btn_cam_off: "关闭相机",
    lbl_gun: "扫码枪模式（手推车批量）",
    input_gun: "点击并扫描条码...",
    title_trolley: "手推车列表",
    lbl_dest: "批量发货目的地",
    btn_assy: "加入总成",
    opt_all: "所有活动",
    btn_export: "导出 Excel",
    th_time: "时间",
    th_type: "类型",
    th_diff: "差异",
    th_pic: "操作员",
    th_note: "备注",
    th_item_name: "物料名称",
    th_main_stock: "主库存",
    th_action: "操作",
    btn_new_item: "新增物料",
    btn_new_cust: "新增客户",
    btn_new_user: "新增账号",
    th_id_cust: "客户ID",
    th_company: "公司",
    th_address: "地址",
    th_user: "用户名",
    th_auth: "权限",
  },
};

let currentLang = localStorage.getItem("sim_lang") || "id";

if (!dict[currentLang]) {
  currentLang = "id";
}

function toggleLang() {
  currentLang = currentLang === "id" ? "zh" : "id";
  localStorage.setItem("sim_lang", currentLang);
  applyLang();

  if (typeof refreshAllUI === "function") {
    refreshAllUI();
  }
}

function applyLang() {
  const btn = document.getElementById("btnLang");

  if (btn) {
    btn.innerText = currentLang === "id" ? "中文" : "ID";
  }

  const langDict = dict[currentLang] || dict.id;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const text = langDict[key] || dict.id[key];

    if (!text) return;

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.placeholder = text;
    } else {
      el.innerHTML = text;
    }
  });
}

// =========================================================================
// KONFIGURASI SUPABASE DATABASE
// =========================================================================
// ⚠️ PASTIKAN URL DAN KEY INI DIGANTI DENGAN MILIK ANDA SEBELUM DI-SAVE ⚠️
const SUPABASE_URL = "https://qvvpfsndszxdjtgpudfp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dnBmc25kc3p4ZGp0Z3B1ZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTExMTksImV4cCI6MjEwNjkyNzExOX0.VuvLwmjVTpdl9vgwaZcWqvWIk_C8PacK5h1M4m6E2mg";

const RLS_SECRET = "KunciGudang2026!";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { headers: { "x-sim-secret": RLS_SECRET } },
});

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
let activeScannedPart = null;
let isProcessing = false;

let selectedForDelete = [];
let batchTrolley = [];
let currentEditPart = null;
let currentEditCustomer = null;
let currentEditUser = null;

let codeReader = null;
let isCameraPaused = false;

const style = document.createElement("style");
style.innerHTML = `
  @keyframes toastSlideDown { from { transform: translateY(-100%) scale(0.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
  @keyframes toastSlideUp { from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(-100%) scale(0.9); opacity: 0; } }
  .animate-toast-in { animation: toastSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-toast-out { animation: toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;
document.head.appendChild(style);

function showToast(type, title, message = "") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className =
      "fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-[90%] max-w-sm";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  let iconColor = "text-green-500";
  let icon = '<i class="fa-solid fa-circle-check text-xl"></i>';

  if (type === "error") {
    iconColor = "text-red-500";
    icon = '<i class="fa-solid fa-circle-xmark text-xl"></i>';
  } else if (type === "warning") {
    iconColor = "text-amber-500";
    icon = '<i class="fa-solid fa-triangle-exclamation text-xl"></i>';
  } else if (type === "info") {
    iconColor = "text-blue-500";
    icon = '<i class="fa-solid fa-circle-info text-xl"></i>';
  }

  toast.className = `flex items-start gap-4 bg-white/80 backdrop-blur-2xl border border-white shadow-xl shadow-gray-200/50 p-4 rounded-2xl pointer-events-auto animate-toast-in`;
  toast.innerHTML = `
    <div class="${iconColor} mt-0.5">${icon}</div>
    <div class="flex-1">
      <h4 class="font-bold text-sm text-gray-900 leading-tight">${title}</h4>
      ${message ? `<p class="text-[11px] font-medium text-gray-500 mt-1 leading-snug">${message}</p>` : ""}
    </div>
    <button onclick="this.parentElement.classList.replace('animate-toast-in', 'animate-toast-out'); setTimeout(() => this.parentElement.remove(), 300)" class="text-gray-400 hover:text-gray-800 transition-colors">
      <i class="fa-solid fa-xmark text-lg"></i>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.replace("animate-toast-in", "animate-toast-out");
      setTimeout(() => toast.remove(), 300);
    }
  }, 3000);
}

const swalUI = Swal.mixin({
  buttonsStyling: false,
});

window.addEventListener("DOMContentLoaded", () => {
  applyLang();
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

  setInterval(() => {
    const overviewTab = document.getElementById("tab-overview");
    const riwayatTab = document.getElementById("tab-riwayat");
    const barangTab = document.getElementById("tab-barang");
    const custTab = document.getElementById("tab-customer");
    const usersTab = document.getElementById("tab-users");

    if (isProcessing) return;

    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden")) ||
      (barangTab && !barangTab.classList.contains("hidden")) ||
      (custTab && !custTab.classList.contains("hidden")) ||
      (usersTab && !usersTab.classList.contains("hidden"))
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

function getOperationalDayInfo() {
  const now = new Date();
  const opStart = new Date(now);
  opStart.setHours(8, 0, 0, 0);
  if (now < opStart) {
    opStart.setDate(opStart.getDate() - 1);
  }
  const yyyy = opStart.getFullYear();
  const mm = String(opStart.getMonth() + 1).padStart(2, "0");
  const dd = String(opStart.getDate()).padStart(2, "0");
  return { opKey: `${yyyy}-${mm}-${dd}`, opStart };
}

async function checkAndRunDailyRollover(isForce = false) {
  if (isProcessing || !appData.barang || appData.barang.length === 0) return;
  const { opKey } = getOperationalDayInfo();
  const markerUser = (appData.users || []).find(
    (u) => u.username === "__SYSTEM_ROLLOVER__",
  );

  if (!markerUser) {
    await _supabase
      .from("Users")
      .insert([
        { username: "__SYSTEM_ROLLOVER__", password: "NEW", role: "SYSTEM" },
      ]);
    appData.users.push({
      username: "__SYSTEM_ROLLOVER__",
      password: "NEW",
      role: "SYSTEM",
    });
    return;
  }

  if (markerUser.password !== opKey || isForce) {
    isProcessing = true;
    try {
      if (isForce) {
        showToast("info", "Memproses...", "Melakukan tutup buku manual");
      }

      for (const itemBarang of appData.barang) {
        const partNum = String(itemBarang.Part_Number).trim();
        const relatedOrders = appData.orders.filter(
          (o) => String(o.Part_Number).trim() === partNum,
        );
        const totalQtyDay = relatedOrders.reduce(
          (sum, o) => sum + (Number(o.qty_order) || 0),
          0,
        );
        const currentStock = Number(itemBarang.stok) || 0;
        const assyFsg = Number(itemBarang.assy_fsg) || 0;

        const newOpeningStock = currentStock + assyFsg - totalQtyDay;

        await _supabase
          .from("Master_Barang")
          .update({ stok: newOpeningStock, assy_fsg: 0 })
          .eq("Part_Number", itemBarang.Part_Number);
        itemBarang.stok = newOpeningStock;
        itemBarang.assy_fsg = 0;

        localStorage.removeItem("multi_cust_orders_" + partNum);
      }

      for (const ord of appData.orders) {
        if (ord.id !== undefined) {
          await _supabase
            .from("List_Order")
            .update({ qty_order: 0 })
            .eq("id", ord.id);
          ord.qty_order = 0;
        }
      }

      await _supabase
        .from("Users")
        .update({ password: opKey })
        .eq("username", "__SYSTEM_ROLLOVER__");
      markerUser.password = opKey;
    } catch (e) {
      console.error("Rollover error:", e);
    }
    isProcessing = false;
  }
}

function triggerForceRollover() {
  if (!currentUser || currentUser.role !== "Admin") return;
  swalUI
    .fire({
      title: currentLang === "zh" ? "手动结算?" : "Paksa Tutup Buku?",
      html:
        currentLang === "zh"
          ? "这会强制将当天的组装数据合并到总库存并清空目标量。"
          : "Tindakan ini akan mereset Target dan memindahkan Stok Assy ke Stok Utama sekarang juga.",
      showCancelButton: true,
      confirmButtonText:
        currentLang === "zh" ? "是的，立即重置" : "Ya, Reset Sekarang",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        swalUI.fire({
          title: currentLang === "zh" ? "处理中..." : "Memproses...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        checkAndRunDailyRollover(true).then(() => {
          Swal.close();
          showToast(
            "success",
            currentLang === "zh" ? "成功" : "Berhasil",
            currentLang === "zh"
              ? "手动结算完成"
              : "Tutup Buku manual selesai.",
          );
          refreshAllData();
        });
      }
    });
}

function resolveCustomerDisplay(custCode) {
  if (
    !custCode ||
    custCode === "-" ||
    String(custCode) === "undefined" ||
    String(custCode) === "null"
  )
    return "-";
  const cleanCode = String(custCode).trim();
  const found = (appData.customer || []).find(
    (c) =>
      String(c.id_customer).trim().toLowerCase() === cleanCode.toLowerCase() ||
      String(c.nama_customer).trim().toLowerCase() === cleanCode.toLowerCase(),
  );
  return found ? found.nama_customer || found.id_customer : cleanCode;
}

function extractCustomerFromCatatan(catatan) {
  if (!catatan) return null;
  const match = String(catatan).match(
    /Kirim ke:\s*(.+?)(?:\s*\(\d+\s*Troli\))?$/i,
  );
  if (match && match[1]) {
    const raw = match[1].trim();
    if (raw && raw !== "-" && raw.toLowerCase() !== "undefined") {
      return resolveCustomerDisplay(raw);
    }
  }
  const matchManual = String(catatan).match(
    /(?:Kirim ke|Dari|Tujuan):\s*(.+)$/i,
  );
  if (matchManual && matchManual[1]) {
    const raw = matchManual[1].trim();
    if (raw && raw !== "-" && raw.toLowerCase() !== "undefined") {
      return resolveCustomerDisplay(raw);
    }
  }
  return null;
}

function getLocalMultiCustMap(partNum) {
  try {
    const raw = localStorage.getItem("multi_cust_orders_" + partNum);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveLocalMultiCustTarget(partNum, customerName, qtyOrder) {
  const cName = resolveCustomerDisplay(customerName);
  if (!cName || cName === "-") return;
  const map = getLocalMultiCustMap(partNum);
  if (qtyOrder !== undefined && qtyOrder !== null)
    map[cName] = Number(qtyOrder) || 0;
  else if (map[cName] === undefined) map[cName] = 0;
  localStorage.setItem("multi_cust_orders_" + partNum, JSON.stringify(map));
}

function removeLocalMultiCustTarget(partNum, customerName) {
  const cName = resolveCustomerDisplay(customerName);
  const map = getLocalMultiCustMap(partNum);
  delete map[cName];
  localStorage.setItem("multi_cust_orders_" + partNum, JSON.stringify(map));
}

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
        if (
          payload.username === "superadmin" &&
          payload.password === "admin123"
        ) {
          return {
            success: true,
            user: { username: "SuperAdmin", role: "Admin" },
          };
        }

        const { data: cekUsers, error: errCek } = await _supabase
          .from("Users")
          .select("*");
        if (errCek)
          throw new Error("Koneksi Supabase error: " + errCek.message);

        const realUsers = (cekUsers || []).filter(
          (u) => u.username !== "__SYSTEM_ROLLOVER__",
        );

        if (
          realUsers.length === 0 &&
          payload.username.toLowerCase() === "admin"
        ) {
          const { error: errIns } = await _supabase
            .from("Users")
            .insert([{ username: "admin", password: "admin", role: "Admin" }]);
          if (errIns) throw new Error(errIns.message);
          return { success: true, user: { username: "admin", role: "Admin" } };
        }

        const { data: checkUserOnly } = await _supabase
          .from("Users")
          .select("*")
          .ilike("username", payload.username);
        if (!checkUserOnly || checkUserOnly.length === 0) {
          return {
            success: false,
            message: `Akun '${payload.username}' belum terdaftar di sistem!`,
          };
        }

        const { data: loginData } = await _supabase
          .from("Users")
          .select("*")
          .ilike("username", payload.username)
          .eq("password", payload.password);
        if (
          loginData &&
          loginData.length > 0 &&
          loginData[0].username !== "__SYSTEM_ROLLOVER__"
        ) {
          return { success: true, user: loginData[0] };
        } else {
          return {
            success: false,
            message: "Password yang Anda masukkan salah!",
          };
        }

      case "apiSaveTransaksiKeluar":
        if (payload.customer && payload.customer !== "-") {
          const cleanCust = resolveCustomerDisplay(payload.customer);
          saveLocalMultiCustTarget(payload.partNumber, cleanCust);
          const { data: checkOrd } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.partNumber);
          const existingSameCust = (checkOrd || []).find(
            (o) =>
              resolveCustomerDisplay(o.id_customer).toLowerCase() ===
              cleanCust.toLowerCase(),
          );

          if (!existingSameCust) {
            const emptySlot = (checkOrd || []).find(
              (o) =>
                !o.id_customer ||
                o.id_customer === "-" ||
                o.id_customer === "undefined",
            );
            if (emptySlot && emptySlot.id !== undefined) {
              await _supabase
                .from("List_Order")
                .update({ id_customer: cleanCust })
                .eq("id", emptySlot.id);
            } else {
              await _supabase
                .from("List_Order")
                .insert([
                  {
                    Part_Number: payload.partNumber,
                    qty_order: 0,
                    id_customer: cleanCust,
                  },
                ]);
            }
          }
        }
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
        await _supabase
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
        return { success: true };

      case "apiUpdateAssyFsg":
        const { data: bAssyData, error: errAssy } = await _supabase
          .from("Master_Barang")
          .select("assy_fsg")
          .eq("Part_Number", payload.partNumber);
        if (errAssy) throw new Error(errAssy.message);

        const currentAssy =
          bAssyData && bAssyData.length > 0
            ? Number(bAssyData[0].assy_fsg) || 0
            : 0;
        let finalAssy = currentAssy;
        let diff = 0;

        if (payload.mode === "ADD") {
          diff = Number(payload.qty);
          finalAssy = currentAssy + diff;
        } else if (payload.mode === "SET") {
          finalAssy = Number(payload.qty);
          diff = finalAssy - currentAssy;
        }

        await _supabase
          .from("Master_Barang")
          .update({ assy_fsg: finalAssy })
          .eq("Part_Number", payload.partNumber);

        if (diff !== 0 && payload.petugas) {
          if (diff > 0) {
            await _supabase
              .from("Transaksi_Masuk")
              .insert([
                {
                  Part_Number: payload.partNumber,
                  qty: diff,
                  petugas: payload.petugas,
                  catatan: "Masuk Gudang FSG (Hasil Assy)",
                  tanggal: new Date().toISOString(),
                },
              ]);
          } else if (diff < 0) {
            await _supabase
              .from("Transaksi_Masuk")
              .insert([
                {
                  Part_Number: payload.partNumber,
                  qty: diff,
                  petugas: payload.petugas,
                  catatan: "Koreksi Pengurangan Stok Assy",
                  tanggal: new Date().toISOString(),
                },
              ]);
          }
        }
        return { success: true };

      case "apiUpdateQtyDay":
        const custTarget = resolveCustomerDisplay(payload.customer);
        if (custTarget && custTarget !== "-")
          saveLocalMultiCustTarget(payload.partNumber, custTarget, payload.qty);
        const { data: checkO } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);

        const matchedOrder = (checkO || []).find(
          (o) =>
            resolveCustomerDisplay(o.id_customer).toLowerCase() ===
            custTarget.toLowerCase(),
        );
        if (matchedOrder) {
          if (matchedOrder.id !== undefined)
            await _supabase
              .from("List_Order")
              .update({ qty_order: payload.qty })
              .eq("id", matchedOrder.id);
          else
            await _supabase
              .from("List_Order")
              .update({ qty_order: payload.qty })
              .eq("Part_Number", payload.partNumber)
              .eq("id_customer", matchedOrder.id_customer);
        } else if (
          checkO &&
          checkO.length === 1 &&
          (!checkO[0].id_customer || checkO[0].id_customer === "-")
        ) {
          if (checkO[0].id !== undefined)
            await _supabase
              .from("List_Order")
              .update({
                qty_order: payload.qty,
                id_customer: custTarget !== "-" ? custTarget : null,
              })
              .eq("id", checkO[0].id);
          else
            await _supabase
              .from("List_Order")
              .update({ qty_order: payload.qty })
              .eq("Part_Number", payload.partNumber);
        } else {
          await _supabase
            .from("List_Order")
            .insert([
              {
                Part_Number: payload.partNumber,
                qty_order: payload.qty,
                id_customer: custTarget !== "-" ? custTarget : null,
              },
            ]);
        }

        if (payload.petugas && payload.diff !== 0) {
          await _supabase.from("Transaksi_Masuk").insert([
            {
              Part_Number: payload.partNumber,
              qty: payload.diff,
              petugas: payload.petugas,
              catatan: `Update Target QTY/DAY (${custTarget})`,
              tanggal: new Date().toISOString(),
            },
          ]);
        }
        return { success: true };

      case "apiUpdateCustomerPart":
        const { data: checkOCust } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);
        const newCustClean = resolveCustomerDisplay(payload.customer);
        const oldCustClean = resolveCustomerDisplay(payload.oldCustomer);

        if (payload.mode === "ADD_NEW") {
          saveLocalMultiCustTarget(
            payload.partNumber,
            newCustClean,
            Number(payload.qtyOrder) || 0,
          );
          await _supabase
            .from("List_Order")
            .insert([
              {
                Part_Number: payload.partNumber,
                qty_order: Number(payload.qtyOrder) || 0,
                id_customer: newCustClean,
              },
            ]);
          return { success: true };
        }

        if (payload.mode === "DELETE_ROW") {
          removeLocalMultiCustTarget(payload.partNumber, oldCustClean);
          const rowToDelete = (checkOCust || []).find(
            (o) =>
              resolveCustomerDisplay(o.id_customer).toLowerCase() ===
              oldCustClean.toLowerCase(),
          );
          if (rowToDelete && rowToDelete.id !== undefined)
            await _supabase
              .from("List_Order")
              .delete()
              .eq("id", rowToDelete.id);
          return { success: true };
        }

        const oldMap = getLocalMultiCustMap(payload.partNumber);
        const prevQty = oldMap[oldCustClean] || 0;
        removeLocalMultiCustTarget(payload.partNumber, oldCustClean);
        if (newCustClean !== "-")
          saveLocalMultiCustTarget(payload.partNumber, newCustClean, prevQty);

        if (checkOCust && checkOCust.length > 0) {
          const targetRow =
            checkOCust.find(
              (o) =>
                resolveCustomerDisplay(o.id_customer).toLowerCase() ===
                oldCustClean.toLowerCase(),
            ) || checkOCust[0];
          if (targetRow.id !== undefined)
            await _supabase
              .from("List_Order")
              .update({ id_customer: newCustClean })
              .eq("id", targetRow.id);
          else
            await _supabase
              .from("List_Order")
              .update({ id_customer: newCustClean })
              .eq("Part_Number", payload.partNumber);
        } else {
          await _supabase
            .from("List_Order")
            .insert([
              {
                Part_Number: payload.partNumber,
                qty_order: 0,
                id_customer: newCustClean,
              },
            ]);
        }
        localStorage.setItem("cust_map_" + payload.partNumber, newCustClean);
        return { success: true };

      case "apiSaveBarang":
        if (payload.isEdit) {
          if (payload.item.Part_Number !== payload.oldPartNumber) {
            const { data: checkB } = await _supabase
              .from("Master_Barang")
              .select("Part_Number")
              .eq("Part_Number", payload.item.Part_Number);
            if (checkB && checkB.length > 0)
              throw new Error("Part Number baru sudah dipakai barang lain!");
          }

          const { error: errUpd } = await _supabase
            .from("Master_Barang")
            .update(payload.item)
            .eq("Part_Number", payload.oldPartNumber);
          if (errUpd) throw new Error(errUpd.message);

          if (payload.item.Part_Number !== payload.oldPartNumber) {
            await _supabase
              .from("List_Order")
              .update({ Part_Number: payload.item.Part_Number })
              .eq("Part_Number", payload.oldPartNumber);
            await _supabase
              .from("Transaksi_Masuk")
              .update({ Part_Number: payload.item.Part_Number })
              .eq("Part_Number", payload.oldPartNumber);
            await _supabase
              .from("Transaksi_Keluar")
              .update({ Part_Number: payload.item.Part_Number })
              .eq("Part_Number", payload.oldPartNumber);

            let oldMapLS = localStorage.getItem(
              "multi_cust_orders_" + payload.oldPartNumber,
            );
            if (oldMapLS) {
              localStorage.setItem(
                "multi_cust_orders_" + payload.item.Part_Number,
                oldMapLS,
              );
              localStorage.removeItem(
                "multi_cust_orders_" + payload.oldPartNumber,
              );
            }
            let custMapLS = localStorage.getItem(
              "cust_map_" + payload.oldPartNumber,
            );
            if (custMapLS) {
              localStorage.setItem(
                "cust_map_" + payload.item.Part_Number,
                custMapLS,
              );
              localStorage.removeItem("cust_map_" + payload.oldPartNumber);
            }
          }
        } else {
          const { data: checkB } = await _supabase
            .from("Master_Barang")
            .select("Part_Number")
            .eq("Part_Number", payload.item.Part_Number);
          if (checkB && checkB.length > 0)
            throw new Error("Part Number sudah ada di Master Data!");
          const { error: errIns } = await _supabase
            .from("Master_Barang")
            .insert([payload.item]);
          if (errIns) throw new Error(errIns.message);
        }

        if (payload.customer && payload.customer !== "-") {
          const cClean = resolveCustomerDisplay(payload.customer);
          localStorage.setItem("cust_map_" + payload.item.Part_Number, cClean);
          saveLocalMultiCustTarget(payload.item.Part_Number, cClean, 0);
          const { data: checkOrdB } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.item.Part_Number);
          if (!checkOrdB || checkOrdB.length === 0) {
            await _supabase
              .from("List_Order")
              .insert([
                {
                  Part_Number: payload.item.Part_Number,
                  qty_order: 0,
                  id_customer: cClean,
                },
              ]);
          } else if (payload.isEdit) {
            if (checkOrdB[0].id !== undefined)
              await _supabase
                .from("List_Order")
                .update({ id_customer: cClean })
                .eq("id", checkOrdB[0].id);
            else
              await _supabase
                .from("List_Order")
                .update({ id_customer: cClean })
                .eq("Part_Number", payload.item.Part_Number);
          }
        }
        return {
          success: true,
          message: payload.isEdit
            ? "Data barang berhasil diubah!"
            : "Barang baru berhasil ditambahkan!",
        };

      case "apiSaveCustomer":
        if (payload.isEdit) {
          if (payload.cust.id_customer !== payload.oldIdCustomer) {
            const { data: checkC } = await _supabase
              .from("Master_Customer")
              .select("id_customer")
              .eq("id_customer", payload.cust.id_customer);
            if (checkC && checkC.length > 0)
              throw new Error(
                "ID Customer baru sudah terdaftar untuk perusahaan lain!",
              );
          }
          const { error: errUpd } = await _supabase
            .from("Master_Customer")
            .update(payload.cust)
            .eq("id_customer", payload.oldIdCustomer);
          if (errUpd) throw new Error(errUpd.message);
          if (payload.cust.id_customer !== payload.oldIdCustomer) {
            await _supabase
              .from("List_Order")
              .update({ id_customer: payload.cust.id_customer })
              .eq("id_customer", payload.oldIdCustomer);
          }
        } else {
          const { data: checkC } = await _supabase
            .from("Master_Customer")
            .select("*")
            .eq("id_customer", payload.cust.id_customer);
          if (checkC && checkC.length > 0)
            throw new Error("ID Customer sudah ada!");
          const { error: errIns } = await _supabase
            .from("Master_Customer")
            .insert([payload.cust]);
          if (errIns) throw new Error(errIns.message);
        }
        return {
          success: true,
          message: payload.isEdit
            ? "Data Customer diperbarui!"
            : "Customer baru tersimpan!",
        };

      case "apiSaveUser":
        if (payload.isEdit) {
          if (payload.userData.username !== payload.oldUsername) {
            const { data: checkU } = await _supabase
              .from("Users")
              .select("username")
              .eq("username", payload.userData.username);
            if (checkU && checkU.length > 0)
              throw new Error("Username baru sudah dipakai oleh orang lain!");
          }
          const { error: errUpd } = await _supabase
            .from("Users")
            .update(payload.userData)
            .eq("username", payload.oldUsername);
          if (errUpd) throw new Error(errUpd.message);
          if (payload.userData.username !== payload.oldUsername) {
            await _supabase
              .from("Transaksi_Masuk")
              .update({ petugas: payload.userData.username })
              .eq("petugas", payload.oldUsername);
            await _supabase
              .from("Transaksi_Keluar")
              .update({ petugas: payload.userData.username })
              .eq("petugas", payload.oldUsername);
            if (currentUser && currentUser.username === payload.oldUsername) {
              currentUser.username = payload.userData.username;
              sessionStorage.setItem(
                "sim_inventory_user",
                JSON.stringify(currentUser),
              );
              applyRbacUI();
            }
          }
        } else {
          const { data: checkU } = await _supabase
            .from("Users")
            .select("*")
            .eq("username", payload.userData.username);
          if (checkU && checkU.length > 0)
            throw new Error("Username sudah terdaftar!");
          const { error: errIns } = await _supabase
            .from("Users")
            .insert([payload.userData]);
          if (errIns) throw new Error(errIns.message);
        }
        return {
          success: true,
          message: payload.isEdit
            ? "User berhasil diperbarui!"
            : "User baru berhasil didaftarkan!",
        };

      case "apiDeleteBarang":
        await _supabase
          .from("Master_Barang")
          .delete()
          .eq("Part_Number", payload.partNumber);
        await _supabase
          .from("List_Order")
          .delete()
          .eq("Part_Number", payload.partNumber);
        localStorage.removeItem("cust_map_" + payload.partNumber);
        localStorage.removeItem("multi_cust_orders_" + payload.partNumber);
        return { success: true, message: "Barang terhapus permanen!" };

      case "apiBulkDeleteBarang":
        await _supabase
          .from("Master_Barang")
          .delete()
          .in("Part_Number", payload.partNumbers);
        await _supabase
          .from("List_Order")
          .delete()
          .in("Part_Number", payload.partNumbers);
        payload.partNumbers.forEach((pn) => {
          localStorage.removeItem("cust_map_" + pn);
          localStorage.removeItem("multi_cust_orders_" + pn);
        });
        return { success: true, message: "Barang terpilih terhapus permanen!" };

      case "apiDeleteCustomer":
        await _supabase
          .from("Master_Customer")
          .delete()
          .eq("id_customer", payload.id_customer);
        return { success: true, message: "Customer terhapus!" };

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

function switchTab(tabId) {
  document
    .querySelectorAll(".tab-pane")
    .forEach((el) => el.classList.add("hidden"));
  const activeTab = document.getElementById(`tab-${tabId}`);
  if (activeTab) activeTab.classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.remove("bg-white", "shadow-sm", "text-apple-blue");
    btn.classList.add("text-gray-600");
  });
  const activeNav = document.getElementById(`btn-tab-${tabId}`);
  if (activeNav) {
    activeNav.classList.add("bg-white", "shadow-sm", "text-apple-blue");
    activeNav.classList.remove("text-gray-600");
  }

  if (tabId === "overview") renderSeatAssyControlBoard();
  if (tabId === "riwayat") renderRiwayatTable();
  if (tabId === "barang")
    renderMasterBarangTable(
      document.getElementById("searchMasterBarang")?.value || "",
    );
  if (tabId === "customer")
    renderCustomerTable(
      document.getElementById("searchMasterCustomer")?.value || "",
    );
  if (tabId === "users")
    renderUsersTable(document.getElementById("searchMasterUser")?.value || "");

  if (tabId !== "scanner") stopSmartScanner();

  if (tabId === "scanner") {
    populateCustomerDropdown(
      document.getElementById("batchSelectCustomer"),
      "-",
    );
    updateBatchTrolleyUI();
    setTimeout(() => document.getElementById("manualSmartInput")?.focus(), 100);
  }

  closeSidebar();
}

function applyRbacUI() {
  const pCard = document.getElementById("userProfileCard"),
    gPrompt = document.getElementById("guestLoginPrompt");
  document
    .querySelectorAll(".role-admin, .role-auth")
    .forEach((el) => el.classList.add("hidden"));
  const bWH = document.getElementById("batchBtnGroupWH"),
    bAssy = document.getElementById("batchBtnGroupAssy"),
    bCust = document.getElementById("batchCustWrapper");
  const btnForce = document.getElementById("btnForceRollover");

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

    if (currentUser.role === "Admin") {
      document
        .querySelectorAll(".role-admin")
        .forEach((el) => el.classList.remove("hidden"));
      if (btnForce) {
        btnForce.classList.remove("hidden");
        btnForce.classList.add("flex");
      }
    } else {
      if (btnForce) {
        btnForce.classList.add("hidden");
        btnForce.classList.remove("flex");
      }
    }

    if (bWH && bAssy && bCust) {
      if (currentUser.role === "Admin") {
        bWH.classList.remove("hidden");
        bAssy.classList.remove("hidden");
        bCust.classList.remove("hidden");
      } else if (currentUser.role === "Produksi") {
        bWH.classList.add("hidden");
        bAssy.classList.remove("hidden");
        bCust.classList.add("hidden");
      } else {
        bWH.classList.remove("hidden");
        bAssy.classList.add("hidden");
        bCust.classList.remove("hidden");
      }
    }
  } else {
    pCard.classList.add("hidden");
    pCard.classList.remove("flex");
    gPrompt.classList.remove("hidden");
    if (btnForce) {
      btnForce.classList.add("hidden");
      btnForce.classList.remove("flex");
    }
  }
}

function showSyncSpinner(show) {
  const s = document.getElementById("syncSpinner");
  if (s) s.classList.toggle("animate-spin", show);
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
        showToast(
          "error",
          "Koneksi Gagal",
          res.message || "Gagal memuat data dari Supabase",
        );
    })
    .catch((err) => {
      showSyncSpinner(false);
      showToast("error", "Error", err.message);
    });
}

function refreshAllUI() {
  renderSeatAssyControlBoard(
    document.getElementById("globalSearchInput")?.value || "",
  );
  renderRiwayatTable();
  renderMasterBarangTable(
    document.getElementById("searchMasterBarang")?.value || "",
  );
  renderCustomerTable(
    document.getElementById("searchMasterCustomer")?.value || "",
  );
  renderUsersTable(document.getElementById("searchMasterUser")?.value || "");
  populateCustomerDropdown(
    document.getElementById("batchSelectCustomer"),
    document.getElementById("batchSelectCustomer")?.value || "-",
  );
}

function buildSeatAssyControlDataset() {
  const list = [];
  const { opStart } = getOperationalDayInfo();

  appData.barang.forEach((itemBarang) => {
    const partNum = String(itemBarang.Part_Number).trim();
    const relatedOrders = appData.orders.filter(
      (o) => String(o.Part_Number).trim() === partNum,
    );
    const currentStock = Number(itemBarang.stok) || 0;
    const assyFsg = Number(itemBarang.assy_fsg) || 0;

    const partOutLogs = appData.keluar.filter(
      (k) =>
        String(k.Part_Number).trim() === partNum &&
        new Date(k.tanggal || k.created_at) >= opStart,
    );
    const customerMap = new Map();

    relatedOrders.forEach((ord) => {
      const cName = resolveCustomerDisplay(ord.id_customer);
      if (cName && cName !== "-") {
        const key = cName.toLowerCase();
        customerMap.set(key, {
          name: cName,
          qty_day:
            (customerMap.get(key)?.qty_day || 0) + (Number(ord.qty_order) || 0),
        });
      }
    });

    const localMap = getLocalMultiCustMap(partNum);
    Object.keys(localMap).forEach((cRaw) => {
      const cName = resolveCustomerDisplay(cRaw);
      if (cName && cName !== "-") {
        const key = cName.toLowerCase();
        if (!customerMap.has(key))
          customerMap.set(key, {
            name: cName,
            qty_day: Number(localMap[cRaw]) || 0,
          });
        else if (
          customerMap.get(key).qty_day === 0 &&
          Number(localMap[cRaw]) > 0
        )
          customerMap.get(key).qty_day = Number(localMap[cRaw]);
      }
    });

    partOutLogs.forEach((k) => {
      const extractedCust = extractCustomerFromCatatan(k.catatan);
      if (extractedCust && extractedCust !== "-") {
        const key = extractedCust.toLowerCase();
        if (!customerMap.has(key))
          customerMap.set(key, {
            name: extractedCust,
            qty_day: Number(localMap[extractedCust]) || 0,
          });
      }
    });

    if (customerMap.size === 0) {
      let fallbackCust = resolveCustomerDisplay(
        itemBarang.id_customer ||
          localStorage.getItem("cust_map_" + partNum) ||
          "-",
      );
      const fallbackQtyDay = relatedOrders.reduce(
        (s, o) => s + (Number(o.qty_order) || 0),
        0,
      );
      customerMap.set(fallbackCust.toLowerCase(), {
        name: fallbackCust,
        qty_day: fallbackQtyDay,
      });
    }

    let totalQtyDayAllCust = 0;
    customerMap.forEach((val) => {
      totalQtyDayAllCust += val.qty_day;
    });
    const variancePart = currentStock + assyFsg - totalQtyDayAllCust;

    const custEntries = Array.from(customerMap.values());
    custEntries.forEach((custObj, idx) => {
      const qtyOutCust = partOutLogs
        .filter((k) => {
          const logCust = extractCustomerFromCatatan(k.catatan);
          if (logCust)
            return logCust.toLowerCase() === custObj.name.toLowerCase();
          return idx === 0;
        })
        .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);

      list.push({
        Customer: custObj.name,
        CustomerCount: custEntries.length,
        No_Rel: itemBarang.No_Rel || "-",
        Part_Number: partNum,
        nama_barang: itemBarang.nama_barang || "-",
        stock: currentStock,
        qty_day: custObj.qty_day,
        qty_out: qtyOutCust,
        sisa_del: Math.max(0, custObj.qty_day - qtyOutCust),
        assy_fsg: assyFsg,
        variance: variancePart,
      });
    });
  });
  appData.seatAssyControl = list;
}

function promptUpdateCustomerPart(partNumber, currentCust, custCount = 1) {
  if (isProcessing) return;
  if (!appData.customer || appData.customer.length === 0)
    return showToast("info", "Info", "Tambahkan data di Master Customer dulu!");

  let optionsHtml = `<option value="-">-- Kosongkan --</option>`;
  appData.customer.forEach((c) => {
    const val = c.nama_customer || c.id_customer;
    optionsHtml += `<option value="${val}" ${String(val).toLowerCase() === String(currentCust).toLowerCase() ? "selected" : ""}>${c.nama_customer ? `${c.nama_customer} (${c.id_customer})` : c.id_customer}</option>`;
  });

  swalUI
    .fire({
      title: currentLang === "zh" ? "选择目标客户" : "Pilih Customer Tujuan",
      html: `<div class="text-left"><p class="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3">${partNumber}</p>
      <div class="mb-3"><label class="block text-xs font-medium text-gray-500 mb-1">${currentLang === "zh" ? "客户:" : "Customer:"}</label><select id="swalSelectCust" class="swal2-select w-full rounded-xl px-4 py-3 text-sm">${optionsHtml}</select></div>
      <div><label class="block text-xs font-medium text-gray-500 mb-1">${currentLang === "zh" ? "操作:" : "Tindakan:"}</label>
        <select id="swalModeCust" onchange="document.getElementById('swalWrapQtyBaru').classList.toggle('hidden', this.value !== 'ADD_NEW')" class="swal2-select w-full rounded-xl px-4 py-3 text-sm">
          <option value="UPDATE">${currentLang === "zh" ? "仅修改此行" : "Ubah Baris Ini Saja"}</option><option value="ADD_NEW">${currentLang === "zh" ? "+ 添加新目标 (相同零件)" : "+ Tambah Tujuan Baru (Part Sama)"}</option>
          ${custCount > 1 ? `<option value="DELETE_ROW">${currentLang === "zh" ? "删除此行" : "Hapus Baris Ini"}</option>` : ""}
        </select>
      </div>
      <div id="swalWrapQtyBaru" class="hidden mt-3"><label class="block text-xs font-medium text-gray-500 mb-1">${currentLang === "zh" ? "新的发货目标 (Pcs):" : "Target Pengiriman (Pcs):"}</label><input type="number" id="swalQtyOrderBaru" value="100" class="swal2-input" /></div>
    </div>`,
      showCancelButton: true,
      confirmButtonText: currentLang === "zh" ? "保存" : "Simpan",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
      preConfirm: () => ({
        customer: document.getElementById("swalSelectCust").value,
        mode: document.getElementById("swalModeCust").value,
        qtyOrder: document.getElementById("swalQtyOrderBaru").value,
      }),
    })
    .then((res) => {
      if (res.isConfirmed) {
        if (
          res.value.mode === "ADD_NEW" &&
          (!res.value.customer || res.value.customer === "-")
        )
          return showToast(
            "warning",
            "Pilih Customer!",
            "Pilih nama Customer baru yang ingin ditambahkan.",
          );
        isProcessing = true;
        swalUI.fire({
          title: "Menyimpan...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiUpdateCustomerPart", {
          partNumber,
          oldCustomer: currentCust,
          ...res.value,
        }).then((r) => {
          isProcessing = false;
          Swal.close();
          if (r.success) {
            showToast("success", "Tersimpan!");
            refreshAllData();
          } else {
            showToast("error", "Gagal", r.message);
          }
        });
      }
    });
}

function promptUpdateAssyFsg(partNumber, currentQty) {
  if (!currentUser) return openLoginModal();
  if (isProcessing) return;

  swalUI
    .fire({
      title: currentLang === "zh" ? "更新组装库存" : "Update Stok Assy",
      html: `<p class="text-sm font-bold text-gray-800 mb-1">${partNumber}</p>
           <p class="text-xs text-purple-600 font-medium mb-3">${currentLang === "zh" ? "当前记录:" : "Tercatat saat ini:"} <b>${currentQty}</b> Pcs</p>
           <p class="text-[11px] text-gray-500">${currentLang === "zh" ? "输入 <b>总数</b>。系统将自动计算差额并记录到交易历史中。" : "Masukkan <b>Total Akhir</b>. Sistem akan otomatis menghitung selisihnya dan mencatat ke Riwayat Transaksi."}</p>`,
      input: "number",
      inputValue: currentQty,
      inputAttributes: { min: 0 },
      showCancelButton: true,
      confirmButtonText: currentLang === "zh" ? "保存总数" : "Simpan Total",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        const newTotal = Number(res.value) || 0;
        if (newTotal < 0)
          return showToast("error", "Error", "Total tidak boleh minus");
        if (newTotal === currentQty)
          return showToast(
            "info",
            "Tidak ada perubahan",
            "Angka sama dengan sebelumnya",
          );

        isProcessing = true;
        swalUI.fire({
          title: "Memproses...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        sendToBackend("apiUpdateAssyFsg", {
          partNumber: partNumber,
          qty: newTotal,
          mode: "SET",
          petugas: currentUser.username,
        }).then((response) => {
          isProcessing = false;
          Swal.close();
          if (response.success) {
            showToast("success", "Berhasil Diupdate!");
            refreshAllData();
          } else {
            showToast("error", "Gagal", response.message);
          }
        });
      }
    });
}

function promptUpdateQtyDay(partNumber, currentQty, customerName = "-") {
  if (!currentUser) return openLoginModal();
  if (isProcessing) return;

  swalUI
    .fire({
      title:
        currentLang === "zh" ? "设置每日目标 (QTY/DAY)" : "Set Target Harian",
      html: `<p class="text-sm font-bold text-gray-800 mb-1">${partNumber}</p>
           <p class="text-xs text-gray-600 font-medium mb-1">${currentLang === "zh" ? "目的:" : "Tujuan:"} ${customerName}</p>
           <p class="text-xs text-apple-blue font-medium mb-3">${currentLang === "zh" ? "当前目标:" : "Target saat ini:"} <b>${currentQty}</b> Pcs</p>
           <p class="text-[11px] text-gray-500">${currentLang === "zh" ? "输入 <b>最终目标总数</b>。系统将自动计算差额并将其记录在历史记录中。" : "Masukkan <b>Total Akhir Target</b>. Sistem akan otomatis menghitung selisih perubahannya dan mencatatnya ke Riwayat Transaksi."}</p>`,
      input: "number",
      inputValue: currentQty > 0 ? currentQty : "",
      showCancelButton: true,
      confirmButtonText: currentLang === "zh" ? "保存目标" : "Simpan Target",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        const newTotal = Number(res.value) || 0;
        if (newTotal < 0)
          return showToast("error", "Error", "Target tidak boleh minus");

        const diff = newTotal - currentQty;
        if (diff === 0)
          return showToast(
            "info",
            "Tidak ada perubahan",
            "Angka target sama dengan sebelumnya",
          );

        isProcessing = true;
        swalUI.fire({
          title: "Menyimpan...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        sendToBackend("apiUpdateQtyDay", {
          partNumber: partNumber,
          qty: newTotal,
          diff: diff,
          customer: customerName,
          petugas: currentUser.username,
        }).then((response) => {
          isProcessing = false;
          Swal.close();
          if (response.success) {
            showToast("success", "Target Disimpan");
            refreshAllData();
          } else {
            showToast("error", "Gagal", response.message);
          }
        });
      }
    });
}

function promptUpdateQtyOut(partNumber, customerName, currentQtyOut) {
  if (!currentUser) return openLoginModal();
  if (isProcessing) return;

  swalUI
    .fire({
      title: currentLang === "zh" ? "更新发货 (OUT)" : "Update Pengiriman",
      html: `<p class="text-sm font-bold text-gray-800 mb-1">${partNumber}</p>
           <p class="text-xs text-gray-600 font-medium mb-1">${currentLang === "zh" ? "目的:" : "Tujuan:"} ${customerName}</p>
           <p class="text-xs text-red-500 font-medium mb-3">${currentLang === "zh" ? "当前已发送:" : "Terkirim saat ini:"} <b>${currentQtyOut}</b> Pcs</p>
           <p class="text-[11px] text-gray-500">${currentLang === "zh" ? "输入交货的 <b>最终总数</b>。系统将自动计算差额并将其记录在历史记录中 (OUT)。" : "Masukkan <b>Total Akhir</b> pengiriman. Sistem otomatis menghitung selisih dan mencatatnya ke Riwayat (OUT)."}</p>`,
      input: "number",
      inputValue: currentQtyOut,
      inputAttributes: { min: 0 },
      showCancelButton: true,
      confirmButtonText: currentLang === "zh" ? "保存总数" : "Simpan Total",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        const newTotal = Number(res.value) || 0;
        if (newTotal < 0)
          return showToast("error", "Error", "Total tidak boleh minus");
        if (newTotal === currentQtyOut)
          return showToast(
            "info",
            "Tidak ada perubahan",
            "Angka sama dengan sebelumnya",
          );

        const diff = newTotal - currentQtyOut;
        isProcessing = true;
        swalUI.fire({
          title: "Mencatat Riwayat...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        let catatanStr =
          diff > 0
            ? `Pengiriman Papan Kontrol - Tujuan: ${customerName}`
            : `Koreksi Batal Kirim - Dari: ${customerName}`;

        sendToBackend("apiSaveTransaksiKeluar", {
          partNumber: partNumber,
          qty: diff,
          petugas: currentUser.username,
          customer: customerName,
          catatan: catatanStr,
        }).then((response) => {
          isProcessing = false;
          Swal.close();
          if (response.success) {
            showToast("success", "Berhasil Diperbarui!");
            refreshAllData();
          } else {
            showToast("error", "Gagal", response.message);
          }
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
    tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-gray-400" id="txtMemuatPapan">${currentLang === "zh" ? "加载工作区数据..." : "Memuat data ruang kerja..."}</td></tr>`;
    return;
  }

  dataset.sort((a, b) => {
    if (a.Customer < b.Customer) return -1;
    if (a.Customer > b.Customer) return 1;
    if (a.No_Rel < b.No_Rel) return -1;
    if (a.No_Rel > b.No_Rel) return 1;
    return 0;
  });

  const canEditTarget = currentUser !== null;
  const canEditCust =
    currentUser &&
    (currentUser.role === "Admin" || currentUser.role === "Warehouse");
  const canEditAssy =
    currentUser &&
    (currentUser.role === "Admin" || currentUser.role === "Produksi");

  let html = "";

  for (let i = 0; i < dataset.length; i++) {
    let row = dataset[i];
    const formatNum = (num) => (num === 0 ? "-" : num);
    let varFormat =
      row.variance > 0
        ? "+" + row.variance
        : row.variance < 0
          ? row.variance
          : "-";

    let varBadge =
      row.variance > 0
        ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-600 backdrop-blur-md">${varFormat}</span>`
        : row.variance < 0
          ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 backdrop-blur-md">${varFormat}</span>`
          : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-gray-400">-</span>`;

    const custClass = canEditCust
      ? "cursor-pointer hover:bg-black/5 transition-colors rounded-xl p-2 inline-block"
      : "";
    const custAction = canEditCust
      ? `onclick="promptUpdateCustomerPart('${row.Part_Number}', '${row.Customer}', ${row.CustomerCount || 1})"`
      : "";

    const qtyDayClass = canEditTarget
      ? "cursor-pointer hover:bg-black/5 transition-colors rounded-full block py-1.5"
      : "";
    const qtyDayAction = canEditTarget
      ? `onclick="promptUpdateQtyDay('${row.Part_Number}', ${row.qty_day}, '${row.Customer}')"`
      : "";

    const qtyOutClass = canEditCust
      ? "cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors rounded-full block py-1.5"
      : "";
    const qtyOutAction = canEditCust
      ? `onclick="promptUpdateQtyOut('${row.Part_Number}', '${row.Customer}', ${row.qty_out})"`
      : "";

    const assyClass = canEditAssy
      ? "cursor-pointer hover:bg-purple-50 hover:text-purple-600 transition-colors rounded-full block py-1.5"
      : "";
    const assyAction = canEditAssy
      ? `onclick="promptUpdateAssyFsg('${row.Part_Number}', ${row.assy_fsg})"`
      : "";

    let isFirstOfGroup = false;
    let rowspan = 1;

    if (i === 0 || dataset[i].Customer !== dataset[i - 1].Customer) {
      isFirstOfGroup = true;
      for (let j = i + 1; j < dataset.length; j++) {
        if (dataset[j].Customer === row.Customer) rowspan++;
        else break;
      }
    }

    html += `<tr class="hover:bg-black/5 transition-colors bg-white/40">`;
    if (isFirstOfGroup) {
      html += `<td rowspan="${rowspan}" class="align-top font-bold text-gray-700 text-center bg-white/20"><span class="${custClass}" ${custAction} title="Ubah Customer">${row.Customer}</span></td>`;
    }
    html += `
      <td class="text-center"><span class="px-2.5 py-1 rounded-full bg-black/5 text-gray-700 font-bold text-xs">${row.No_Rel}</span></td>
      <td>
        <div class="font-bold text-gray-900">${row.Part_Number}</div>
        <div class="text-[10px] text-gray-500 uppercase mt-0.5 max-w-[140px] truncate font-medium">${row.nama_barang}</div>
      </td>
      <td class="text-center font-bold text-blue-600">${formatNum(row.stock)}</td>
      <td class="text-center font-bold text-gray-700 border-l border-black/5" title="${canEditTarget ? "Klik untuk Ubah Target (QTY/DAY)" : ""}"><span class="${qtyDayClass}" ${qtyDayAction}>${formatNum(row.qty_day)}</span></td>
      <td class="text-center font-bold text-gray-700" title="${canEditCust ? "Klik untuk Ubah Total Terkirim" : ""}"><span class="${qtyOutClass}" ${qtyOutAction}>${formatNum(row.qty_out)}</span></td>
      <td class="text-center font-bold text-red-500 border-r border-black/5">${formatNum(row.sisa_del)}</td>
      <td class="text-center font-bold text-purple-600" title="${canEditAssy ? "Klik untuk Ubah Stok Assy" : ""}"><span class="${assyClass}" ${assyAction}>${formatNum(row.assy_fsg)}</span></td>
      <td class="text-center">${varBadge}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function handleGlobalSearch(kw) {
  renderSeatAssyControlBoard(kw);
}

function triggerManualGunButton() {
  handleScannerGun({ key: "Enter", preventDefault: () => {} });
}

function handleScannerGun(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const inputField = document.getElementById("manualSmartInput");
    const code = inputField.value.trim();
    if (!code) return;

    const parsed = parseYimmBarcode(code);

    const matchingRows = appData.seatAssyControl.filter(
      (item) =>
        item.Part_Number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ===
          parsed.partNumberClean ||
        item.Part_Number.toLowerCase() === code.toLowerCase(),
    );

    if (matchingRows.length === 0) {
      showToast("error", "Tidak Dikenali", `Part ${code} tidak ada.`);
      inputField.value = "";
      return;
    }

    const foundData =
      matchingRows.find((r) => r.sisa_del > 0) || matchingRows[0];
    foundData._tempScanQty = parsed.qty;

    addToBatchTrolley(foundData);
    inputField.value = "";
    inputField.focus();
  }
}

function addToBatchTrolley(item) {
  const selectedBatchCust = document.getElementById(
    "batchSelectCustomer",
  )?.value;
  const custToUse =
    selectedBatchCust && selectedBatchCust !== "-"
      ? selectedBatchCust
      : item.Customer;
  const existing = batchTrolley.find(
    (b) => b.Part_Number === item.Part_Number && b.Customer === custToUse,
  );

  const addQty = item._tempScanQty || 1;

  if (existing) {
    existing.trolleyCount += 1;
    existing.qtyInput += addQty;
  } else {
    batchTrolley.push({
      Part_Number: item.Part_Number,
      nama_barang: item.nama_barang,
      No_Rel: item.No_Rel,
      Customer: custToUse,
      stock: item.stock,
      assy_fsg: item.assy_fsg,
      trolleyCount: 1,
      qtyInput: addQty,
    });
  }

  item._tempScanQty = null;
  updateBatchTrolleyUI();
  new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3")
    .play()
    .catch(() => {});
}

function clearBatchTrolley() {
  batchTrolley = [];
  updateBatchTrolleyUI();
}

function updateBatchTrolleyUI() {
  const container = document.getElementById("batchTrolleyInlineList");
  if (!container) return;
  if (batchTrolley.length === 0) {
    container.innerHTML = `<div class="py-12 text-center text-gray-400 font-medium text-sm bg-white/40 rounded-2xl border border-white border-dashed" id="txtTroliKosong">${currentLang === "zh" ? "手推车是空的。" : "Troli masih kosong."}</div>`;
    return;
  }

  container.innerHTML = batchTrolley
    .map(
      (b, idx) => `
    <div class="flex items-center justify-between p-4 bg-white/60 border border-white rounded-2xl shadow-sm hover:shadow-md transition-all">
      <div class="text-left pr-2">
        <div class="flex items-center gap-2 mb-1">
           <span class="px-2 py-0.5 bg-gray-200 text-gray-700 font-bold text-[10px] rounded-full shadow-sm">${b.No_Rel}</span>
           <span class="font-bold text-sm text-gray-900">${b.Part_Number}</span>
        </div>
        <div class="text-[10px] font-medium text-gray-500 uppercase">${b.nama_barang}</div>
        <div class="text-[10px] font-medium text-blue-600 mt-1"><i class="fa-solid fa-boxes-stacked mr-1"></i> ${b.trolleyCount}x Troli &nbsp;|&nbsp; <span class="text-gray-600">Cust: ${b.Customer}</span></div>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-center">
          <label class="block text-[9px] font-medium uppercase text-gray-400 mb-0.5">Total Qty</label>
          <input type="number" min="1" value="${b.qtyInput}" oninput="batchTrolley[${idx}].qtyInput = Number(this.value)" class="glass-input w-16 px-2 py-1 text-center font-bold text-sm rounded-xl outline-none text-gray-800" />
        </div>
        <button onclick="batchTrolley.splice(${idx}, 1); updateBatchTrolleyUI();" class="w-8 h-8 rounded-full glass-btn text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function submitBatchTrolley(tipeAction) {
  if (!currentUser) return openLoginModal();
  if (batchTrolley.length === 0)
    return showToast(
      "warning",
      "Troli Kosong!",
      "Silakan scan barang terlebih dahulu.",
    );
  if (isProcessing) return;

  const invalidQty = batchTrolley.find(
    (b) => !b.qtyInput || Number(b.qtyInput) <= 0,
  );
  if (invalidQty)
    return showToast(
      "error",
      "Qty Tidak Valid",
      `Cek jumlah Qty untuk ${invalidQty.Part_Number}`,
    );

  const overrideCust =
    document.getElementById("batchSelectCustomer")?.value || "-";
  if (tipeAction === "OUT") {
    for (const item of batchTrolley) {
      const targetCust =
        overrideCust && overrideCust !== "-" ? overrideCust : item.Customer;
      if (!targetCust || targetCust === "-")
        return showToast(
          "warning",
          "Pilih Customer!",
          "Pilih Tujuan pada dropdown atas!",
        );
    }
  }

  isProcessing = true;
  swalUI.fire({
    title: "Memproses Troli...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  try {
    for (const item of batchTrolley) {
      const qty = Number(item.qtyInput);
      if (tipeAction === "IN") {
        await sendToBackend("apiSaveTransaksiMasuk", {
          partNumber: item.Part_Number,
          qty: qty,
          petugas: currentUser.username,
          catatan: `Batch Gun Masuk (${item.trolleyCount} Troli)`,
        });
      } else if (tipeAction === "OUT") {
        const targetCust =
          overrideCust && overrideCust !== "-" ? overrideCust : item.Customer;
        await sendToBackend("apiSaveTransaksiKeluar", {
          partNumber: item.Part_Number,
          qty: qty,
          petugas: currentUser.username,
          customer: targetCust,
          catatan: `Kirim ke: ${targetCust}`,
        });
      } else if (tipeAction === "ASSY_ADD") {
        await sendToBackend("apiUpdateAssyFsg", {
          partNumber: item.Part_Number,
          qty: qty,
          mode: "ADD",
          petugas: currentUser.username,
        });
      }
    }
    batchTrolley = [];
    updateBatchTrolleyUI();
    Swal.close();
    showToast(
      "success",
      "Troli Tersimpan!",
      "Semua transaksi berhasil dicatat.",
    );
    refreshAllData();
  } catch (err) {
    Swal.close();
    showToast("error", "Gagal Memproses", err.message);
  }
  isProcessing = false;
}

function startSmartScanner() {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  document.getElementById("smartReaderWrapper").classList.remove("hidden");
  document.getElementById("btnStartScan").classList.add("hidden");
  document.getElementById("btnStopScan").classList.remove("hidden");

  if (!codeReader) {
    codeReader = new ZXing.BrowserMultiFormatReader();
  }

  isCameraPaused = false;

  codeReader
    .decodeFromVideoDevice(null, "smartReaderVideo", (result, err) => {
      if (result && !isCameraPaused) {
        new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3")
          .play()
          .catch(() => {});
        processSmartScanCamera(result.getText());
      }
    })
    .catch((err) => {
      console.error(err);
    });
}

function stopSmartScanner() {
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  document.getElementById("smartReaderWrapper").classList.add("hidden");
  document.getElementById("btnStartScan").classList.remove("hidden");
  document.getElementById("btnStopScan").classList.add("hidden");
}

function populateCustomerDropdown(selectEl, selectedVal = "-") {
  if (!selectEl) return;
  const isBatch = selectEl.id === "batchSelectCustomer";
  let html = `<option value="-">${isBatch ? "-- Sesuai Default Barang --" : "-- Pilih Customer --"}</option>`;
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
  if (activeScannedPart) {
    const matchingRow = appData.seatAssyControl.find(
      (item) =>
        item.Part_Number.toLowerCase() ===
          activeScannedPart.Part_Number.toLowerCase() &&
        item.Customer.toLowerCase() === String(val).toLowerCase(),
    );
    if (matchingRow) {
      activeScannedPart = matchingRow;
      document.getElementById("smInfoTarget").innerText = matchingRow.sisa_del;
    } else {
      document.getElementById("smInfoTarget").innerText = 0;
    }
  }
}

function processSmartScanCamera(scannedCode) {
  if (isCameraPaused) return;

  const code = scannedCode.trim();
  const parsed = parseYimmBarcode(code);

  const matchingRows = appData.seatAssyControl.filter(
    (item) =>
      item.Part_Number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ===
        parsed.partNumberClean ||
      item.Part_Number.toLowerCase() === code.toLowerCase(),
  );

  if (matchingRows.length === 0) {
    showToast("error", "Tidak Dikenali", `Part tidak terdaftar di sistem.`);
    isCameraPaused = true;
    setTimeout(() => {
      isCameraPaused = false;
    }, 2000);
    return;
  }

  isCameraPaused = true;
  const foundData = matchingRows.find((r) => r.sisa_del > 0) || matchingRows[0];
  activeScannedPart = foundData;

  const custDisplay =
    foundData.Customer &&
    foundData.Customer !== "-" &&
    foundData.Customer !== "undefined"
      ? foundData.Customer
      : "-";
  populateCustomerDropdown(
    document.getElementById("smSelectCustomer"),
    custDisplay,
  );

  document.getElementById("smInfoCustomer").innerText =
    "TUJUAN: " + custDisplay;
  document.getElementById("smInfoRell").innerText = foundData.No_Rel;
  document.getElementById("smInfoPart").innerText = foundData.Part_Number;
  document.getElementById("smInfoNama").innerText = foundData.nama_barang;
  document.getElementById("smInfoStok").innerText = foundData.stock;
  document.getElementById("smInfoTarget").innerText = foundData.sisa_del;
  document.getElementById("smInfoAssy").innerText = foundData.assy_fsg;

  document.getElementById("smInputQty").value = parsed.qty;

  const btnWH = document.getElementById("btnGroupWH"),
    btnAssy = document.getElementById("btnGroupAssy"),
    wrapCust = document.getElementById("wrapperSelectCustomer");
  if (currentUser.role === "Admin") {
    btnWH.classList.remove("hidden");
    btnAssy.classList.remove("hidden");
    wrapCust.classList.remove("hidden");
  } else if (currentUser.role === "Produksi") {
    btnWH.classList.add("hidden");
    btnAssy.classList.remove("hidden");
    wrapCust.classList.add("hidden");
  } else {
    btnWH.classList.remove("hidden");
    btnAssy.classList.add("hidden");
    wrapCust.classList.remove("hidden");
  }

  document.getElementById("modalSmartAction").classList.remove("hidden");
}

function closeSmartAction() {
  document.getElementById("modalSmartAction").classList.add("hidden");
  activeScannedPart = null;
  setTimeout(() => {
    isCameraPaused = false;
  }, 1000);
}

function adjSmartQty(amt) {
  const input = document.getElementById("smInputQty");
  input.value = Math.max(1, (parseInt(input.value) || 0) + amt);
}

function submitSmartAction(tipeAction) {
  if (!activeScannedPart || !currentUser) return;
  const qty = parseInt(document.getElementById("smInputQty").value) || 0;
  if (qty <= 0) return showToast("error", "Error", "Jumlah harus > 0");

  isProcessing = true;
  if (tipeAction === "OUT") {
    const selectedCustomer =
      document.getElementById("smSelectCustomer")?.value ||
      activeScannedPart.Customer;
    if (!selectedCustomer || selectedCustomer === "-") {
      isProcessing = false;
      return showToast(
        "warning",
        "Pilih Customer!",
        "Pilih tujuan pengiriman terlebih dahulu.",
      );
    }
    swalUI.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiSaveTransaksiKeluar", {
      partNumber: activeScannedPart.Part_Number,
      qty,
      petugas: currentUser.username,
      customer: selectedCustomer,
      catatan: `Kirim ke: ${selectedCustomer}`,
    }).then((res) => {
      isProcessing = false;
      Swal.close();
      if (res.success) {
        closeSmartAction();
        refreshAllData();
        showToast("success", "Berhasil Keluar!");
      } else showToast("error", "Gagal", res.message);
    });
  } else if (tipeAction === "IN") {
    swalUI.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiSaveTransaksiMasuk", {
      partNumber: activeScannedPart.Part_Number,
      qty,
      petugas: currentUser.username,
      catatan: "Scan Kamera Masuk",
    }).then((res) => {
      isProcessing = false;
      Swal.close();
      if (res.success) {
        closeSmartAction();
        refreshAllData();
        showToast("success", "Berhasil Masuk!");
      } else showToast("error", "Gagal", res.message);
    });
  } else if (tipeAction === "ASSY_ADD") {
    swalUI.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiUpdateAssyFsg", {
      partNumber: activeScannedPart.Part_Number,
      qty: qty,
      mode: "ADD",
      petugas: currentUser.username,
    }).then((res) => {
      isProcessing = false;
      Swal.close();
      if (res.success) {
        closeSmartAction();
        refreshAllData();
        showToast("success", "Assy Ditambahkan!");
      } else showToast("error", "Gagal", res.message);
    });
  } else if (tipeAction === "ASSY_SET") {
    swalUI.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiUpdateAssyFsg", {
      partNumber: activeScannedPart.Part_Number,
      qty: qty,
      mode: "SET",
      petugas: currentUser.username,
    }).then((res) => {
      isProcessing = false;
      Swal.close();
      if (res.success) {
        closeSmartAction();
        refreshAllData();
        showToast("success", "Total Assy Disetel!");
      } else showToast("error", "Gagal", res.message);
    });
  }
}

function renderMasterBarangTable(keyword = "") {
  const tbody = document.getElementById("tblMasterBarangBody");
  if (!tbody) return;

  let dataset = appData.barang || [];
  if (keyword) {
    const kw = keyword.toLowerCase();
    dataset = dataset.filter(
      (b) =>
        String(b.Part_Number).toLowerCase().includes(kw) ||
        String(b.nama_barang).toLowerCase().includes(kw),
    );
  }

  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-gray-400" id="txtMemuatMaster">${currentLang === "zh" ? "找不到任何物品。" : "Tidak ada barang ditemukan."}</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map((b) => {
      const isChecked = selectedForDelete.includes(String(b.Part_Number))
        ? "checked"
        : "";
      const namaBarang =
        b.nama_barang === null ||
        b.nama_barang === undefined ||
        String(b.nama_barang).toUpperCase() === "NULL"
          ? "-"
          : b.nama_barang;
      const stokValue =
        b.stok === null ||
        b.stok === undefined ||
        String(b.stok).toLowerCase() === "null"
          ? 0
          : b.stok;
      const noRel =
        b.No_Rel === null ||
        b.No_Rel === undefined ||
        String(b.No_Rel).toLowerCase() === "null"
          ? "-"
          : b.No_Rel;
      const satuan =
        b.satuan === null ||
        b.satuan === undefined ||
        String(b.satuan).toLowerCase() === "null"
          ? "Pcs"
          : b.satuan;

      return `
    <tr class="hover:bg-black/5 transition-colors bg-white/40">
      <td class="text-center"><input type="checkbox" class="chk-barang w-4 h-4 rounded text-blue-500 border-gray-300 focus:ring-blue-500 cursor-pointer" value="${b.Part_Number}" ${isChecked} onchange="toggleSingleBarang(this)"></td>
      <td class="font-bold text-gray-900">${b.Part_Number}</td>
      <td class="text-left font-medium text-gray-600 uppercase">${namaBarang}</td>
      <td class="font-bold text-blue-600">${stokValue} <span class="text-[10px] text-gray-400 font-medium">${satuan}</span></td>
      <td><span class="px-2.5 py-1 rounded-full bg-black/5 text-gray-700 font-medium text-xs">${noRel}</span></td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editBarang('${b.Part_Number}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-blue-500 flex items-center justify-center" title="Edit Barang"><i class="fa-solid fa-pen text-xs"></i></button>
           <button onclick="printBarcode('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-gray-900 flex items-center justify-center" title="Cetak Barcode"><i class="fa-solid fa-print text-xs"></i></button>
           <button onclick="deleteBarang('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-red-500 flex items-center justify-center" title="Hapus Barang"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </td>
    </tr>`;
    })
    .join("");

  const chkAll = document.getElementById("chkAllBarang");
  if (chkAll) {
    const allDisplayedParts = dataset.map((b) => String(b.Part_Number));
    const allChecked =
      allDisplayedParts.length > 0 &&
      allDisplayedParts.every((p) => selectedForDelete.includes(p));
    chkAll.checked = allChecked;
  }

  updateBulkDeleteUI();
}

function toggleSingleBarang(el) {
  const val = String(el.value);
  if (el.checked) {
    if (!selectedForDelete.includes(val)) selectedForDelete.push(val);
  } else {
    selectedForDelete = selectedForDelete.filter((p) => p !== val);
  }
  updateBulkDeleteUI();
}

function toggleAllBarang(el) {
  const checkboxes = document.querySelectorAll(".chk-barang");
  checkboxes.forEach((chk) => {
    chk.checked = el.checked;
    const val = String(chk.value);
    if (el.checked) {
      if (!selectedForDelete.includes(val)) selectedForDelete.push(val);
    } else {
      selectedForDelete = selectedForDelete.filter((p) => p !== val);
    }
  });
  updateBulkDeleteUI();
}

function updateBulkDeleteUI() {
  const btnBulk = document.getElementById("btnBulkDeleteBarang");
  const lblCount = document.getElementById("lblCountDelete");

  if (selectedForDelete.length > 0) {
    btnBulk.classList.remove("hidden");
    btnBulk.classList.add("flex");
    lblCount.innerText = selectedForDelete.length;
  } else {
    btnBulk.classList.add("hidden");
    btnBulk.classList.remove("flex");
    lblCount.innerText = "0";
  }
}

function bulkDeleteBarang() {
  if (selectedForDelete.length === 0) return;

  swalUI
    .fire({
      title: currentLang === "zh" ? "批量删除？" : "Hapus Massal?",
      html:
        currentLang === "zh"
          ? `永久删除选定的 <b class="text-red-600">${selectedForDelete.length}</b> 个零件。`
          : `Menghapus permanen <b class="text-red-600">${selectedForDelete.length}</b> part terpilih dari database.`,
      showCancelButton: true,
      confirmButtonText: currentLang === "zh" ? "是的，删除" : "Ya, Hapus",
      cancelButtonText: currentLang === "zh" ? "取消" : "Batal",
    })
    .then((result) => {
      if (result.isConfirmed) {
        isProcessing = true;
        swalUI.fire({
          title: currentLang === "zh" ? "删除中..." : "Menghapus...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiBulkDeleteBarang", {
          partNumbers: selectedForDelete,
        }).then((res) => {
          isProcessing = false;
          Swal.close();
          if (res.success) {
            showToast("success", "Berhasil Dihapus!");
            selectedForDelete = [];
            document.getElementById("searchMasterBarang").value = "";
            refreshAllData();
          } else {
            showToast("error", "Gagal", res.message);
          }
        });
      }
    });
}

function printBarcode(partNumber, namaBarang) {
  const canvas = document.getElementById("hiddenBarcodeCanvas");
  JsBarcode(canvas, String(partNumber).trim(), {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: true,
  });
  const printWindow = window.open("", "_blank", "width=400,height=400");
  printWindow.document.write(
    `<html><body style="text-align:center;font-family:sans-serif;padding-top:10px;"><b>${namaBarang}</b><br><img src="${canvas.toDataURL()}"></body></html>`,
  );
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

function renderCustomerTable(keyword = "") {
  const tbody = document.getElementById("tblCustomerBody");
  if (!tbody) return;

  let dataset = appData.customer || [];
  if (keyword) {
    const kw = keyword.toLowerCase();
    dataset = dataset.filter(
      (c) =>
        String(c.id_customer).toLowerCase().includes(kw) ||
        String(c.nama_customer).toLowerCase().includes(kw),
    );
  }

  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-gray-400">${currentLang === "zh" ? "找不到任何客户。" : "Tidak ada customer."}</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map(
      (c) => `
    <tr class="hover:bg-black/5 transition-colors bg-white/40">
      <td class="font-bold text-gray-900">${c.id_customer}</td>
      <td class="text-left font-medium text-gray-700">${c.nama_customer}</td>
      <td class="text-left text-gray-500">${c.alamat || "-"}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editCustomer('${c.id_customer}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-blue-500 flex items-center justify-center"><i class="fa-solid fa-pen text-xs"></i></button>
           <button onclick="deleteCustomer('${c.id_customer}', '${c.nama_customer}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-red-500 flex items-center justify-center"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

function renderUsersTable(keyword = "") {
  const tbody = document.getElementById("tblUsersBody");
  if (!tbody) return;

  let usersList = (appData.users || []).filter(
    (u) => u.username !== "__SYSTEM_ROLLOVER__",
  );
  if (keyword) {
    const kw = keyword.toLowerCase();
    usersList = usersList.filter(
      (u) =>
        String(u.username).toLowerCase().includes(kw) ||
        String(u.role).toLowerCase().includes(kw),
    );
  }

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="py-12 text-center text-gray-400">${currentLang === "zh" ? "找不到任何用户。" : "Tidak ada pengguna."}</td></tr>`;
    return;
  }

  tbody.innerHTML = usersList
    .map((u) => {
      let roleBadge = `<span class="px-3 py-1 rounded-full bg-black/5 text-gray-700 font-medium text-[10px] uppercase tracking-widest">${u.role}</span>`;
      if (u.role === "Admin")
        roleBadge = `<span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 font-medium text-[10px] uppercase tracking-widest">${u.role}</span>`;
      if (u.role === "Produksi")
        roleBadge = `<span class="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 font-medium text-[10px] uppercase tracking-widest">${u.role}</span>`;

      return `
    <tr class="hover:bg-black/5 transition-colors bg-white/40">
      <td class="font-bold text-gray-900">${u.username}</td>
      <td>${roleBadge}</td>
      <td class="text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editUser('${u.username}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-blue-500 flex items-center justify-center"><i class="fa-solid fa-pen text-xs"></i></button>
           <button onclick="deleteUser('${u.username}')" class="w-8 h-8 rounded-full glass-btn text-gray-500 hover:text-red-500 flex items-center justify-center"><i class="fa-solid fa-trash-can text-xs"></i></button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function handleLoginSubmit(e) {
  e.preventDefault();
  swalUI.fire({
    title: currentLang === "zh" ? "验证中..." : "Otentikasi...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  sendToBackend("apiLogin", {
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim(),
  })
    .then((res) => {
      Swal.close();
      if (res.success) {
        currentUser = res.user;
        sessionStorage.setItem(
          "sim_inventory_user",
          JSON.stringify(currentUser),
        );
        applyRbacUI();
        closeLoginModal();
        switchTab("scanner");
        showToast(
          "success",
          currentLang === "zh"
            ? `工作愉快, ${currentUser.username}`
            : `Selamat bekerja, ${currentUser.username}`,
        );
      } else {
        showToast(
          "error",
          currentLang === "zh" ? "拒绝访问" : "Gagal Login",
          res.message,
        );
      }
    })
    .catch((err) => {
      Swal.close();
      showToast("error", "Sistem Error", err.message);
    });
}

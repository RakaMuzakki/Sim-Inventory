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

// VARIABEL KERANJANG BATCH TROLLEY (KHUSUS SCANNER GUN)
let batchTrolley = [];

let chartFastMoving = null;
let chartStock = null;

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

window.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  const savedUser = sessionStorage.getItem("sim_inventory_user");
  if (savedUser) currentUser = JSON.parse(savedUser);
  applyRbacUI();
  loadInitialOrMockData();

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

async function checkAndRunDailyRollover() {
  if (isProcessing || !appData.barang || appData.barang.length === 0) return;
  const { opKey } = getOperationalDayInfo();
  const markerUser = (appData.users || []).find(
    (u) => u.username === "__SYSTEM_ROLLOVER__",
  );

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

  if (markerUser.password !== opKey) {
    isProcessing = true;
    try {
      await _supabase
        .from("Users")
        .update({ password: opKey })
        .eq("username", "__SYSTEM_ROLLOVER__");
      markerUser.password = opKey;
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
      }
    } catch (e) {
      console.error("Rollover error:", e);
    }
    isProcessing = false;
  }
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
        if (resB.error) throw new Error(resB.error.message);
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
        const { data: cekUsers } = await _supabase.from("Users").select("*");
        const realUsers = (cekUsers || []).filter(
          (u) => u.username !== "__SYSTEM_ROLLOVER__",
        );
        if (realUsers.length === 0 && payload.username === "admin") {
          await _supabase
            .from("Users")
            .insert([{ username: "admin", password: "admin", role: "Admin" }]);
          return { success: true, user: { username: "admin", role: "Admin" } };
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

      case "apiSaveTransaksiKeluar":
        if (payload.customer && payload.customer !== "-") {
          const { data: checkOrd } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.partNumber);
          const existingSameCust = (checkOrd || []).find(
            (o) =>
              resolveCustomerDisplay(o.id_customer).toLowerCase() ===
              resolveCustomerDisplay(payload.customer).toLowerCase(),
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
                .update({ id_customer: payload.customer })
                .eq("id", emptySlot.id);
            } else if (!checkOrd || checkOrd.length === 0) {
              await _supabase
                .from("List_Order")
                .insert([
                  {
                    Part_Number: payload.partNumber,
                    qty_order: 0,
                    id_customer: payload.customer,
                  },
                ]);
            }
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

      case "apiSaveTransaksiMasuk":
        const { data: bIn, error: errBIn } = await _supabase
          .from("Master_Barang")
          .select("stok")
          .eq("Part_Number", payload.partNumber)
          .single();
        if (errBIn) throw new Error(errBIn.message);
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
          const targetRow =
            checkO.find(
              (o) => resolveCustomerDisplay(o.id_customer) === payload.customer,
            ) || checkO[0];
          if (targetRow.id !== undefined) {
            await _supabase
              .from("List_Order")
              .update({ qty_order: payload.qty })
              .eq("id", targetRow.id);
          } else {
            await _supabase
              .from("List_Order")
              .update({ qty_order: payload.qty })
              .eq("Part_Number", payload.partNumber);
          }
        } else {
          await _supabase
            .from("List_Order")
            .insert([
              {
                Part_Number: payload.partNumber,
                qty_order: payload.qty,
                id_customer:
                  payload.customer && payload.customer !== "-"
                    ? payload.customer
                    : null,
              },
            ]);
        }
        return { success: true };

      case "apiUpdateCustomerPart":
        const { data: checkOCust } = await _supabase
          .from("List_Order")
          .select("*")
          .eq("Part_Number", payload.partNumber);
        if (payload.mode === "ADD_NEW") {
          await _supabase
            .from("List_Order")
            .insert([
              {
                Part_Number: payload.partNumber,
                qty_order: Number(payload.qtyOrder) || 0,
                id_customer: payload.customer,
              },
            ]);
          return { success: true };
        }
        if (payload.mode === "DELETE_ROW") {
          const rowToDelete = (checkOCust || []).find(
            (o) =>
              resolveCustomerDisplay(o.id_customer) === payload.oldCustomer,
          );
          if (rowToDelete && rowToDelete.id !== undefined) {
            await _supabase
              .from("List_Order")
              .delete()
              .eq("id", rowToDelete.id);
          }
          return { success: true };
        }
        if (checkOCust && checkOCust.length > 0) {
          const targetRow =
            checkOCust.find(
              (o) =>
                resolveCustomerDisplay(o.id_customer) === payload.oldCustomer,
            ) || checkOCust[0];
          if (targetRow.id !== undefined) {
            await _supabase
              .from("List_Order")
              .update({ id_customer: payload.customer })
              .eq("id", targetRow.id);
          } else {
            await _supabase
              .from("List_Order")
              .update({ id_customer: payload.customer })
              .eq("Part_Number", payload.partNumber);
          }
        } else {
          await _supabase
            .from("List_Order")
            .insert([
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
          await _supabase
            .from("Master_Barang")
            .update(payload.item)
            .eq("Part_Number", payload.item.Part_Number);
        } else {
          await _supabase.from("Master_Barang").insert([payload.item]);
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
          if (!checkOrdB || checkOrdB.length === 0) {
            await _supabase
              .from("List_Order")
              .insert([
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
    populateCustomerDropdown(
      document.getElementById("batchSelectCustomer"),
      "-",
    );
    updateBatchTrolleyUI();
    setTimeout(() => document.getElementById("manualSmartInput")?.focus(), 100);
  }
}

function applyRbacUI() {
  const pCard = document.getElementById("userProfileCard"),
    gPrompt = document.getElementById("guestLoginPrompt");
  document
    .querySelectorAll(".role-admin, .role-auth")
    .forEach((el) => el.classList.add("hidden"));

  const bWH = document.getElementById("batchBtnGroupWH");
  const bAssy = document.getElementById("batchBtnGroupAssy");
  const bCust = document.getElementById("batchCustWrapper");

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
  }
}

// =========================================================================
// DASHBOARD & PAPAN KONTROL
// =========================================================================
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
  renderSeatAssyControlBoard(
    document.getElementById("globalSearchInput")?.value || "",
  );
  renderRiwayatTable();
  renderMasterBarangTable();
  renderCustomerTable();
  renderUsersTable();
  populateCustomerDropdown(
    document.getElementById("batchSelectCustomer"),
    document.getElementById("batchSelectCustomer")?.value || "-",
  );
  if (!document.getElementById("tab-analitik").classList.contains("hidden"))
    renderAnalitikCharts();
}

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
    const totalQtyDayPart = relatedOrders.reduce(
      (sum, o) => sum + (Number(o.qty_order) || 0),
      0,
    );
    const totalQtyOutPart = partOutLogs.reduce(
      (sum, k) => sum + (Number(k.qty) || 0),
      0,
    );
    const variancePart = currentStock + assyFsg - totalQtyDayPart;

    if (relatedOrders.length <= 1) {
      let custRaw = "-";
      if (
        relatedOrders.length === 1 &&
        relatedOrders[0].id_customer &&
        String(relatedOrders[0].id_customer) !== "undefined"
      ) {
        custRaw = relatedOrders[0].id_customer;
      } else if (
        itemBarang.id_customer &&
        String(itemBarang.id_customer) !== "undefined"
      ) {
        custRaw = itemBarang.id_customer;
      } else if (localStorage.getItem("cust_map_" + partNum)) {
        custRaw = localStorage.getItem("cust_map_" + partNum);
      }

      const custDisplay = resolveCustomerDisplay(custRaw);
      const qtyDay =
        relatedOrders.length === 1
          ? Number(relatedOrders[0].qty_order) || 0
          : 0;
      list.push({
        Customer: custDisplay,
        CustomerCount: 1,
        No_Rel: itemBarang.No_Rel || "-",
        Part_Number: partNum,
        nama_barang: itemBarang.nama_barang || "-",
        stock: currentStock,
        qty_day: qtyDay,
        qty_out: totalQtyOutPart,
        sisa_del: Math.max(0, qtyDay - totalQtyOutPart),
        assy_fsg: assyFsg,
        variance: variancePart,
      });
    } else {
      relatedOrders.forEach((ord) => {
        const custDisplay = resolveCustomerDisplay(ord.id_customer);
        const qtyDayCust = Number(ord.qty_order) || 0;
        const qtyOutCust = partOutLogs
          .filter(
            (k) =>
              k.catatan &&
              k.catatan.toLowerCase().includes(custDisplay.toLowerCase()),
          )
          .reduce((sum, k) => sum + (Number(k.qty) || 0), 0);
        list.push({
          Customer: custDisplay,
          CustomerCount: relatedOrders.length,
          No_Rel: itemBarang.No_Rel || "-",
          Part_Number: partNum,
          nama_barang: itemBarang.nama_barang || "-",
          stock: currentStock,
          qty_day: qtyDayCust,
          qty_out: qtyOutCust,
          sisa_del: Math.max(0, qtyDayCust - qtyOutCust),
          assy_fsg: assyFsg,
          variance: variancePart,
        });
      });
    }
  });
  appData.seatAssyControl = list;
}

function promptUpdateCustomerPart(partNumber, currentCust, custCount = 1) {
  if (isProcessing) return;
  if (!appData.customer || appData.customer.length === 0) {
    return Swal.fire(
      "Info",
      "Tambahkan data di menu Master Customer terlebih dahulu!",
      "info",
    );
  }

  let optionsHtml = `<option value="-">-- Tidak Ada / Kosongkan --</option>`;
  appData.customer.forEach((c) => {
    const val = c.nama_customer || c.id_customer;
    const label = c.nama_customer
      ? `${c.nama_customer} (${c.id_customer})`
      : c.id_customer;
    const sel =
      String(val).toLowerCase() === String(currentCust).toLowerCase()
        ? "selected"
        : "";
    optionsHtml += `<option value="${val}" ${sel}>${label}</option>`;
  });

  Swal.fire({
    title: "ATUR CUSTOMER TUJUAN",
    html: `
      <div class="text-left space-y-3">
        <p class="text-xs text-slate-600">Part Number: <b class="text-slate-900">${partNumber}</b></p>
        <div>
          <label class="block text-[10px] font-black uppercase mb-1">Pilih Perusahaan Customer:</label>
          <select id="swalSelectCust" class="w-full bg-slate-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold">${optionsHtml}</select>
        </div>
        <div>
          <label class="block text-[10px] font-black uppercase mb-1">Mode Pengaturan:</label>
          <select id="swalModeCust" onchange="document.getElementById('swalWrapQtyBaru').classList.toggle('hidden', this.value !== 'ADD_NEW')" class="w-full bg-yellow-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold">
            <option value="UPDATE">Ubah Customer pada Baris Ini</option>
            <option value="ADD_NEW">+ Tambah Customer Baru (2 Customer Beli Barang Sama)</option>
            ${custCount > 1 ? `<option value="DELETE_ROW">Hapus Baris Customer (${currentCust}) Ini</option>` : ""}
          </select>
        </div>
        <div id="swalWrapQtyBaru" class="hidden">
          <label class="block text-[10px] font-black uppercase mb-1">Target QTY/DAY Customer Baru:</label>
          <input type="number" id="swalQtyOrderBaru" value="100" min="0" class="w-full bg-slate-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold" />
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    confirmButtonColor: "#2563eb",
    preConfirm: () => ({
      customer: document.getElementById("swalSelectCust").value,
      mode: document.getElementById("swalModeCust").value,
      qtyOrder: document.getElementById("swalQtyOrderBaru").value,
    }),
  }).then((result) => {
    if (result.isConfirmed) {
      const { customer, mode, qtyOrder } = result.value;
      if (mode === "ADD_NEW" && (!customer || customer === "-")) {
        return Swal.fire(
          "Pilih Customer",
          "Pilih nama Customer baru yang ingin ditambahkan!",
          "warning",
        );
      }
      isProcessing = true;
      Swal.fire({
        title: "Menyimpan...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      sendToBackend("apiUpdateCustomerPart", {
        partNumber,
        oldCustomer: currentCust,
        customer,
        mode,
        qtyOrder,
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
    showCancelButton: true,
    confirmButtonText: "Simpan",
    confirmButtonColor: "#9333ea",
  }).then((result) => {
    if (result.isConfirmed) {
      sendToBackend("apiUpdateAssyFsg", {
        partNumber,
        qty: Number(result.value) || 0,
      }).then(() => refreshAllData());
    }
  });
}

function promptUpdateQtyDay(partNumber, currentQty, customerName = "-") {
  if (isProcessing) return;
  Swal.fire({
    title: "SET TARGET (QTY/DAY)",
    html: `<p class="text-sm mb-3">Target Harian untuk Part:<br><b class="text-lg">${partNumber}</b><br><span class="text-xs text-slate-500">Customer: ${customerName}</span></p>`,
    input: "number",
    inputValue: currentQty > 0 ? currentQty : "",
    showCancelButton: true,
    confirmButtonText: "Simpan",
    confirmButtonColor: "#10b981",
  }).then((result) => {
    if (result.isConfirmed) {
      sendToBackend("apiUpdateQtyDay", {
        partNumber,
        qty: Number(result.value) || 0,
        customer: customerName,
      }).then(() => refreshAllData());
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
      let varFormat =
        row.variance > 0
          ? "+" + row.variance
          : row.variance < 0
            ? row.variance
            : "-";
      let varColor =
        row.variance > 0
          ? "text-emerald-600"
          : row.variance < 0
            ? "text-red-600"
            : "text-slate-700";

      const custClass = canEditCust
        ? "cursor-pointer hover:bg-blue-100 hover:text-blue-800 underline decoration-dashed underline-offset-4"
        : "";
      const custAction = canEditCust
        ? `onclick="promptUpdateCustomerPart('${row.Part_Number}', '${row.Customer}', ${row.CustomerCount || 1})"`
        : "";

      const qtyDayClass = isAdmin
        ? "cursor-pointer hover:bg-yellow-300 hover:text-blue-800 underline decoration-dashed underline-offset-4"
        : "";
      const qtyDayAction = isAdmin
        ? `onclick="promptUpdateQtyDay('${row.Part_Number}', ${row.qty_day}, '${row.Customer}')"`
        : "";

      const assyClass = canEditAssy
        ? "cursor-pointer hover:bg-purple-200 hover:text-purple-900 underline decoration-dashed underline-offset-4"
        : "";
      const assyAction = canEditAssy
        ? `onclick="promptUpdateAssyFsg('${row.Part_Number}', ${row.assy_fsg})"`
        : "";

      return `<tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-black text-slate-700 break-words ${custClass}" ${custAction}>${row.Customer}</td>
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

function handleGlobalSearch(kw) {
  renderSeatAssyControlBoard(kw);
}

// =========================================================================
// KHUSUS SCANNER GUN: MODE KERANJANG BATCH TROLI (SCAN BANYAK DULU, INPUT QTY NANTI)
// =========================================================================
function triggerManualGunButton() {
  handleScannerGun({ key: "Enter", preventDefault: () => {} });
}

function handleScannerGun(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const inputField = document.getElementById("manualSmartInput");
    const code = inputField.value.trim();
    if (!code) return;

    const matchingRows = appData.seatAssyControl.filter(
      (item) => item.Part_Number.toLowerCase() === code.toLowerCase(),
    );
    if (matchingRows.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Tidak Dikenali!",
        text: `Part ${code} tidak terdaftar.`,
        timer: 1500,
        showConfirmButton: false,
      });
      inputField.value = "";
      return;
    }

    const foundData =
      matchingRows.find((r) => r.sisa_del > 0) || matchingRows[0];
    addToBatchTrolley(foundData);
    inputField.value = "";
    inputField.focus();
  }
}

function addToBatchTrolley(item) {
  const existing = batchTrolley.find((b) => b.Part_Number === item.Part_Number);
  if (existing) {
    existing.trolleyCount += 1;
  } else {
    batchTrolley.push({
      Part_Number: item.Part_Number,
      nama_barang: item.nama_barang,
      No_Rel: item.No_Rel,
      Customer: item.Customer,
      stock: item.stock,
      assy_fsg: item.assy_fsg,
      trolleyCount: 1,
      qtyInput: 1,
    });
  }
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
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 font-bold text-xs border-2 border-dashed border-slate-300 rounded">
        Belum ada barang yang ditembak dengan Scanner Gun.
      </div>`;
    return;
  }

  container.innerHTML = batchTrolley
    .map(
      (b, idx) => `
    <div class="flex items-center justify-between p-2.5 bg-yellow-50 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)]">
      <div class="text-left pr-2">
        <div class="flex items-center gap-1.5">
          <span class="px-1.5 py-0.5 bg-slate-800 text-yellow-300 font-black text-[9px] rounded">${b.No_Rel}</span>
          <span class="font-black text-xs text-slate-900">${b.Part_Number}</span>
        </div>
        <div class="text-[10px] font-bold text-slate-500 uppercase mt-0.5">${b.nama_barang}</div>
        <div class="text-[10px] font-black text-blue-700 mt-0.5">Ditembak: ${b.trolleyCount}x Troli</div>
      </div>
      <div class="flex items-center gap-2">
        <div>
          <label class="block text-[8px] font-black uppercase text-slate-500 text-center">Total Qty (Pcs)</label>
          <input type="number" min="1" value="${b.qtyInput}" oninput="batchTrolley[${idx}].qtyInput = Number(this.value)" class="w-20 bg-white border-2 border-slate-800 px-2 py-1 text-center font-black text-sm rounded focus:bg-yellow-100" />
        </div>
        <button onclick="batchTrolley.splice(${idx}, 1); updateBatchTrolleyUI();" class="w-7 h-7 bg-red-400 hover:bg-red-500 border-2 border-slate-800 rounded font-black text-xs flex items-center justify-center">✕</button>
      </div>
    </div>
  `,
    )
    .join("");
}

async function submitBatchTrolley(tipeAction) {
  if (!currentUser) return openLoginModal();
  if (batchTrolley.length === 0)
    return Swal.fire(
      "Troli Kosong!",
      "Silakan scan barang dengan Scanner Gun terlebih dahulu.",
      "warning",
    );
  if (isProcessing) return;

  const invalidQty = batchTrolley.find(
    (b) => !b.qtyInput || Number(b.qtyInput) <= 0,
  );
  if (invalidQty)
    return Swal.fire(
      "Qty Tidak Valid",
      `Masukkan jumlah Qty lebih dari 0 untuk Part ${invalidQty.Part_Number}`,
      "warning",
    );

  const overrideCust =
    document.getElementById("batchSelectCustomer")?.value || "-";

  if (tipeAction === "OUT") {
    for (const item of batchTrolley) {
      const targetCust =
        overrideCust && overrideCust !== "-" ? overrideCust : item.Customer;
      if (!targetCust || targetCust === "-") {
        return Swal.fire(
          "Pilih Customer!",
          `Pilih Customer Tujuan untuk pengiriman barang keluar!`,
          "warning",
        );
      }
    }
  }

  isProcessing = true;
  Swal.fire({
    title: "Memproses Semua Troli...",
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
          catatan: `Kirim ke: ${targetCust} (${item.trolleyCount} Troli)`,
        });
      } else if (tipeAction === "ASSY_ADD") {
        const currentBarang = appData.barang.find(
          (b) => String(b.Part_Number).trim() === item.Part_Number,
        );
        const curAssy = Number(currentBarang?.assy_fsg) || 0;
        await sendToBackend("apiUpdateAssyFsg", {
          partNumber: item.Part_Number,
          qty: curAssy + qty,
        });
      }
    }

    batchTrolley = [];
    updateBatchTrolleyUI();
    Swal.fire({
      icon: "success",
      title: "Semua Troli Tersimpan!",
      timer: 1200,
      showConfirmButton: false,
    });
    refreshAllData();
  } catch (err) {
    Swal.fire("Error", err.message, "error");
  }
  isProcessing = false;
}

// =========================================================================
// KAMERA HP TETAP SEPERTI BIASA (POPUP LANGSUNG SATUAN)
// =========================================================================
function startSmartScanner() {
  if (!currentUser) {
    openLoginModal();
    return;
  }
  document.getElementById("smartReaderWrapper").classList.remove("hidden");
  document.getElementById("btnStartScan").classList.add("hidden");
  document.getElementById("btnStopScan").classList.remove("hidden");

  smartScanner = new Html5Qrcode("smartReaderViewport");
  smartScanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3")
          .play()
          .catch(() => {});
        processSmartScanCamera(decodedText);
      },
      () => {},
    )
    .catch(() => stopSmartScanner());
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
    }
  }
}

function processSmartScanCamera(scannedCode) {
  const part = scannedCode.trim();
  const matchingRows = appData.seatAssyControl.filter(
    (item) => item.Part_Number.toLowerCase() === part.toLowerCase(),
  );
  if (matchingRows.length === 0) {
    Swal.fire({
      icon: "warning",
      title: "Tidak Dikenali!",
      text: `Part ${part} tidak terdaftar.`,
      timer: 2000,
      showConfirmButton: false,
    });
    return;
  }

  if (smartScanner) smartScanner.pause();
  const foundData = matchingRows.find((r) => r.sisa_del > 0) || matchingRows[0];
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
    "TUJUAN: " + custDisplay;
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
  if (smartScanner) smartScanner.resume();
}

function adjSmartQty(amt) {
  const input = document.getElementById("smInputQty");
  input.value = Math.max(1, (parseInt(input.value) || 0) + amt);
}

function submitSmartAction(tipeAction) {
  if (!activeScannedPart || !currentUser) return;
  const qty = parseInt(document.getElementById("smInputQty").value) || 0;
  if (qty <= 0) return Swal.fire("Error", "Jumlah harus > 0", "error");

  isProcessing = true;
  if (tipeAction === "OUT") {
    const selectedCustomer =
      document.getElementById("smSelectCustomer")?.value ||
      activeScannedPart.Customer;
    if (!selectedCustomer || selectedCustomer === "-") {
      isProcessing = false;
      return Swal.fire(
        "Pilih Customer!",
        "Pilih Customer tujuan terlebih dahulu.",
        "warning",
      );
    }
    Swal.fire({
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
    }).then(() => {
      isProcessing = false;
      closeSmartAction();
      refreshAllData();
      Swal.fire({
        icon: "success",
        title: "Berhasil Keluar!",
        timer: 800,
        showConfirmButton: false,
      });
    });
  } else if (tipeAction === "IN") {
    Swal.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiSaveTransaksiMasuk", {
      partNumber: activeScannedPart.Part_Number,
      qty,
      petugas: currentUser.username,
      catatan: "Scan Kamera Masuk",
    }).then(() => {
      isProcessing = false;
      closeSmartAction();
      refreshAllData();
      Swal.fire({
        icon: "success",
        title: "Berhasil Masuk!",
        timer: 800,
        showConfirmButton: false,
      });
    });
  } else {
    const finalQty =
      tipeAction === "ASSY_ADD" ? activeScannedPart.assy_fsg + qty : qty;
    Swal.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiUpdateAssyFsg", {
      partNumber: activeScannedPart.Part_Number,
      qty: finalQty,
    }).then(() => {
      isProcessing = false;
      closeSmartAction();
      refreshAllData();
      Swal.fire({
        icon: "success",
        title: "Assy Tersimpan!",
        timer: 800,
        showConfirmButton: false,
      });
    });
  }
}

// =========================================================================
// TABEL MASTER, RIWAYAT & GRAFIK
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
      (b) =>
        `<tr class="hover:bg-yellow-50"><td class="py-2 px-3 border-2 border-slate-800 font-black">${b.Part_Number}</td><td class="py-2 px-3 border-2 border-slate-800 text-left font-bold">${b.nama_barang}</td><td class="py-2 px-3 border-2 border-slate-800 font-black text-blue-700">${b.stok}</td><td class="py-2 px-3 border-2 border-slate-800 font-black text-yellow-600">${b.No_Rel || "-"}</td><td class="py-2 px-2 border-2 border-slate-800"><button onclick="printBarcode('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 flex items-center justify-center bg-slate-800 text-white rounded mx-auto"><i class="fa-solid fa-print"></i></button></td></tr>`,
    )
    .join("");
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

function renderCustomerTable() {
  const tbody = document.getElementById("tblCustomerBody");
  if (!tbody) return;
  tbody.innerHTML = appData.customer
    .map(
      (c) =>
        `<tr class="hover:bg-yellow-50"><td class="py-2 px-3 border-2 border-slate-800 font-black">${c.id_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left font-black">${c.nama_customer}</td><td class="py-2 px-3 border-2 border-slate-800 text-left">${c.alamat || "-"}</td></tr>`,
    )
    .join("");
}

function renderUsersTable() {
  const tbody = document.getElementById("tblUsersBody");
  if (!tbody) return;
  tbody.innerHTML = (appData.users || [])
    .filter((u) => u.username !== "__SYSTEM_ROLLOVER__")
    .map(
      (u) =>
        `<tr class="hover:bg-yellow-50"><td class="py-2 px-3 border-2 border-slate-800 font-black">${u.username}</td><td class="py-2 px-3 border-2 border-slate-800">${u.role}</td><td class="py-2 px-3 border-2 border-slate-800"><button onclick="sendToBackend('apiDeleteUser',{usernameTarget:'${u.username}'}).then(()=>refreshAllData())" class="bg-red-400 px-2 py-1 border-2 border-slate-800 rounded font-black text-xs">Hapus</button></td></tr>`,
    )
    .join("");
}

function renderRiwayatTable() {
  const tbody = document.getElementById("tblRiwayatBody");
  if (!tbody) return;
  const f = document.getElementById("filterRiwayat")?.value || "ALL";
  let logs = [];
  if (f === "ALL" || f === "IN")
    appData.masuk.forEach((m) =>
      logs.push({
        waktu: new Date(m.tanggal || m.created_at),
        tipe: "IN",
        part: m.Part_Number,
        qty: m.qty,
        petugas: m.petugas,
        catatan: m.catatan,
      }),
    );
  if (f === "ALL" || f === "OUT")
    appData.keluar.forEach((k) =>
      logs.push({
        waktu: new Date(k.tanggal || k.created_at),
        tipe: "OUT",
        part: k.Part_Number,
        qty: k.qty,
        petugas: k.petugas,
        catatan: k.catatan,
      }),
    );
  logs.sort((a, b) => b.waktu - a.waktu);
  tbody.innerHTML =
    logs.length === 0
      ? `<tr><td colspan="6" class="py-6 text-slate-400">Belum ada riwayat.</td></tr>`
      : logs
          .map(
            (r) =>
              `<tr class="hover:bg-yellow-50"><td class="py-2 px-2 border-2 border-slate-800 text-[10px] font-bold">${r.waktu.toLocaleString("id-ID")}</td><td class="py-2 px-2 border-2 border-slate-800 font-black">${r.tipe}</td><td class="py-2 px-3 border-2 border-slate-800 text-left font-black">${r.part}</td><td class="py-2 px-2 border-2 border-slate-800 font-black ${r.tipe === "IN" ? "text-emerald-600" : "text-red-600"}">${r.tipe === "IN" ? "+" : "-"}${r.qty}</td><td class="py-2 px-2 border-2 border-slate-800 text-[10px] font-bold uppercase">${r.petugas || "-"}</td><td class="py-2 px-3 border-2 border-slate-800 text-left text-[10px] font-bold">${r.catatan || "-"}</td></tr>`,
          )
          .join("");
}

function renderAnalitikCharts() {
  if (typeof Chart === "undefined") return;
  let mapOut = {};
  appData.keluar.forEach(
    (k) =>
      (mapOut[k.Part_Number] = (mapOut[k.Part_Number] || 0) + Number(k.qty)),
  );
  let top5 = Object.entries(mapOut)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (chartFastMoving) chartFastMoving.destroy();
  chartFastMoving = new Chart(
    document.getElementById("fastMovingChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: top5.length ? top5.map((x) => x[0]) : ["Belum ada data"],
        datasets: [
          {
            data: top5.length ? top5.map((x) => x[1]) : [0],
            backgroundColor: "#facc15",
            borderColor: "#1e293b",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
      },
    },
  );

  let lowStock = [...appData.barang]
    .sort((a, b) => Number(a.stok) - Number(b.stok))
    .slice(0, 10);
  if (chartStock) chartStock.destroy();
  chartStock = new Chart(
    document.getElementById("stockStatusChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: lowStock.length
          ? lowStock.map((x) => x.Part_Number)
          : ["Belum ada data"],
        datasets: [
          {
            label: "Stok",
            data: lowStock.length ? lowStock.map((x) => Number(x.stok)) : [0],
            backgroundColor: "#34d399",
            borderColor: "#1e293b",
            borderWidth: 2,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    },
  );
}

// =========================================================================
// MODALS & AUTH
// =========================================================================
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
  const selectedCust = document.getElementById("mbCustomer")?.value || "-";
  sendToBackend("apiSaveBarang", {
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
  }).then((res) => {
    if (res.success) {
      closeModalBarang();
      refreshAllData();
      Swal.fire("Berhasil", res.message, "success");
    } else Swal.fire("Gagal", res.message, "error");
  });
}

function handleSaveCustomer(e) {
  e.preventDefault();
  sendToBackend("apiSaveCustomer", {
    cust: {
      id_customer: document.getElementById("mcId").value.trim(),
      nama_customer: document.getElementById("mcNama").value.trim(),
      kontak: document.getElementById("mcKontak").value.trim(),
      alamat: document.getElementById("mcAlamat").value.trim(),
    },
  }).then(() => {
    closeModalCustomer();
    refreshAllData();
  });
}

function handleSaveUser(e) {
  e.preventDefault();
  sendToBackend("apiSaveUser", {
    userData: {
      username: document.getElementById("muUsername").value.trim(),
      password: document.getElementById("muPassword").value.trim(),
      role: document.getElementById("muRole").value,
    },
  }).then(() => {
    closeModalUser();
    refreshAllData();
  });
}

function openLoginModal() {
  document.getElementById("modalLogin").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("modalLogin").classList.add("hidden");
}
function logoutAction() {
  currentUser = null;
  sessionStorage.removeItem("sim_inventory_user");
  applyRbacUI();
  switchTab("overview");
}
function handleLoginSubmit(e) {
  e.preventDefault();
  sendToBackend("apiLogin", {
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim(),
  }).then((res) => {
    if (res.success) {
      currentUser = res.user;
      sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
      applyRbacUI();
      closeLoginModal();
      switchTab("scanner");
    } else Swal.fire("Gagal", res.message, "error");
  });
}

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
let activeScannedPart = null;
let isProcessing = false;

// VARIABEL KERANJANG BATCH TROLLEY
let batchTrolley = [];

// VARIABEL EDIT MASTER DATA
let currentEditPart = null;
let currentEditCustomer = null;
let currentEditUser = null;

// VARIABEL SCANNER ZXING
let codeReader = null;
let isCameraPaused = false; // Mencegah scan berulang saat popup terbuka

// Variabel Global Grafik Analitik
let chartFastMoving = null;
let chartStock = null;

// =========================================================================
// GAYA VISUAL (CUSTOM TOAST NOTIFICATION & NEO-BRUTALISM MODAL)
// =========================================================================
const style = document.createElement("style");
style.innerHTML = `
  @keyframes toastSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes toastSlideUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
  .animate-toast-in { animation: toastSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-toast-out { animation: toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;
document.head.appendChild(style);

function showToast(type, title, message = "") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className =
      "fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-[90%] max-w-sm";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  let bgColor = "bg-emerald-400";
  let icon = '<i class="fa-solid fa-circle-check text-xl"></i>';

  if (type === "error") {
    bgColor = "bg-red-400";
    icon = '<i class="fa-solid fa-triangle-exclamation text-xl"></i>';
  } else if (type === "warning") {
    bgColor = "bg-yellow-400";
    icon = '<i class="fa-solid fa-circle-exclamation text-xl"></i>';
  } else if (type === "info") {
    bgColor = "bg-blue-400";
    icon = '<i class="fa-solid fa-circle-info text-xl"></i>';
  }

  toast.className = `flex items-start gap-3 ${bgColor} border-4 border-slate-800 shadow-[4px_4px_0px_rgba(0,0,0,1)] p-3 rounded pointer-events-auto animate-toast-in`;
  toast.innerHTML = `
    <div class="text-slate-900 mt-0.5">${icon}</div>
    <div class="flex-1">
      <h4 class="font-black text-sm uppercase text-slate-900 leading-tight">${title}</h4>
      ${message ? `<p class="text-[10px] font-bold text-slate-800 mt-0.5 leading-tight">${message}</p>` : ""}
    </div>
    <button onclick="this.parentElement.classList.replace('animate-toast-in', 'animate-toast-out'); setTimeout(() => this.parentElement.remove(), 300)" class="text-slate-900 hover:text-white transition-colors">
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
  customClass: {
    popup:
      "border-4 border-slate-800 rounded shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-white",
    title: "font-black uppercase tracking-tighter text-slate-900 text-xl",
    htmlContainer: "font-bold text-xs text-slate-700",
    confirmButton:
      "px-4 py-2 border-4 border-slate-800 bg-emerald-400 font-black text-xs uppercase text-slate-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-emerald-500 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all mx-1",
    cancelButton:
      "px-4 py-2 border-4 border-slate-800 bg-slate-200 font-black text-xs uppercase text-slate-900 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:bg-slate-300 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all mx-1",
    input:
      "w-full bg-slate-100 border-2 border-slate-800 rounded px-3 py-2 text-sm font-bold focus:bg-yellow-100 mt-2 text-center",
  },
  buttonsStyling: false,
});

// =========================================================================
// LOGIKA ROLLOVER JAM 08:00 PAGI
// =========================================================================
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
    const barangTab = document.getElementById("tab-barang");

    if (isProcessing) return;

    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden")) ||
      (analitikTab && !analitikTab.classList.contains("hidden")) ||
      (barangTab && !barangTab.classList.contains("hidden"))
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

// =========================================================================
// HELPER MULTI-CUSTOMER
// =========================================================================
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
        if (realUsers.length === 0 && payload.username === "admin") {
          const { error: errIns } = await _supabase
            .from("Users")
            .insert([{ username: "admin", password: "admin", role: "Admin" }]);
          if (errIns) throw new Error(errIns.message);
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
              await _supabase.from("List_Order").insert([
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

      case "apiUpdateAssyFsg":
        await _supabase
          .from("Master_Barang")
          .update({ assy_fsg: payload.qty })
          .eq("Part_Number", payload.partNumber);
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
          await _supabase.from("List_Order").insert([
            {
              Part_Number: payload.partNumber,
              qty_order: payload.qty,
              id_customer: custTarget !== "-" ? custTarget : null,
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
          await _supabase.from("List_Order").insert([
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
          await _supabase.from("List_Order").insert([
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
        const { data: checkB } = await _supabase
          .from("Master_Barang")
          .select("*")
          .eq("Part_Number", payload.item.Part_Number);
        if (checkB && checkB.length > 0 && !payload.isEdit)
          throw new Error(
            "Part Number sudah ada di Master Data! Gunakan Edit untuk mengubah.",
          );

        if (payload.isEdit)
          await _supabase
            .from("Master_Barang")
            .update(payload.item)
            .eq("Part_Number", payload.item.Part_Number);
        else await _supabase.from("Master_Barang").insert([payload.item]);

        if (payload.customer && payload.customer !== "-") {
          const cClean = resolveCustomerDisplay(payload.customer);
          localStorage.setItem("cust_map_" + payload.item.Part_Number, cClean);
          saveLocalMultiCustTarget(payload.item.Part_Number, cClean, 0);
          const { data: checkOrdB } = await _supabase
            .from("List_Order")
            .select("*")
            .eq("Part_Number", payload.item.Part_Number);
          if (!checkOrdB || checkOrdB.length === 0) {
            await _supabase.from("List_Order").insert([
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

      case "apiSaveCustomer":
        if (payload.isEdit) {
          await _supabase
            .from("Master_Customer")
            .update(payload.cust)
            .eq("id_customer", payload.cust.id_customer);
        } else {
          const { data: checkC } = await _supabase
            .from("Master_Customer")
            .select("*")
            .eq("id_customer", payload.cust.id_customer);
          if (checkC && checkC.length > 0)
            throw new Error("ID Customer sudah ada!");
          await _supabase.from("Master_Customer").insert([payload.cust]);
        }
        return {
          success: true,
          message: payload.isEdit
            ? "Data Customer diperbarui!"
            : "Customer baru tersimpan!",
        };

      case "apiDeleteCustomer":
        await _supabase
          .from("Master_Customer")
          .delete()
          .eq("id_customer", payload.id_customer);
        return { success: true, message: "Customer terhapus!" };

      case "apiSaveUser":
        if (payload.isEdit) {
          await _supabase
            .from("Users")
            .update(payload.userData)
            .eq("username", payload.userData.username);
        } else {
          const { data: checkU } = await _supabase
            .from("Users")
            .select("*")
            .eq("username", payload.userData.username);
          if (checkU && checkU.length > 0)
            throw new Error("Username sudah terdaftar!");
          await _supabase.from("Users").insert([payload.userData]);
        }
        return {
          success: true,
          message: payload.isEdit
            ? "User berhasil diperbarui!"
            : "User baru berhasil didaftarkan!",
        };

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
  if (tabId === "barang") renderMasterBarangTable();
  if (tabId === "customer") renderCustomerTable();
  if (tabId === "users") renderUsersTable();
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
  const bWH = document.getElementById("batchBtnGroupWH"),
    bAssy = document.getElementById("batchBtnGroupAssy"),
    bCust = document.getElementById("batchCustWrapper");

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
// DASHBOARD LOGIC
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
      title: "ATUR CUSTOMER TUJUAN",
      html: `<div class="text-left space-y-3"><p class="text-xs">Part Number: <b>${partNumber}</b></p>
      <div><label class="block text-[10px] font-black uppercase mb-1">Customer:</label><select id="swalSelectCust" class="w-full bg-slate-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold">${optionsHtml}</select></div>
      <div><label class="block text-[10px] font-black uppercase mb-1">Mode:</label>
        <select id="swalModeCust" onchange="document.getElementById('swalWrapQtyBaru').classList.toggle('hidden', this.value !== 'ADD_NEW')" class="w-full bg-yellow-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold">
          <option value="UPDATE">Ubah Customer Baris Ini</option><option value="ADD_NEW">+ Tambah Customer Baru (Beli Barang Sama)</option>
          ${custCount > 1 ? `<option value="DELETE_ROW">Hapus Baris Customer Ini</option>` : ""}
        </select>
      </div>
      <div id="swalWrapQtyBaru" class="hidden"><label class="block text-[10px] font-black uppercase mb-1">Target QTY/DAY Baru:</label><input type="number" id="swalQtyOrderBaru" value="100" class="w-full bg-slate-100 border-2 border-slate-800 rounded px-3 py-2 text-xs font-bold" /></div>
    </div>`,
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
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
  if (isProcessing) return;
  swalUI
    .fire({
      title: "UPDATE STOK ASSY",
      html: `<p class="text-sm mb-3">Part:<br><b class="text-lg">${partNumber}</b></p>`,
      input: "number",
      inputValue: currentQty > 0 ? currentQty : "",
      showCancelButton: true,
      confirmButtonText: "Simpan",
    })
    .then((res) => {
      if (res.isConfirmed) {
        sendToBackend("apiUpdateAssyFsg", {
          partNumber,
          qty: Number(res.value) || 0,
        }).then(() => {
          showToast("success", "Assy Diupdate");
          refreshAllData();
        });
      }
    });
}

function promptUpdateQtyDay(partNumber, currentQty, customerName = "-") {
  if (isProcessing) return;
  swalUI
    .fire({
      title: "SET TARGET (QTY/DAY)",
      html: `<p class="text-sm mb-3">Part:<br><b class="text-lg">${partNumber}</b><br><span class="text-xs text-slate-500">Customer: ${customerName}</span></p>`,
      input: "number",
      inputValue: currentQty > 0 ? currentQty : "",
      showCancelButton: true,
      confirmButtonText: "Simpan",
    })
    .then((res) => {
      if (res.isConfirmed) {
        sendToBackend("apiUpdateQtyDay", {
          partNumber,
          qty: Number(res.value) || 0,
          customer: customerName,
        }).then(() => {
          showToast("success", "Target Disimpan");
          refreshAllData();
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
      <td class="py-2 px-1 border-2 border-slate-800 text-[10px] font-black text-slate-700 break-words ${custClass}" ${custAction} title="Klik untuk ubah/tambah Customer">${row.Customer}</td>
      <td class="py-2 px-1 border-2 border-slate-800 font-black text-yellow-600 bg-slate-50">${row.No_Rel}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left"><div class="font-black text-slate-900 text-sm tracking-tighter">${row.Part_Number}</div><div class="text-[10px] text-slate-500 truncate max-w-[120px] leading-none mt-0.5 uppercase">${row.nama_barang}</div></td>
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
// SCANNER: MENDUKUNG MULTI-FORMAT (PDF417, QR, 1D) MENGGUNAKAN ZXING
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
      showToast("error", "Tidak Dikenali", `Part ${code} tidak ada.`);
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
  if (existing) existing.trolleyCount += 1;
  else
    batchTrolley.push({
      Part_Number: item.Part_Number,
      nama_barang: item.nama_barang,
      No_Rel: item.No_Rel,
      Customer: custToUse,
      stock: item.stock,
      assy_fsg: item.assy_fsg,
      trolleyCount: 1,
      qtyInput: 1,
    });
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
    container.innerHTML = `<div class="py-12 text-center text-slate-400 font-bold text-xs border-2 border-dashed border-slate-300 rounded">Belum ada barang di Troli.</div>`;
    return;
  }
  container.innerHTML = batchTrolley
    .map(
      (b, idx) => `
    <div class="flex items-center justify-between p-2.5 bg-yellow-50 border-2 border-slate-800 rounded shadow-[2px_2px_0px_rgba(0,0,0,1)]">
      <div class="text-left pr-2">
        <div class="flex items-center gap-1.5"><span class="px-1.5 py-0.5 bg-slate-800 text-yellow-300 font-black text-[9px] rounded">${b.No_Rel}</span><span class="font-black text-xs text-slate-900">${b.Part_Number}</span></div>
        <div class="text-[10px] font-bold text-slate-500 uppercase mt-0.5">${b.nama_barang}</div>
        <div class="text-[10px] font-black text-blue-700 mt-0.5">Ditembak: ${b.trolleyCount}x Troli | Cust: <span class="text-slate-900">${b.Customer}</span></div>
      </div>
      <div class="flex items-center gap-2">
        <div>
          <label class="block text-[8px] font-black uppercase text-slate-500 text-center">Total Qty</label>
          <input type="number" min="1" value="${b.qtyInput}" oninput="batchTrolley[${idx}].qtyInput = Number(this.value)" class="w-20 bg-white border-2 border-slate-800 px-2 py-1 text-center font-black text-sm rounded focus:bg-yellow-100" />
        </div>
        <button onclick="batchTrolley.splice(${idx}, 1); updateBatchTrolleyUI();" class="w-7 h-7 bg-red-400 hover:bg-red-500 border-2 border-slate-800 rounded font-black text-xs flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
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
    Swal.close();
    showToast(
      "success",
      "Troli Tersimpan!",
      "Semua transaksi berhasil dicatat.",
    );
    refreshAllData();
  } catch (err) {
    Swal.close();
    showToast("error", "Gagal", err.message);
  }
  isProcessing = false;
}

// LOGIKA BARU MENGGUNAKAN ZXING
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
      showToast("error", "Kamera Gagal", "Pastikan izin kamera web diberikan.");
      stopSmartScanner();
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

  // PDF417 milik YIMM biasanya menyatukan banyak data.
  // Kita coba ambil kata pertama jika ada spasi, atau langsung trim()
  let part = scannedCode.trim();
  // Khusus PDF417 pabrik, kadang formatnya digabung (misal ada karakter khusus).
  // Untuk amannya, mari kita cari kecocokan substring jika perlu, atau gunakan raw partnya.

  const matchingRows = appData.seatAssyControl.filter(
    (item) =>
      item.Part_Number.toLowerCase() === part.toLowerCase() ||
      part.toLowerCase().includes(item.Part_Number.toLowerCase()),
  );

  if (matchingRows.length === 0) {
    showToast("error", "Tidak Dikenali", `Part ${part} tidak terdaftar.`);
    // Beri jeda 2 detik sebelum kamera bisa baca lagi agar toast tidak spam
    isCameraPaused = true;
    setTimeout(() => {
      isCameraPaused = false;
    }, 2000);
    return;
  }

  isCameraPaused = true; // Hentikan sementara pembacaan dari video
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
  document.getElementById("smInputQty").value = 1;

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
  // Lanjutkan kembali pemindaian setelah jeda sesaat agar tidak otomatis terscan barcode yang sama
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
  } else {
    const finalQty =
      tipeAction === "ASSY_ADD" ? activeScannedPart.assy_fsg + qty : qty;
    swalUI.fire({
      title: "Menyimpan...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    sendToBackend("apiUpdateAssyFsg", {
      partNumber: activeScannedPart.Part_Number,
      qty: finalQty,
    }).then((res) => {
      isProcessing = false;
      Swal.close();
      if (res.success) {
        closeSmartAction();
        refreshAllData();
        showToast("success", "Assy Tersimpan!");
      } else showToast("error", "Gagal", res.message);
    });
  }
}

// =========================================================================
// TABEL MASTER DATA (BARANG, CUSTOMER, USER) DENGAN EDIT & HAPUS
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
      <td class="py-2 px-3 border-2 border-slate-800 text-left font-bold">${b.nama_barang}</td>
      <td class="py-2 px-3 border-2 border-slate-800 font-black text-blue-700">${b.stok}</td>
      <td class="py-2 px-3 border-2 border-slate-800 font-black text-yellow-600">${b.No_Rel || "-"}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-center">
        <div class="flex items-center justify-center gap-1.5">
           <button onclick="editBarang('${b.Part_Number}')" class="w-7 h-7 bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Edit Barang"><i class="fa-solid fa-pen"></i></button>
           <button onclick="printBarcode('${b.Part_Number}', '${b.nama_barang}')" class="w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-900 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Cetak Barcode"><i class="fa-solid fa-print"></i></button>
           <button onclick="deleteBarang('${b.Part_Number}', '${b.nama_barang}')" class="w-7 h-7 bg-red-400 hover:bg-red-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Hapus Barang"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`,
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
  if (appData.customer.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">Tidak ada customer.</td></tr>`;
    return;
  }

  tbody.innerHTML = appData.customer
    .map(
      (c) => `
    <tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-3 border-2 border-slate-800 font-black">${c.id_customer}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left font-black">${c.nama_customer}</td>
      <td class="py-2 px-3 border-2 border-slate-800 text-left">${c.alamat || "-"}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-center">
        <div class="flex items-center justify-center gap-1.5">
           <button onclick="editCustomer('${c.id_customer}')" class="w-7 h-7 bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Edit Customer"><i class="fa-solid fa-pen"></i></button>
           <button onclick="deleteCustomer('${c.id_customer}', '${c.nama_customer}')" class="w-7 h-7 bg-red-400 hover:bg-red-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Hapus Customer"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`,
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
    tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">Tidak ada user.</td></tr>`;
    return;
  }

  tbody.innerHTML = usersList
    .map(
      (u) => `
    <tr class="hover:bg-yellow-50 transition-colors">
      <td class="py-2 px-3 border-2 border-slate-800 font-black">${u.username}</td>
      <td class="py-2 px-3 border-2 border-slate-800">${u.role}</td>
      <td class="py-2 px-2 border-2 border-slate-800 text-center">
        <div class="flex items-center justify-center gap-1.5">
           <button onclick="editUser('${u.username}')" class="w-7 h-7 bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Edit User"><i class="fa-solid fa-pen"></i></button>
           <button onclick="deleteUser('${u.username}')" class="w-7 h-7 bg-red-400 hover:bg-red-500 text-slate-900 border-2 border-slate-800 rounded font-black text-xs shadow-[2px_2px_0px_rgba(0,0,0,1)]" title="Hapus User"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`,
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
// MODAL FORMS: BARANG
// =========================================================================
function openModalBarang() {
  currentEditPart = null;
  populateCustomerDropdown(document.getElementById("mbCustomer"), "-");
  const partInput = document.getElementById("mbPartNumber");
  partInput.readOnly = false;
  partInput.classList.remove("bg-slate-200");

  const titleEl = document.getElementById("modalMasterBarangTitle");
  if (titleEl) titleEl.innerText = "Form Barang Baru";

  document.getElementById("formMasterBarang").reset();
  document.getElementById("modalMasterBarang").classList.remove("hidden");
}

function closeModalBarang() {
  document.getElementById("modalMasterBarang").classList.add("hidden");
  document.getElementById("formMasterBarang").reset();
  currentEditPart = null;
}

function editBarang(partNum) {
  const barang = appData.barang.find(
    (b) => String(b.Part_Number) === String(partNum),
  );
  if (!barang) return showToast("error", "Data tidak ditemukan");
  currentEditPart = partNum;

  const titleEl = document.getElementById("modalMasterBarangTitle");
  if (titleEl) titleEl.innerText = "Edit Data Barang";

  const partInput = document.getElementById("mbPartNumber");
  partInput.value = barang.Part_Number;
  partInput.readOnly = true;
  partInput.classList.add("bg-slate-200");

  document.getElementById("mbNamaBarang").value = barang.nama_barang || "";
  document.getElementById("mbKategori").value = barang.kategori || "";
  document.getElementById("mbSatuan").value = barang.satuan || "Pcs";
  document.getElementById("mbStdPack").value = barang.standar_packing || 1;
  document.getElementById("mbStok").value = barang.stok || 0;
  document.getElementById("mbStokMin").value = barang.stok_minimum || 10;
  document.getElementById("mbNoRel").value = barang.No_Rel || "";

  const relatedOrders = appData.orders.filter(
    (o) => String(o.Part_Number).trim() === String(partNum),
  );
  let custRaw = "-";
  if (
    relatedOrders.length > 0 &&
    relatedOrders[0].id_customer &&
    String(relatedOrders[0].id_customer) !== "undefined"
  ) {
    custRaw = relatedOrders[0].id_customer;
  } else if (barang.id_customer) {
    custRaw = barang.id_customer;
  } else if (localStorage.getItem("cust_map_" + partNum)) {
    custRaw = localStorage.getItem("cust_map_" + partNum);
  }

  populateCustomerDropdown(
    document.getElementById("mbCustomer"),
    resolveCustomerDisplay(custRaw),
  );
  document.getElementById("modalMasterBarang").classList.remove("hidden");
}

function deleteBarang(partNum, namaBarang) {
  swalUI
    .fire({
      title: "Hapus Permanen?",
      html: `Anda yakin ingin menghapus Part Number <br><b class="text-red-600">${partNum}</b>?<br><br><span class="text-xs">Data stok dan daftar customer untuk barang ini akan terhapus.</span>`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    })
    .then((result) => {
      if (result.isConfirmed) {
        isProcessing = true;
        swalUI.fire({
          title: "Menghapus...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiDeleteBarang", { partNumber: partNum }).then(
          (res) => {
            isProcessing = false;
            Swal.close();
            if (res.success) {
              showToast("success", "Terhapus!");
              refreshAllData();
            } else {
              showToast("error", "Gagal", res.message);
            }
          },
        );
      }
    });
}

function handleSaveBarang(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const selectedCust = document.getElementById("mbCustomer")?.value || "-";
  const payload = {
    isEdit: currentEditPart !== null,
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

  swalUI.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveBarang", payload).then((res) => {
    isProcessing = false;
    Swal.close();
    if (res.success) {
      closeModalBarang();
      refreshAllData();
      showToast("success", res.message);
    } else showToast("error", "Gagal Menyimpan", res.message);
  });
}

// =========================================================================
// MODAL FORMS: CUSTOMER
// =========================================================================
function openModalCustomer() {
  currentEditCustomer = null;
  const idInput = document.getElementById("mcId");
  idInput.readOnly = false;
  idInput.classList.remove("bg-slate-200");

  const titleEl = document.getElementById("modalMasterCustomerTitle");
  if (titleEl) titleEl.innerText = "Form Customer Baru";

  document.getElementById("formMasterCustomer").reset();
  document.getElementById("modalMasterCustomer").classList.remove("hidden");
}

function closeModalCustomer() {
  document.getElementById("modalMasterCustomer").classList.add("hidden");
  document.getElementById("formMasterCustomer").reset();
  currentEditCustomer = null;
}

function editCustomer(idCust) {
  const cust = appData.customer.find(
    (c) => String(c.id_customer) === String(idCust),
  );
  if (!cust) return showToast("error", "Data tidak ditemukan");
  currentEditCustomer = idCust;

  const titleEl = document.getElementById("modalMasterCustomerTitle");
  if (titleEl) titleEl.innerText = "Edit Data Customer";

  const idInput = document.getElementById("mcId");
  idInput.value = cust.id_customer;
  idInput.readOnly = true;
  idInput.classList.add("bg-slate-200");

  document.getElementById("mcNama").value = cust.nama_customer || "";
  document.getElementById("mcKontak").value = cust.kontak || "";
  document.getElementById("mcAlamat").value = cust.alamat || "";

  document.getElementById("modalMasterCustomer").classList.remove("hidden");
}

function deleteCustomer(idCust, namaCust) {
  swalUI
    .fire({
      title: "Hapus Customer?",
      html: `Anda yakin ingin menghapus Customer <br><b class="text-red-600">${namaCust}</b> (${idCust})?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    })
    .then((result) => {
      if (result.isConfirmed) {
        isProcessing = true;
        swalUI.fire({
          title: "Menghapus...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiDeleteCustomer", { id_customer: idCust }).then(
          (res) => {
            isProcessing = false;
            Swal.close();
            if (res.success) {
              showToast("success", "Customer Terhapus!");
              refreshAllData();
            } else {
              showToast("error", "Gagal", res.message);
            }
          },
        );
      }
    });
}

function handleSaveCustomer(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const payload = {
    isEdit: currentEditCustomer !== null,
    cust: {
      id_customer: document.getElementById("mcId").value.trim(),
      nama_customer: document.getElementById("mcNama").value.trim(),
      kontak: document.getElementById("mcKontak").value.trim(),
      alamat: document.getElementById("mcAlamat").value.trim(),
    },
  };

  swalUI.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveCustomer", payload).then((res) => {
    isProcessing = false;
    Swal.close();
    if (res.success) {
      closeModalCustomer();
      refreshAllData();
      showToast("success", res.message);
    } else showToast("error", "Gagal Menyimpan", res.message);
  });
}

// =========================================================================
// MODAL FORMS: PENGGUNA (USERS)
// =========================================================================
function openModalUser() {
  currentEditUser = null;
  const usernameInput = document.getElementById("muUsername");
  usernameInput.readOnly = false;
  usernameInput.classList.remove("bg-slate-200");

  const titleEl = document.getElementById("modalMasterUserTitle");
  if (titleEl) titleEl.innerText = "Form Pengguna Baru";

  document.getElementById("formMasterUser").reset();
  document.getElementById("modalMasterUser").classList.remove("hidden");
}

function closeModalUser() {
  document.getElementById("modalMasterUser").classList.add("hidden");
  document.getElementById("formMasterUser").reset();
  currentEditUser = null;
}

function editUser(username) {
  const usr = appData.users.find(
    (u) => String(u.username) === String(username),
  );
  if (!usr) return showToast("error", "User tidak ditemukan");
  currentEditUser = username;

  const titleEl = document.getElementById("modalMasterUserTitle");
  if (titleEl) titleEl.innerText = "Edit Data Pengguna";

  const usernameInput = document.getElementById("muUsername");
  usernameInput.value = usr.username;
  usernameInput.readOnly = true;
  usernameInput.classList.add("bg-slate-200");

  document.getElementById("muPassword").value = usr.password || "";
  document.getElementById("muRole").value = usr.role || "Warehouse";

  document.getElementById("modalMasterUser").classList.remove("hidden");
}

function deleteUser(usernameTarget) {
  if (currentUser && currentUser.username === usernameTarget)
    return showToast(
      "warning",
      "Ditolak!",
      "Anda tidak bisa menghapus akun yang sedang Anda gunakan sendiri.",
    );
  swalUI
    .fire({
      title: "Hapus Pengguna?",
      html: `Anda yakin ingin menghapus akun pengguna <br><b class="text-red-600">${usernameTarget}</b>?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    })
    .then((result) => {
      if (result.isConfirmed) {
        isProcessing = true;
        swalUI.fire({
          title: "Menghapus...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiDeleteUser", { usernameTarget }).then((res) => {
          isProcessing = false;
          Swal.close();
          if (res.success) {
            showToast("success", "User Terhapus!");
            refreshAllData();
          } else {
            showToast("error", "Gagal", res.message);
          }
        });
      }
    });
}

function handleSaveUser(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const payload = {
    isEdit: currentEditUser !== null,
    userData: {
      username: document.getElementById("muUsername").value.trim(),
      password: document.getElementById("muPassword").value.trim(),
      role: document.getElementById("muRole").value,
    },
  };

  swalUI.fire({
    title: "Menyimpan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiSaveUser", payload).then((res) => {
    isProcessing = false;
    Swal.close();
    if (res.success) {
      closeModalUser();
      refreshAllData();
      showToast("success", res.message);
    } else showToast("error", "Gagal Menyimpan", res.message);
  });
}

// =========================================================================
// AUTH
// =========================================================================
function openLoginModal() {
  document.getElementById("modalLogin").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("modalLogin").classList.add("hidden");
}
function logoutAction() {
  swalUI
    .fire({
      title: "Keluar Sistem?",
      showCancelButton: true,
      confirmButtonText: "Keluar",
    })
    .then((res) => {
      if (res.isConfirmed) {
        currentUser = null;
        sessionStorage.removeItem("sim_inventory_user");
        applyRbacUI();
        switchTab("overview");
        showToast("info", "Anda Berhasil Keluar");
      }
    });
}
function handleLoginSubmit(e) {
  e.preventDefault();
  swalUI.fire({
    title: "Menghubungkan...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  sendToBackend("apiLogin", {
    username: document.getElementById("loginUsername").value.trim(),
    password: document.getElementById("loginPassword").value.trim(),
  }).then((res) => {
    Swal.close();
    if (res.success) {
      currentUser = res.user;
      sessionStorage.setItem("sim_inventory_user", JSON.stringify(currentUser));
      applyRbacUI();
      closeLoginModal();
      switchTab("scanner");
      showToast("success", `Halo, ${currentUser.username}!`);
    } else showToast("error", "Login Gagal", res.message);
  });
}

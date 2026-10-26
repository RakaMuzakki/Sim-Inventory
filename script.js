// =========================================================================
// KONFIGURASI SUPABASE DATABASE (DENGAN RLS CUSTOM HEADER)
// =========================================================================
// ⚠️ GANTI DENGAN URL & KEY SUPABASE MILIK ANDA! ⚠️
const SUPABASE_URL = "https://qvvpfsndszxdjtgpudfp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dnBmc25kc3p4ZGp0Z3B1ZGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTExMTksImV4cCI6MjEwNjkyNzExOX0.VuvLwmjVTpdl9vgwaZcWqvWIk_C8PacK5h1M4m6E2mg";

const RLS_SECRET = "KunciGudang2026!";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      "x-sim-secret": RLS_SECRET,
    },
  },
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

let chartFastMoving = null;
let chartStock = null;

// =========================================================================
// GAYA VISUAL NORDIC FLAT (TOAST & SWEETALERT PILL THEME)
// =========================================================================
const style = document.createElement("style");
style.innerHTML = `
  @keyframes toastSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes toastSlideUp { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
  .animate-toast-in { animation: toastSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-toast-out { animation: toastSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
`;
document.head.appendChild(style);

function showToast(type, title, message = "") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className =
      "fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col gap-2.5 pointer-events-none w-[90%] max-w-sm";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  let iconColor = "text-emerald-500";
  let icon = '<i class="fa-solid fa-circle-check text-lg"></i>';

  if (type === "error") {
    iconColor = "text-red-500";
    icon = '<i class="fa-solid fa-circle-exclamation text-lg"></i>';
  } else if (type === "warning") {
    iconColor = "text-amber-500";
    icon = '<i class="fa-solid fa-triangle-exclamation text-lg"></i>';
  } else if (type === "info") {
    iconColor = "text-gray-900";
    icon = '<i class="fa-solid fa-circle-info text-lg"></i>';
  }

  toast.className = `flex items-center gap-3.5 bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.08)] px-5 py-3.5 rounded-full pointer-events-auto animate-toast-in`;
  toast.innerHTML = `
    <div class="${iconColor} flex-shrink-0">${icon}</div>
    <div class="flex-1 min-w-0">
      <h4 class="font-bold text-xs text-gray-900 truncate">${title}</h4>
      ${message ? `<p class="text-[11px] font-medium text-gray-400 truncate">${message}</p>` : ""}
    </div>
    <button onclick="this.parentElement.classList.replace('animate-toast-in', 'animate-toast-out'); setTimeout(() => this.parentElement.remove(), 250)" class="text-gray-300 hover:text-gray-600 transition-colors">
      <i class="fa-solid fa-xmark text-xs"></i>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.replace("animate-toast-in", "animate-toast-out");
      setTimeout(() => toast.remove(), 250);
    }
  }, 3000);
}

const swalUI = Swal.mixin({
  customClass: {
    popup: "rounded-3xl shadow-2xl bg-white border border-gray-100 p-6",
    title: "font-extrabold text-gray-900 text-lg tracking-tight",
    htmlContainer: "text-xs text-gray-500 font-medium",
    confirmButton:
      "px-6 py-2.5 bg-gray-900 text-white rounded-full font-semibold text-xs hover:bg-black transition-all mx-1.5",
    cancelButton:
      "px-6 py-2.5 bg-gray-100 text-gray-600 rounded-full font-semibold text-xs hover:bg-gray-200 transition-all mx-1.5",
    input:
      "w-full bg-gray-100/80 focus:bg-white border border-transparent focus:border-gray-300 rounded-2xl px-4 py-3 text-xl font-extrabold text-gray-900 outline-none mt-3 text-center transition-all",
  },
  buttonsStyling: false,
});

// =========================================================================
// PENERJEMAH BARCODE CERDAS (YIMM / PDF417 / KANBAN)
// =========================================================================
function parseYimmBarcode(rawCode) {
  let result = {
    partNumberClean: rawCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
    original: rawCode,
    qty: 1,
  };
  if (rawCode.startsWith("[)>")) {
    let partMatch = rawCode.match(/P([A-Z0-9]+)V/);
    if (partMatch && partMatch[1]) result.partNumberClean = partMatch[1];
    else {
      let fallbackPart = rawCode.match(/P([A-Z0-9]{10,15})/);
      if (fallbackPart) result.partNumberClean = fallbackPart[1];
    }
    let qtyMatch = rawCode.match(/Q(\d{6})/);
    if (qtyMatch && qtyMatch[1]) result.qty = parseInt(qtyMatch[1], 10);
    return result;
  }
  if (rawCode.includes("|")) {
    let segment1 = rawCode.split("|")[0];
    let parts = segment1.split("-");
    if (parts.length > 1) {
      let possibleQty = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(possibleQty)) {
        result.qty = possibleQty;
        parts.pop();
      }
      result.partNumberClean = parts
        .join("")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
    } else {
      result.partNumberClean = segment1
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
    }
  }
  return result;
}

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
    const custTab = document.getElementById("tab-customer");
    const usersTab = document.getElementById("tab-users");

    if (isProcessing) return;

    if (
      (overviewTab && !overviewTab.classList.contains("hidden")) ||
      (riwayatTab && !riwayatTab.classList.contains("hidden")) ||
      (analitikTab && !analitikTab.classList.contains("hidden")) ||
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
        const { data: bAssy, error: errAssy } = await _supabase
          .from("Master_Barang")
          .select("assy_fsg")
          .eq("Part_Number", payload.partNumber)
          .single();
        if (errAssy) throw new Error(errAssy.message);

        const currentAssy = Number(bAssy?.assy_fsg) || 0;
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
            await _supabase.from("Transaksi_Masuk").insert([
              {
                Part_Number: payload.partNumber,
                qty: diff,
                petugas: payload.petugas,
                catatan: "Masuk Gudang FSG (Hasil Assy)",
                tanggal: new Date().toISOString(),
              },
            ]);
          } else if (diff < 0) {
            await _supabase.from("Transaksi_Masuk").insert([
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

        if (payload.petugas) {
          await _supabase.from("Transaksi_Masuk").insert([
            {
              Part_Number: payload.partNumber,
              qty: 0,
              petugas: payload.petugas,
              catatan: `Set Target QTY/DAY menjadi ${payload.qty} Pcs (${custTarget})`,
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

// =========================================================================
// UI & NAVIGASI NORDIC
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
    btn.classList.remove("bg-gray-900", "text-white", "font-semibold");
    btn.classList.add("text-gray-500", "font-medium");
  });
  const activeNav = document.getElementById(`btn-tab-${tabId}`);
  if (activeNav) {
    activeNav.classList.add("bg-gray-900", "text-white", "font-semibold");
    activeNav.classList.remove("text-gray-500", "font-medium");
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

// =========================================================================
// FUNGSI POPUP INTERAKTIF (DASHBOARD)
// =========================================================================
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
      title: "Pengaturan Customer",
      html: `<div class="text-left space-y-3 mt-2"><p class="text-xs text-gray-500">Part: <b class="text-gray-900">${partNumber}</b></p>
      <div><label class="block text-[11px] font-semibold text-gray-400 mb-1">Pilih Customer:</label><select id="swalSelectCust" class="w-full bg-gray-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 outline-none">${optionsHtml}</select></div>
      <div><label class="block text-[11px] font-semibold text-gray-400 mb-1">Tindakan:</label>
        <select id="swalModeCust" onchange="document.getElementById('swalWrapQtyBaru').classList.toggle('hidden', this.value !== 'ADD_NEW')" class="w-full bg-gray-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 outline-none">
          <option value="UPDATE">Ubah Customer Baris Ini</option><option value="ADD_NEW">+ Tambah Customer Baru (Part Sama)</option>
          ${custCount > 1 ? `<option value="DELETE_ROW">Hapus Baris Customer Ini</option>` : ""}
        </select>
      </div>
      <div id="swalWrapQtyBaru" class="hidden"><label class="block text-[11px] font-semibold text-gray-400 mb-1">Target Harian Baru:</label><input type="number" id="swalQtyOrderBaru" value="100" class="w-full bg-gray-100 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-800 outline-none" /></div>
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
  if (!currentUser) return openLoginModal();
  if (isProcessing) return;

  swalUI
    .fire({
      title: "Update Stok Assy",
      html: `<p class="text-xs text-gray-400 mb-3">${partNumber}</p>
           <div class="inline-block bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-xs font-bold mb-3">Stok Saat Ini: ${currentQty} Pcs</div>
           <p class="text-[11px] text-gray-400">Ketik <b class="text-gray-800">Total Akhir</b>. Selisih angka otomatis dicatat ke Riwayat.</p>`,
      input: "number",
      inputValue: currentQty,
      inputAttributes: { min: 0 },
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        const newTotal = Number(res.value);
        if (newTotal < 0)
          return showToast("error", "Error", "Total tidak boleh minus");
        if (newTotal === currentQty)
          return showToast("info", "Tidak berubah", "Angka masih sama");

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
            showToast("success", "Assy Diperbarui");
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
      title: "Target Harian",
      html: `<p class="text-xs text-gray-400 mb-2">${partNumber} &bull; <span class="text-gray-700 font-semibold">${customerName}</span></p>
           <p class="text-[11px] text-gray-400">Perubahan target akan tercatat di log riwayat.</p>`,
      input: "number",
      inputValue: currentQty > 0 ? currentQty : "",
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        isProcessing = true;
        swalUI.fire({
          title: "Menyimpan...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        sendToBackend("apiUpdateQtyDay", {
          partNumber: partNumber,
          qty: Number(res.value) || 0,
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
      title: "Update Terkirim (Out)",
      html: `<p class="text-xs text-gray-400 mb-3">${partNumber} &bull; <span class="text-gray-700 font-semibold">${customerName}</span></p>
           <div class="inline-block bg-gray-100 text-gray-800 px-4 py-1.5 rounded-full text-xs font-bold mb-3">Terkirim Saat Ini: ${currentQtyOut} Pcs</div>
           <p class="text-[11px] text-gray-400">Ketik <b class="text-gray-800">Total Akhir</b> pengiriman. Selisihnya otomatis masuk ke Riwayat.</p>`,
      input: "number",
      inputValue: currentQtyOut,
      inputAttributes: { min: 0 },
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        const newTotal = Number(res.value);
        if (newTotal < 0)
          return showToast("error", "Error", "Total tidak boleh minus");
        if (newTotal === currentQtyOut)
          return showToast("info", "Tidak berubah", "Angka masih sama");

        const diff = newTotal - currentQtyOut;
        isProcessing = true;
        swalUI.fire({
          title: "Mencatat...",
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
            showToast("success", "Pengiriman Diperbarui");
            refreshAllData();
          } else {
            showToast("error", "Gagal", response.message);
          }
        });
      }
    });
}

// =========================================================================
// PAPAN KONTROL NORDIC FLAT (BORDERLESS VERTICAL, HIRARKI ANGKA)
// =========================================================================
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
    tbody.innerHTML = `<tr><td colspan="9" class="py-16 text-center text-gray-400 text-xs font-medium">Tidak ada data untuk ditampilkan.</td></tr>`;
    return;
  }

  dataset.sort((a, b) => {
    if (a.Customer < b.Customer) return -1;
    if (a.Customer > b.Customer) return 1;
    if (a.No_Rel < b.No_Rel) return -1;
    if (a.No_Rel > b.No_Rel) return 1;
    return 0;
  });

  const isAdmin = currentUser && currentUser.role === "Admin";
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
          : "0";

    // Pill Badges Lembut
    let varBadge =
      row.variance > 0
        ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">${varFormat}</span>`
        : row.variance < 0
          ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600">${varFormat}</span>`
          : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">-</span>`;

    const custClass = canEditCust
      ? "cursor-pointer hover:text-gray-900 transition-colors"
      : "";
    const custAction = canEditCust
      ? `onclick="promptUpdateCustomerPart('${row.Part_Number}', '${row.Customer}', ${row.CustomerCount || 1})"`
      : "";

    const qtyDayClass = isAdmin
      ? "cursor-pointer hover:bg-gray-100 px-3 py-1 rounded-full transition-all inline-block"
      : "";
    const qtyDayAction = isAdmin
      ? `onclick="promptUpdateQtyDay('${row.Part_Number}', ${row.qty_day}, '${row.Customer}')"`
      : "";

    const qtyOutClass = canEditCust
      ? "cursor-pointer hover:bg-gray-100 px-3 py-1 rounded-full transition-all inline-block"
      : "";
    const qtyOutAction = canEditCust
      ? `onclick="promptUpdateQtyOut('${row.Part_Number}', '${row.Customer}', ${row.qty_out})"`
      : "";

    const assyClass = canEditAssy
      ? "cursor-pointer hover:bg-purple-100/60 bg-purple-50/50 px-3.5 py-1 rounded-full transition-all inline-block"
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

    html += `<tr class="hover:bg-gray-50/60 transition-colors group">`;
    if (isFirstOfGroup) {
      html += `<td rowspan="${rowspan}" class="py-4 pr-4 align-top text-xs font-bold text-gray-400 uppercase tracking-wider ${custClass}" ${custAction} title="Atur Customer">${row.Customer}</td>`;
    }
    html += `
      <td class="py-4 px-4 align-middle"><span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold text-xs">${row.No_Rel}</span></td>
      <td class="py-4 px-4 align-middle">
        <div class="text-base font-extrabold text-gray-900 tracking-tight">${row.Part_Number}</div>
        <div class="text-xs font-medium text-gray-400 mt-0.5 uppercase">${row.nama_barang}</div>
      </td>
      <td class="py-4 px-4 align-middle text-center"><span class="text-lg font-extrabold text-gray-900">${formatNum(row.stock)}</span></td>
      <td class="py-4 px-4 align-middle text-center"><span class="text-sm font-semibold text-gray-600 ${qtyDayClass}" ${qtyDayAction}>${formatNum(row.qty_day)}</span></td>
      <td class="py-4 px-4 align-middle text-center"><span class="text-sm font-semibold text-gray-600 ${qtyOutClass}" ${qtyOutAction}>${formatNum(row.qty_out)}</span></td>
      <td class="py-4 px-4 align-middle text-center"><span class="text-sm font-bold ${row.sisa_del > 0 ? "text-red-500" : "text-gray-300"}">${formatNum(row.sisa_del)}</span></td>
      <td class="py-4 px-4 align-middle text-center"><span class="text-base font-extrabold text-purple-600 ${assyClass}" ${assyAction}>${formatNum(row.assy_fsg)}</span></td>
      <td class="py-4 pl-4 align-middle text-right">${varBadge}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function handleGlobalSearch(kw) {
  renderSeatAssyControlBoard(kw);
}

// =========================================================================
// SCANNER SMART YIMM PARSING
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

    const parsed = parseYimmBarcode(code);

    const matchingRows = appData.seatAssyControl.filter(
      (item) =>
        item.Part_Number.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ===
          parsed.partNumberClean ||
        item.Part_Number.toLowerCase() === code.toLowerCase(),
    );

    if (matchingRows.length === 0) {
      showToast("error", "Tidak Dikenali", `Part ${code} tidak terdaftar.`);
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
    container.innerHTML = `<div class="py-14 text-center text-gray-400 text-xs font-medium bg-gray-50/70 rounded-2xl">Belum ada item yang di-scan.</div>`;
    return;
  }

  container.innerHTML = batchTrolley
    .map(
      (b, idx) => `
    <div class="flex items-center justify-between p-4 bg-gray-50/80 hover:bg-gray-100/70 rounded-2xl transition-colors">
      <div class="text-left pr-3">
        <div class="flex items-center gap-2 mb-0.5">
           <span class="px-2 py-0.5 bg-white text-gray-600 font-bold text-[10px] rounded-full shadow-2xs">${b.No_Rel}</span>
           <span class="font-extrabold text-sm text-gray-900">${b.Part_Number}</span>
        </div>
        <div class="text-[11px] font-medium text-gray-400 uppercase">${b.nama_barang}</div>
        <div class="text-[11px] font-semibold text-gray-600 mt-1">${b.trolleyCount}x Troli &bull; <span class="text-gray-400">${b.Customer}</span></div>
      </div>
      <div class="flex items-center gap-2.5">
        <input type="number" min="1" value="${b.qtyInput}" oninput="batchTrolley[${idx}].qtyInput = Number(this.value)" class="w-16 bg-white border border-gray-200/80 px-2 py-1.5 text-center font-extrabold text-sm rounded-full outline-none focus:border-gray-900 text-gray-900" />
        <button onclick="batchTrolley.splice(${idx}, 1); updateBatchTrolleyUI();" class="w-8 h-8 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-colors"><i class="fa-solid fa-xmark text-xs"></i></button>
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
      "Daftar Kosong",
      "Scan barang terlebih dahulu.",
    );
  if (isProcessing) return;

  const invalidQty = batchTrolley.find(
    (b) => !b.qtyInput || Number(b.qtyInput) <= 0,
  );
  if (invalidQty)
    return showToast(
      "error",
      "Qty Tidak Valid",
      `Cek jumlah untuk ${invalidQty.Part_Number}`,
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
          "Pilih Customer",
          "Tentukan tujuan pengiriman di atas.",
        );
    }
  }

  isProcessing = true;
  swalUI.fire({
    title: "Memproses...",
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
    showToast("success", "Selesai", "Seluruh batch berhasil dicatat.");
    refreshAllData();
  } catch (err) {
    Swal.close();
    showToast("error", "Gagal", err.message);
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
  let html = `<option value="-">${isBatch ? "-- Sesuai Default Part --" : "-- Pilih Customer --"}</option>`;
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
    showToast("error", "Tidak Dikenali", `Part tidak terdaftar.`);
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
        "Pilih Customer",
        "Tentukan tujuan pengiriman.",
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
        showToast("success", "Berhasil Keluar");
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
        showToast("success", "Berhasil Masuk");
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
        showToast("success", "Assy Ditambahkan");
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
        showToast("success", "Assy Disetel");
      } else showToast("error", "Gagal", res.message);
    });
  }
}

// =========================================================================
// TABEL MASTER DATA NORDIC FLAT (HIRARKI TEKS & TOMBOL PIL)
// =========================================================================

// --- MASTER BARANG ---
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
    tbody.innerHTML = `<tr><td colspan="5" class="py-16 text-center text-gray-400 text-xs font-medium">Tidak ada part ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map((b) => {
      const isChecked = selectedForDelete.includes(String(b.Part_Number))
        ? "checked"
        : "";
      return `
    <tr class="hover:bg-gray-50/60 transition-colors">
      <td class="py-4 pr-4 text-center align-middle"><input type="checkbox" class="chk-barang w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer accent-gray-900" value="${b.Part_Number}" ${isChecked} onchange="toggleSingleBarang(this)"></td>
      <td class="py-4 px-4 align-middle">
        <div class="text-base font-extrabold text-gray-900 tracking-tight">${b.Part_Number}</div>
        <div class="text-xs font-medium text-gray-400 mt-0.5 uppercase">${b.nama_barang}</div>
      </td>
      <td class="py-4 px-4 align-middle"><span class="text-lg font-extrabold text-gray-900">${b.stok}</span> <span class="text-xs text-gray-400 font-medium">${b.satuan || "Pcs"}</span></td>
      <td class="py-4 px-4 align-middle"><span class="px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold text-xs">${b.No_Rel || "-"}</span></td>
      <td class="py-4 pl-4 align-middle text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editBarang('${b.Part_Number}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" title="Edit"><i class="fa-solid fa-pen text-[11px]"></i></button>
           <button onclick="printBarcode('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors" title="Print"><i class="fa-solid fa-print text-[11px]"></i></button>
           <button onclick="deleteBarang('${b.Part_Number}', '${b.nama_barang}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors" title="Hapus"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
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
      title: "Hapus Item Terpilih?",
      html: `Menghapus permanen <b class="text-red-600">${selectedForDelete.length}</b> part dari sistem.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
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
        sendToBackend("apiBulkDeleteBarang", {
          partNumbers: selectedForDelete,
        }).then((res) => {
          isProcessing = false;
          Swal.close();
          if (res.success) {
            showToast("success", "Terhapus");
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

function deleteBarang(partNum, namaBarang) {
  swalUI
    .fire({
      title: "Hapus Part?",
      html: `Hapus permanen <b class="text-gray-900">${partNum}</b> (${namaBarang})?`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
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
              showToast("success", "Terhapus");
              selectedForDelete = selectedForDelete.filter(
                (p) => p !== String(partNum),
              );
              refreshAllData();
            } else {
              showToast("error", "Gagal", res.message);
            }
          },
        );
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

// --- MASTER CUSTOMER ---
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
    tbody.innerHTML = `<tr><td colspan="4" class="py-16 text-center text-gray-400 text-xs font-medium">Tidak ada customer.</td></tr>`;
    return;
  }

  tbody.innerHTML = dataset
    .map(
      (c) => `
    <tr class="hover:bg-gray-50/60 transition-colors">
      <td class="py-4 pr-4 font-extrabold text-gray-900">${c.id_customer}</td>
      <td class="py-4 px-4 font-semibold text-gray-700">${c.nama_customer}</td>
      <td class="py-4 px-4 text-xs text-gray-400 font-medium">${c.alamat || "-"}</td>
      <td class="py-4 pl-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editCustomer('${c.id_customer}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"><i class="fa-solid fa-pen text-[11px]"></i></button>
           <button onclick="deleteCustomer('${c.id_customer}', '${c.nama_customer}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
        </div>
      </td>
    </tr>`,
    )
    .join("");
}

function deleteCustomer(idCust, namaCust) {
  swalUI
    .fire({
      title: "Hapus Customer?",
      html: `Hapus <b class="text-gray-900">${namaCust}</b> (${idCust})?`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
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
              showToast("success", "Customer Dihapus");
              refreshAllData();
            } else {
              showToast("error", "Gagal", res.message);
            }
          },
        );
      }
    });
}

// --- KELOLA PENGGUNA ---
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
    tbody.innerHTML = `<tr><td colspan="3" class="py-16 text-center text-gray-400 text-xs font-medium">Tidak ada pengguna.</td></tr>`;
    return;
  }

  tbody.innerHTML = usersList
    .map((u) => {
      let roleBadge = `<span class="px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-semibold text-xs">${u.role}</span>`;
      if (u.role === "Admin")
        roleBadge = `<span class="px-3 py-1 rounded-full bg-gray-900 text-white font-semibold text-xs">${u.role}</span>`;
      if (u.role === "Produksi")
        roleBadge = `<span class="px-3 py-1 rounded-full bg-purple-50 text-purple-600 font-semibold text-xs">${u.role}</span>`;

      return `
    <tr class="hover:bg-gray-50/60 transition-colors">
      <td class="py-4 pr-4 font-extrabold text-gray-900">${u.username}</td>
      <td class="py-4 px-4">${roleBadge}</td>
      <td class="py-4 pl-4 text-right">
        <div class="flex items-center justify-end gap-1.5">
           <button onclick="editUser('${u.username}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"><i class="fa-solid fa-pen text-[11px]"></i></button>
           <button onclick="deleteUser('${u.username}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

function deleteUser(usernameTarget) {
  if (currentUser && currentUser.username === usernameTarget)
    return showToast(
      "warning",
      "Ditolak",
      "Tidak bisa menghapus akun yang sedang aktif.",
    );
  swalUI
    .fire({
      title: "Hapus Akun?",
      html: `Hapus pengguna <b class="text-gray-900">${usernameTarget}</b>?`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
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
            showToast("success", "Akun Dihapus");
            refreshAllData();
          } else {
            showToast("error", "Gagal", res.message);
          }
        });
      }
    });
}

// --- RIWAYAT TRANSAKSI ---
function renderRiwayatTable() {
  const tbody = document.getElementById("tblRiwayatBody");
  if (!tbody) return;
  const fTipe = document.getElementById("filterRiwayat")?.value || "ALL";
  const fBulan = document.getElementById("filterBulanRiwayat")?.value || "";

  let logs = [];

  const isMatchMonth = (dateStr) => {
    if (!fBulan) return true;
    const d = new Date(dateStr);
    const ym =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return ym === fBulan;
  };

  if (fTipe === "ALL" || fTipe === "IN") {
    appData.masuk.forEach((m) => {
      if (isMatchMonth(m.tanggal || m.created_at)) {
        logs.push({
          waktu: new Date(m.tanggal || m.created_at),
          tipe: "IN",
          part: m.Part_Number,
          qty: m.qty,
          petugas: m.petugas,
          catatan: m.catatan,
        });
      }
    });
  }
  if (fTipe === "ALL" || fTipe === "OUT") {
    appData.keluar.forEach((k) => {
      if (isMatchMonth(k.tanggal || k.created_at)) {
        logs.push({
          waktu: new Date(k.tanggal || k.created_at),
          tipe: "OUT",
          part: k.Part_Number,
          qty: k.qty,
          petugas: k.petugas,
          catatan: k.catatan,
        });
      }
    });
  }
  logs.sort((a, b) => b.waktu - a.waktu);

  tbody.innerHTML =
    logs.length === 0
      ? `<tr><td colspan="6" class="py-16 text-center text-gray-400 text-xs font-medium">Belum ada riwayat transaksi.</td></tr>`
      : logs
          .map((r) => {
            let isTarget = r.catatan && String(r.catatan).includes("QTY/DAY");
            let displayQty = r.qty;
            let color = "text-gray-900";
            let bgTipe = "bg-gray-100 text-gray-600";

            if (isTarget) {
              displayQty = `TARGET`;
              color = "text-gray-500 text-xs";
              bgTipe = "bg-gray-100 text-gray-600";
            } else if (r.tipe === "IN") {
              displayQty = r.qty > 0 ? `+${r.qty}` : `${r.qty}`;
              color = r.qty > 0 ? "text-emerald-600" : "text-red-500";
              bgTipe = "bg-emerald-50 text-emerald-600";
            } else {
              displayQty = r.qty > 0 ? `-${r.qty}` : `+${Math.abs(r.qty)}`;
              color = r.qty > 0 ? "text-gray-900" : "text-emerald-600";
              bgTipe = "bg-gray-900 text-white";
            }

            return `<tr class="hover:bg-gray-50/60 transition-colors">
      <td class="py-4 pr-4 text-xs font-medium text-gray-400">${r.waktu.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
      <td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${bgTipe}">${isTarget ? "SET" : r.tipe}</span></td>
      <td class="py-4 px-4 font-extrabold text-base text-gray-900 tracking-tight">${r.part}</td>
      <td class="py-4 px-4 text-right font-extrabold text-base ${color}">${displayQty}</td>
      <td class="py-4 px-4 text-xs font-semibold text-gray-600">${r.petugas || "-"}</td>
      <td class="py-4 pl-4 text-xs font-medium text-gray-400">${r.catatan || "-"}</td>
    </tr>`;
          })
          .join("");
}

function renderAnalitikCharts() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";
  Chart.defaults.color = "#9CA3AF";

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
        labels: top5.length ? top5.map((x) => x[0]) : ["Kosong"],
        datasets: [
          {
            data: top5.length ? top5.map((x) => x[1]) : [0],
            backgroundColor: "#111827",
            borderRadius: 999,
            barThickness: 28,
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
            grid: { color: "#F3F4F6" },
            border: { display: false },
          },
          x: { grid: { display: false }, border: { display: false } },
        },
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
          : ["Kosong"],
        datasets: [
          {
            label: "Stok",
            data: lowStock.length ? lowStock.map((x) => Number(x.stok)) : [0],
            backgroundColor: "#10B981",
            borderRadius: 999,
            barThickness: 20,
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
            grid: { color: "#F3F4F6" },
            border: { display: false },
          },
          x: { grid: { display: false }, border: { display: false } },
        },
      },
    },
  );
}

// =========================================================================
// FUNGSI EKSPOR EXCEL (.XLSX)
// =========================================================================
function exportToExcel(tipe) {
  if (typeof XLSX === "undefined") {
    return showToast(
      "error",
      "Belum Siap",
      "Silakan tunggu sebentar lalu coba lagi.",
    );
  }

  let dataToExport = [];
  let filename = "";
  const dateStr = new Date().toISOString().split("T")[0];

  if (tipe === "PapanKontrol") {
    const keyword =
      document.getElementById("globalSearchInput")?.value.toLowerCase() || "";
    let dataset = appData.seatAssyControl || [];
    if (keyword) {
      dataset = dataset.filter(
        (d) =>
          String(d.Part_Number).toLowerCase().includes(keyword) ||
          String(d.No_Rel).toLowerCase().includes(keyword) ||
          String(d.Customer).toLowerCase().includes(keyword),
      );
    }

    dataset.sort((a, b) => {
      if (a.Customer < b.Customer) return -1;
      if (a.Customer > b.Customer) return 1;
      if (a.No_Rel < b.No_Rel) return -1;
      if (a.No_Rel > b.No_Rel) return 1;
      return 0;
    });

    dataToExport = dataset.map((item) => ({
      Customer: item.Customer,
      "No Rel Rak": item.No_Rel,
      "Part Number": item.Part_Number,
      "Nama Barang": item.nama_barang,
      "Stock Master (Pcs)": item.stock,
      "Target Qty/Day (Pcs)": item.qty_day,
      "Terkirim Qty/Out (Pcs)": item.qty_out,
      "Sisa Delivery (Pcs)": item.sisa_del,
      "Stok Assy / FSG (Pcs)": item.assy_fsg,
      "Varians Status": item.variance,
    }));
    filename = "Laporan_Papan_Kontrol_" + dateStr + ".xlsx";
  } else if (tipe === "Riwayat") {
    const filterTipe = document.getElementById("filterRiwayat")?.value || "ALL";
    const filterBulan =
      document.getElementById("filterBulanRiwayat")?.value || "";

    const isMatchMonth = (dateString) => {
      if (!filterBulan) return true;
      const d = new Date(dateString);
      const ym =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      return ym === filterBulan;
    };

    let logs = [];
    if (filterTipe === "ALL" || filterTipe === "IN") {
      appData.masuk.forEach((m) => {
        if (isMatchMonth(m.tanggal || m.created_at)) {
          logs.push({
            Waktu: new Date(m.tanggal || m.created_at),
            Tipe: "MASUK (IN)",
            Part_Number: m.Part_Number,
            Qty: m.qty,
            Petugas: m.petugas,
            Catatan: m.catatan,
          });
        }
      });
    }
    if (filterTipe === "ALL" || filterTipe === "OUT") {
      appData.keluar.forEach((k) => {
        if (isMatchMonth(k.tanggal || k.created_at)) {
          logs.push({
            Waktu: new Date(k.tanggal || k.created_at),
            Tipe: "KELUAR (OUT)",
            Part_Number: k.Part_Number,
            Qty: k.qty,
            Petugas: k.petugas,
            Catatan: k.catatan,
          });
        }
      });
    }
    logs.sort((a, b) => b.Waktu - a.Waktu);

    dataToExport = logs.map((r) => ({
      "Waktu Transaksi": r.Waktu.toLocaleString("id-ID"),
      "Tipe Transaksi": r.Tipe,
      "Part Number": r.Part_Number,
      "Qty (Pcs)": r.Qty,
      Petugas: r.Petugas,
      "Keterangan / Tujuan": r.Catatan || "-",
    }));

    let monthLabel = filterBulan ? filterBulan : dateStr;
    filename = "Laporan_Riwayat_Transaksi_" + monthLabel + ".xlsx";
  }

  if (dataToExport.length === 0) {
    return showToast(
      "warning",
      "Data Kosong",
      "Tidak ada data untuk diekspor.",
    );
  }

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, filename);
  showToast("success", "Diunduh", filename);
}

// =========================================================================
// MODAL FORMS: BARANG, CUSTOMER, USER, AUTH
// =========================================================================
function openModalBarang() {
  currentEditPart = null;
  populateCustomerDropdown(document.getElementById("mbCustomer"), "-");
  const partInput = document.getElementById("mbPartNumber");
  partInput.readOnly = false;
  document.getElementById("modalMasterBarangTitle").innerText = "Part Baru";
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

  document.getElementById("modalMasterBarangTitle").innerText = "Edit Part";
  document.getElementById("mbPartNumber").value = barang.Part_Number;
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

function handleSaveBarang(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const selectedCust = document.getElementById("mbCustomer")?.value || "-";
  const payload = {
    isEdit: currentEditPart !== null,
    oldPartNumber: currentEditPart,
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
    } else showToast("error", "Gagal", res.message);
  });
}

function openModalCustomer() {
  currentEditCustomer = null;
  document.getElementById("modalMasterCustomerTitle").innerText =
    "Customer Baru";
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

  document.getElementById("modalMasterCustomerTitle").innerText =
    "Edit Customer";
  document.getElementById("mcId").value = cust.id_customer;
  document.getElementById("mcNama").value = cust.nama_customer || "";
  document.getElementById("mcKontak").value = cust.kontak || "";
  document.getElementById("mcAlamat").value = cust.alamat || "";

  document.getElementById("modalMasterCustomer").classList.remove("hidden");
}

function handleSaveCustomer(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const payload = {
    isEdit: currentEditCustomer !== null,
    oldIdCustomer: currentEditCustomer,
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
    } else showToast("error", "Gagal", res.message);
  });
}

function openModalUser() {
  currentEditUser = null;
  document.getElementById("modalMasterUserTitle").innerText = "Akun Baru";
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

  document.getElementById("modalMasterUserTitle").innerText = "Edit Akun";
  document.getElementById("muUsername").value = usr.username;
  document.getElementById("muPassword").value = usr.password || "";
  document.getElementById("muRole").value = usr.role || "Warehouse";

  document.getElementById("modalMasterUser").classList.remove("hidden");
}

function handleSaveUser(e) {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  const payload = {
    isEdit: currentEditUser !== null,
    oldUsername: currentEditUser,
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
    } else showToast("error", "Gagal", res.message);
  });
}

function openLoginModal() {
  document.getElementById("modalLogin").classList.remove("hidden");
}
function closeLoginModal() {
  document.getElementById("modalLogin").classList.add("hidden");
}
function logoutAction() {
  swalUI
    .fire({
      title: "Keluar Workspace?",
      showCancelButton: true,
      confirmButtonText: "Keluar",
      cancelButtonText: "Batal",
    })
    .then((res) => {
      if (res.isConfirmed) {
        currentUser = null;
        sessionStorage.removeItem("sim_inventory_user");
        applyRbacUI();
        switchTab("overview");
        showToast("info", "Sesi Berakhir");
      }
    });
}
function handleLoginSubmit(e) {
  e.preventDefault();
  swalUI.fire({
    title: "Otentikasi...",
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
      showToast("success", `Selamat bekerja, ${currentUser.username}`);
    } else showToast("error", "Akses Ditolak", res.message);
  });
}

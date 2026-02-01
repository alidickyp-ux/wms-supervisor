import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  LogOut,
  Upload
} from "lucide-react";

const API_BASE = "https://wms-neon-bridge.vercel.app/api/inventory";

export default function App() {
  /* ===================== AUTH ===================== */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* ===================== UI ===================== */
  const [activeMenu, setActiveMenu] = useState("Master Lokasi");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  /* ===================== DATA ===================== */
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);

  /* ===================== MOBILE INPUT ===================== */
  const [mobLoc, setMobLoc] = useState("");
  const [mobArt, setMobArt] = useState("");
  const [mobQty, setMobQty] = useState("");
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);

  /* ===================== RESPONSIVE ===================== */
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ===================== FETCH ===================== */
  const fetchData = async () => {
    setLoading(true);
    try {
      const targetMap = {
        "Master Lokasi": "master",
        "Snapshot": "snapshot_list",
        "1st Count": "first",
        "2nd Count": isMobile ? "recon" : "second",
        "Reconciliation": "recon"
      };

      const target = targetMap[activeMenu];
      if (!target) return;

      const res = await axios.get(
        `${API_BASE}?action=get_data&target=${target}`
      );
      setData(res.data?.data || []);

      if (isMobile) {
        const snap = await axios.get(
          `${API_BASE}?action=get_data&target=snapshot_list`
        );
        setSnapData(snap.data?.data || []);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) fetchData();
  }, [activeMenu, isLoggedIn]);

  /* ===================== UPLOAD SNAP ===================== */
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array"
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        await axios.post(`${API_BASE}?action=upload_snap`, { data: json });
        alert("SUCCESS: SNAPSHOT UPLOADED");
        fetchData();
      } catch {
        alert("ERROR: Upload failed");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ===================== SAVE INPUT ===================== */
  const handleSaveInput = async () => {
    if (!mobLoc || !mobArt || mobQty === "")
      return alert("Lengkapi semua field");

    if (activeMenu === "2nd Count" && selectedLoc2nd) {
      if (
        mobLoc.trim().toUpperCase() !==
        selectedLoc2nd.location_id.toUpperCase()
      ) {
        return alert("Lokasi tidak sesuai target");
      }
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc.toUpperCase(),
        artikel: mobArt.toUpperCase(),
        qty: Number(mobQty),
        operator: user?.username || "ADMIN",
        target_table: activeMenu
      });
      alert("DATA SAVED");
      setMobLoc("");
      setMobArt("");
      setMobQty("");
      setLocInfo(null);
      setSelectedLoc2nd(null);
      fetchData();
    } catch {
      alert("SAVE FAILED");
    } finally {
      setLoading(false);
    }
  };

  /* ===================== TOGGLE MASTER ===================== */
  const handleToggle = async (uid, current) => {
    const next = current === "open" ? "closed" : "open";
    try {
      await axios.post(`${API_BASE}?action=assign_location`, {
        unique_id: uid,
        status: next
      });
      setData((prev) =>
        prev.map((i) =>
          i.unique_id === uid ? { ...i, assign: next } : i
        )
      );
    } catch {
      alert("TOGGLE ERROR");
    }
  };

  /* ===================== DERIVED ===================== */
  const filtered = data.filter((row) =>
    Object.values(row || {}).some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  const taskList2nd = data.filter((d) =>
    String(d.final_status || "").toUpperCase().match(/NEED|SHORT|EXCESS/)
  );

  /* ===================== LOGIN ===================== */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h2 style={{ marginBottom: 20 }}>COOL SYSTEM</h2>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={mInput}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={mInput}
          />
          <button
            style={btnBlack}
            onClick={() => {
              setIsLoggedIn(true);
              setUser({ username });
            }}
          >
            LOGIN
          </button>
        </div>
      </div>
    );
  }

  /* ===================== MAIN ===================== */
  return (
    <div style={mainLayout}>
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: 20, fontWeight: 900 }}>
          {isMobile ? "C" : "COOL"}
        </div>

        {[
          "Master Lokasi",
          "Snapshot",
          "1st Count",
          "2nd Count",
          "Reconciliation"
        ].map((m) => (
          <div
            key={m}
            onClick={() => {
              setActiveMenu(m);
              setSelectedLoc2nd(null);
              setLocInfo(null);
            }}
            style={navItem(activeMenu === m)}
          >
            {isMobile ? m[0] : m}
          </div>
        ))}

        <button style={btnLogout} onClick={() => setIsLoggedIn(false)}>
          <LogOut size={14} /> Logout
        </button>
      </nav>

      <div style={contentArea(isMobile)}>
        <header style={headerStyle}>
          <b>{activeMenu}</b>
          <button onClick={fetchData} style={btnIcon}>
            <RefreshCw size={14} />
          </button>
        </header>

        {/* MASTER LOKASI */}
        {activeMenu === "Master Lokasi" && (
          <div style={gridContainer(isMobile)}>
            {filtered.map((r) => (
              <div key={r.unique_id} style={cardGrid}>
                <b>{r.unique_id}</b>
                <div
                  style={toggleContainer(r.assign === "open")}
                  onClick={() => handleToggle(r.unique_id, r.assign)}
                >
                  <div style={toggleCircle(r.assign === "open")} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const mainLayout = { display: "flex", minHeight: "100vh" };
const sidebarStyle = (m) => ({
  width: m ? 50 : 180,
  borderRight: "1px solid #eee",
  position: "fixed",
  height: "100vh"
});
const contentArea = (m) => ({
  marginLeft: m ? 50 : 180,
  padding: 20,
  width: "100%"
});
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 20
};
const navItem = (a) => ({
  padding: "10px 20px",
  cursor: "pointer",
  fontWeight: a ? 800 : 400
});
const cardGrid = {
  border: "1px solid #eee",
  padding: 15,
  borderRadius: 6,
  textAlign: "center"
};
const gridContainer = () => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))",
  gap: 12
});
const mInput = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  border: "1px solid #ddd",
  borderRadius: 6
};
const btnBlack = {
  width: "100%",
  background: "#000",
  color: "#fff",
  padding: 12,
  border: "none",
  borderRadius: 6
};
const btnIcon = {
  border: "1px solid #eee",
  background: "#fff",
  padding: 8,
  borderRadius: 6
};
const btnLogout = {
  position: "absolute",
  bottom: 0,
  width: "100%",
  border: "none",
  background: "none",
  padding: 15,
  color: "#ef4444"
};
const toggleContainer = (on) => ({
  width: 34,
  height: 18,
  background: on ? "#000" : "#ddd",
  borderRadius: 12,
  position: "relative"
});
const toggleCircle = (on) => ({
  width: 12,
  height: 12,
  background: "#fff",
  borderRadius: "50%",
  position: "absolute",
  top: 3,
  left: on ? 18 : 4
});
const loginPage = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};
const loginCard = {
  width: 300,
  padding: 30,
  border: "1px solid #eee",
  borderRadius: 10
};

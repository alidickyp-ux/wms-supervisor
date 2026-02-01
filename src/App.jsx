import React, { useEffect, useState } from "react";
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
  /* ================= AUTH ================= */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  /* ================= UI ================= */
  const [activeMenu, setActiveMenu] = useState("Master Lokasi");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  /* ================= DATA ================= */
  const [data, setData] = useState([]);
  const [snapData, setSnapData] = useState([]);

  /* ================= INPUT (MOBILE) ================= */
  const [mobLoc, setMobLoc] = useState("");
  const [mobArt, setMobArt] = useState("");
  const [mobQty, setMobQty] = useState("");
  const [locInfo, setLocInfo] = useState(null);
  const [selectedLoc2nd, setSelectedLoc2nd] = useState(null);

  /* ================= RESPONSIVE ================= */
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  /* ================= LOGIN ================= */
  const handleLogin = async () => {
    if (!username || !password) return alert("ISI USERNAME & PASSWORD");
    setLoginLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}?action=login`,
        { username, password }
      );

      if (res.data.status === "success") {
        setUser(res.data.user);
        setIsLoggedIn(true);
      } else {
        alert(res.data.message || "LOGIN GAGAL");
      }
    } catch (e) {
      alert(e.response?.data?.message || "LOGIN ERROR");
    } finally {
      setLoginLoading(false);
    }
  };

  /* ================= FETCH ================= */
  const fetchData = async () => {
    setLoading(true);
    try {
      const map = {
        "Master Lokasi": "master",
        "Snapshot": "snapshot_list",
        "1st Count": "first",
        "2nd Count": isMobile ? "recon" : "second",
        "Reconciliation": "recon"
      };

      const target = map[activeMenu];
      if (!target) return;

      const res = await axios.get(
        `${API_BASE}?action=get_data&target=${target}`
      );
      setData(res.data.data || []);

      if (isMobile) {
        const snap = await axios.get(
          `${API_BASE}?action=get_data&target=snapshot_list`
        );
        setSnapData(snap.data.data || []);
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

  /* ================= SAVE INPUT ================= */
  const handleSaveInput = async () => {
    if (!mobLoc || !mobArt || mobQty === "")
      return alert("LENGKAPI DATA");

    if (activeMenu === "2nd Count" && selectedLoc2nd) {
      if (
        mobLoc.toUpperCase() !==
        selectedLoc2nd.location_id.toUpperCase()
      ) {
        return alert("LOKASI TIDAK SESUAI TARGET");
      }
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE}?action=save_input`, {
        location_id: mobLoc.toUpperCase(),
        artikel: mobArt.toUpperCase(),
        qty: Number(mobQty),
        operator: user.username,
        target_table: activeMenu
      });

      alert("DATA TERSIMPAN");
      setMobLoc("");
      setMobArt("");
      setMobQty("");
      setLocInfo(null);
      setSelectedLoc2nd(null);
      fetchData();
    } catch {
      alert("GAGAL SIMPAN DATA");
    } finally {
      setLoading(false);
    }
  };

  /* ================= MASTER TOGGLE ================= */
  const handleToggle = async (uid, current) => {
    const next = current === "open" ? "closed" : "open";
    await axios.post(`${API_BASE}?action=assign_location`, {
      unique_id: uid,
      status: next
    });
    fetchData();
  };

  /* ================= FILTER ================= */
  const filtered = data.filter((r) =>
    Object.values(r || {}).some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  const taskList2nd = data.filter((d) =>
    String(d.final_status || "")
      .toUpperCase()
      .match(/NEED|SHORT|EXCESS/)
  );

  /* ================= LOGIN PAGE ================= */
  if (!isLoggedIn) {
    return (
      <div style={loginPage}>
        <div style={loginCard}>
          <h3>COOL SYSTEM</h3>
          <input
            style={mInput}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            style={mInput}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button style={btnBlack} onClick={handleLogin}>
            {loginLoading ? "AUTH..." : "LOGIN"}
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN ================= */
  return (
    <div style={mainLayout}>
      <nav style={sidebarStyle(isMobile)}>
        <div style={{ padding: 15, fontWeight: 900 }}>
          COOL
          <div style={{ fontSize: "0.6rem", marginTop: 4 }}>
            {user.full_name}
          </div>
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
            onClick={() => setActiveMenu(m)}
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

        {/* ===== 1ST COUNT MOBILE ===== */}
        {activeMenu === "1st Count" && isMobile && (
          <div style={formWrapper}>
            <label style={labelStyle}>SCAN LOCATION</label>
            <input
              style={mInput}
              value={mobLoc}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setMobLoc(val);
                const items = snapData.filter(
                  (d) => d.location_id === val
                );
                setLocInfo(items.length ? items : null);
              }}
            />

            {locInfo && (
              <div style={boxContent}>
                {locInfo.map((i, idx) => (
                  <div key={idx}>
                    {i.artikel} : {i.qty_snap}
                  </div>
                ))}
              </div>
            )}

            <label style={labelStyle}>ARTICLE</label>
            <input
              style={mInput}
              value={mobArt}
              onChange={(e) => setMobArt(e.target.value.toUpperCase())}
            />

            <label style={labelStyle}>QTY</label>
            <input
              type="number"
              style={qtyInput}
              value={mobQty}
              onChange={(e) => setMobQty(e.target.value)}
            />

            <button style={btnBlack} onClick={handleSaveInput}>
              SAVE 1ST COUNT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= STYLE ================= */
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
const headerStyle = { display: "flex", justifyContent: "space-between" };
const navItem = (a) => ({
  padding: "10px 20px",
  cursor: "pointer",
  fontWeight: a ? 800 : 400
});
const mInput = {
  width: "100%",
  padding: 12,
  marginBottom: 12,
  border: "1px solid #ddd",
  borderRadius: 6
};
const qtyInput = { ...mInput, fontSize: "1.5rem", fontWeight: 900 };
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
  padding: 12,
  border: "none",
  background: "none",
  color: "#ef4444"
};
const formWrapper = { border: "1px solid #eee", padding: 20 };
const labelStyle = { fontSize: "0.6rem", fontWeight: 800 };
const boxContent = {
  background: "#f0f7ff",
  padding: 10,
  marginBottom: 10
};
const loginPage = {
  height: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};
const loginCard = {
  width: 300,
  padding: 30,
  border: "1px solid #eee"
};
